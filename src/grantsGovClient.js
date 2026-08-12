import { ExternalApiError, ValidationError } from "./errors.js";

const FETCH_OPPORTUNITY_PATH = "/v1/api/fetchOpportunity";
const SEARCH_OPPORTUNITIES_PATH = "/v1/api/search2";
const DEFAULT_BASE_URL = "https://api.grants.gov";
const MAX_SEARCH_ROWS = 100;

export function validateOpportunityId(opportunityId) {
  const parsed = Number(opportunityId);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new ValidationError("opportunityId must be a positive integer");
  }

  return parsed;
}

export async function fetchOpportunity({
  opportunityId,
  fetchImpl = globalThis.fetch,
  baseUrl = process.env.GRANTS_GOV_BASE_URL || DEFAULT_BASE_URL
}) {
  if (typeof fetchImpl !== "function") {
    throw new ValidationError("A valid fetch implementation is required");
  }

  const normalizedOpportunityId = validateOpportunityId(opportunityId);
  return postToGrantsGov({
    path: FETCH_OPPORTUNITY_PATH,
    body: { opportunityId: normalizedOpportunityId },
    fetchImpl,
    baseUrl
  });
}

export async function searchOpportunities({
  keyword,
  keywords,
  oppNum = "",
  oppStatuses = ["posted"],
  rows = 25,
  recentDays = null,
  agencies = "",
  aln = "",
  eligibilities = "",
  fundingCategories = "",
  fundingInstruments = "",
  fetchImpl = globalThis.fetch,
  baseUrl = process.env.GRANTS_GOV_BASE_URL || DEFAULT_BASE_URL,
  now = new Date()
}) {
  if (typeof fetchImpl !== "function") {
    throw new ValidationError("A valid fetch implementation is required");
  }

  const normalizedKeywords = normalizeSearchKeywords({ keyword, keywords });
  const normalizedRows = validateSearchRows(rows);
  const normalizedStatuses = normalizeOpportunityStatuses(oppStatuses);
  const normalizedRecentDays =
    recentDays === null || recentDays === undefined || recentDays === ""
      ? null
      : validateRecentDays(recentDays);

  const payloads = await Promise.all(
    normalizedKeywords.map((term) =>
      postToGrantsGov({
        path: SEARCH_OPPORTUNITIES_PATH,
        body: {
          rows: normalizedRows,
          keyword: term,
          oppNum,
          oppStatuses: normalizedStatuses,
          agencies,
          aln,
          eligibilities,
          fundingCategories,
          fundingInstruments
        },
        fetchImpl,
        baseUrl
      })
    )
  );

  const opportunitiesById = new Map();

  payloads.forEach((payload, index) => {
    const matchedKeyword = normalizedKeywords[index];
    const hits = Array.isArray(payload?.data?.oppHits) ? payload.data.oppHits : [];

    hits.forEach((hit) => {
      const normalizedHit = normalizeSearchHit(hit);
      const key = String(
        normalizedHit.id ??
          normalizedHit.opportunityNumber ??
          `${matchedKeyword}:${normalizedHit.opportunityTitle ?? "unknown"}`
      );
      const existing = opportunitiesById.get(key);

      if (existing) {
        existing.matchedKeywords = uniqueStrings([
          ...existing.matchedKeywords,
          matchedKeyword
        ]);
        return;
      }

      opportunitiesById.set(key, {
        ...normalizedHit,
        matchedKeywords: [matchedKeyword]
      });
    });
  });

  let opportunities = Array.from(opportunitiesById.values());

  if (normalizedRecentDays !== null) {
    opportunities = opportunities.filter((opportunity) =>
      isWithinRecentDays(opportunity.openDateIso, normalizedRecentDays, now)
    );
  }

  opportunities.sort(compareByMostRecentOpenDate);

  return {
    criteria: {
      keywords: normalizedKeywords,
      statuses: normalizedStatuses.split("|"),
      rowsPerKeyword: normalizedRows,
      recentDays: normalizedRecentDays,
      oppNum: oppNum || "",
      asOfDate: toIsoDate(now)
    },
    opportunities,
    querySummaries: payloads.map((payload, index) => ({
      keyword: normalizedKeywords[index],
      hitCount: payload?.data?.hitCount ?? 0,
      errorMessages: Array.isArray(payload?.data?.errorMsgs)
        ? payload.data.errorMsgs
        : []
    })),
    rawPayloads: payloads,
    meta: {
      source: "Grants.gov",
      queryCount: normalizedKeywords.length,
      upstreamErrorCode: 0,
      upstreamMessage: "Webservice Succeeds"
    }
  };
}

function normalizeSearchKeywords({ keyword, keywords }) {
  const baseKeywords = Array.isArray(keywords)
    ? keywords
    : typeof keywords === "string"
      ? keywords.split(",")
      : keyword !== undefined && keyword !== null
        ? [keyword]
        : [];

  const normalizedKeywords = uniqueStrings(
    baseKeywords
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean)
  );

  if (normalizedKeywords.length === 0) {
    throw new ValidationError(
      "At least one keyword is required for opportunity search"
    );
  }

  return normalizedKeywords;
}

function validateSearchRows(rows) {
  const parsed = Number(rows);

  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > MAX_SEARCH_ROWS) {
    throw new ValidationError(
      `rows must be an integer between 1 and ${MAX_SEARCH_ROWS}`
    );
  }

  return parsed;
}

function validateRecentDays(recentDays) {
  const parsed = Number(recentDays);

  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new ValidationError("recentDays must be a non-negative integer");
  }

  return parsed;
}

function normalizeOpportunityStatuses(oppStatuses) {
  if (Array.isArray(oppStatuses)) {
    const normalizedStatuses = uniqueStrings(
      oppStatuses
        .map((status) => (typeof status === "string" ? status.trim() : ""))
        .filter(Boolean)
    );

    if (normalizedStatuses.length === 0) {
      throw new ValidationError("At least one opportunity status is required");
    }

    return normalizedStatuses.join("|");
  }

  if (typeof oppStatuses === "string" && oppStatuses.trim()) {
    return oppStatuses
      .split("|")
      .map((status) => status.trim())
      .filter(Boolean)
      .join("|");
  }

  throw new ValidationError("At least one opportunity status is required");
}

export function normalizeSearchHit(hit) {
  const openDateIso = parseUsDateToIso(hit?.openDate);

  return {
    id: toIntegerOrNull(hit?.id),
    opportunityNumber: hit?.number ?? null,
    opportunityTitle: hit?.title ?? null,
    agencyCode: hit?.agencyCode ?? null,
    agencyName: hit?.agencyName ?? null,
    openDate: hit?.openDate ?? null,
    openDateIso,
    closeDate: hit?.closeDate || null,
    closeDateIso: parseUsDateToIso(hit?.closeDate),
    opportunityStatus: hit?.oppStatus ?? null,
    documentType: hit?.docType ?? null,
    assistanceListingNumbers: Array.isArray(hit?.alnist) ? hit.alnist : []
  };
}

function compareByMostRecentOpenDate(left, right) {
  const leftTime = left.openDateIso ? Date.parse(`${left.openDateIso}T00:00:00Z`) : 0;
  const rightTime = right.openDateIso
    ? Date.parse(`${right.openDateIso}T00:00:00Z`)
    : 0;

  if (rightTime !== leftTime) {
    return rightTime - leftTime;
  }

  return String(left.opportunityTitle ?? "").localeCompare(
    String(right.opportunityTitle ?? "")
  );
}

function isWithinRecentDays(openDateIso, recentDays, now) {
  if (!openDateIso) {
    return false;
  }

  const openDate = Date.parse(`${openDateIso}T00:00:00Z`);
  const nowAtMidnight = Date.parse(`${toIsoDate(now)}T00:00:00Z`);
  const diffDays = Math.floor((nowAtMidnight - openDate) / 86400000);

  return diffDays >= 0 && diffDays <= recentDays;
}

function parseUsDateToIso(value) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) {
    return null;
  }

  const [, month, day, year] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function toIsoDate(value) {
  return new Date(value).toISOString().slice(0, 10);
}

function uniqueStrings(values) {
  return [...new Set(values)];
}

function toIntegerOrNull(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

async function postToGrantsGov({ path, body, fetchImpl, baseUrl }) {
  const url = new URL(path, baseUrl);

  let response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: {
        "accept": "application/json",
        "content-type": "application/json"
      },
      body: JSON.stringify(body)
    });
  } catch (error) {
    throw new ExternalApiError("Failed to reach Grants.gov", {
      cause: error instanceof Error ? error.message : String(error)
    });
  }

  let payload;
  try {
    payload = await response.json();
  } catch (error) {
    throw new ExternalApiError("Grants.gov returned a non-JSON response", {
      status: response.status,
      cause: error instanceof Error ? error.message : String(error)
    });
  }

  if (!response.ok) {
    throw new ExternalApiError("Grants.gov returned an HTTP error", {
      status: response.status,
      payload
    }, response.status >= 400 && response.status < 500 ? 502 : 502);
  }

  if (!payload || typeof payload !== "object") {
    throw new ExternalApiError("Grants.gov returned an invalid payload");
  }

  if (payload.errorcode !== 0) {
    throw new ExternalApiError(payload.msg || "Grants.gov returned an error", {
      payload
    });
  }

  return payload;
}

export function normalizeOpportunity(payload) {
  const data = payload?.data ?? {};
  const synopsis = data.synopsis ?? {};

  return {
    id: data.id ?? synopsis.opportunityId ?? null,
    revision: data.revision ?? null,
    opportunityNumber: data.opportunityNumber ?? null,
    opportunityTitle: data.opportunityTitle ?? null,
    owningAgencyCode: data.owningAgencyCode ?? null,
    listed: data.listed ?? null,
    agencyName:
      synopsis.agencyName ??
      data.agencyDetails?.agencyName ??
      data.topAgencyDetails?.agencyName ??
      null,
    agencyContactName: synopsis.agencyContactName ?? null,
    agencyContactEmail: synopsis.agencyContactEmail ?? null,
    agencyContactPhone: synopsis.agencyContactPhone ?? null,
    costSharing:
      typeof synopsis.costSharing === "boolean" ? synopsis.costSharing : null,
    awardCeiling: toNumberOrNull(synopsis.awardCeiling),
    awardFloor: toNumberOrNull(synopsis.awardFloor),
    postingDate: synopsis.postingDate ?? null,
    fundingInstruments: normalizeLookupItems(synopsis.fundingInstruments),
    applicantTypes: normalizeLookupItems(synopsis.applicantTypes),
    fundingActivityCategories: normalizeLookupItems(
      synopsis.fundingActivityCategories
    ),
    assistanceListings: normalizeAssistanceListings(data.alns),
    attachmentFolders: normalizeAttachmentFolders(data.synopsisAttachmentFolders)
  };
}

function normalizeLookupItems(items) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.map((item) => ({
    id: item?.id ?? null,
    description: item?.description ?? null
  }));
}

function normalizeAssistanceListings(items) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.map((item) => ({
    id: item?.id ?? null,
    alnNumber: item?.alnNumber ?? null,
    programTitle: item?.programTitle ?? null
  }));
}

function normalizeAttachmentFolders(folders) {
  if (!Array.isArray(folders)) {
    return [];
  }

  return folders.map((folder) => ({
    id: folder?.id ?? null,
    folderType: folder?.folderType ?? null,
    folderName: folder?.folderName ?? null,
    files: Array.isArray(folder?.synopsisAttachments)
      ? folder.synopsisAttachments.map((file) => ({
          id: file?.id ?? null,
          fileName: file?.fileName ?? null,
          mimeType: file?.mimeType ?? null,
          fileDescription: file?.fileDescription ?? null
        }))
      : []
  }));
}

function toNumberOrNull(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
