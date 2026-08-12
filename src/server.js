import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { ExternalApiError, ValidationError } from "./errors.js";
import {
  fetchOpportunity,
  normalizeOpportunity,
  searchOpportunities
} from "./grantsGovClient.js";

const OPENAPI_PATH = new URL("../openapi.json", import.meta.url);
const STATIC_ROUTES = new Map([
  ["/", { file: "../public/index.html", contentType: "text/html; charset=utf-8" }],
  ["/styles.css", { file: "../public/styles.css", contentType: "text/css; charset=utf-8" }],
  ["/app.js", { file: "../public/app.js", contentType: "text/javascript; charset=utf-8" }]
]);

export function createApp({
  fetchImpl = globalThis.fetch,
  baseUrl = process.env.GRANTS_GOV_BASE_URL || "https://api.grants.gov"
} = {}) {
  return createServer(createRequestHandler({ fetchImpl, baseUrl }));
}

export function createRequestHandler({
  fetchImpl = globalThis.fetch,
  baseUrl = process.env.GRANTS_GOV_BASE_URL || "https://api.grants.gov"
} = {}) {
  return async (req, res) => {
    setCommonHeaders(res);

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    if (!req.url) {
      sendJson(res, 400, {
        success: false,
        error: {
          type: "ValidationError",
          message: "Request URL is missing",
          details: null
        }
      });
      return;
    }

    const url = new URL(req.url, "http://localhost");

    try {
      if (req.method === "GET" && url.pathname === "/health") {
        sendJson(res, 200, { success: true, status: "ok" });
        return;
      }

      if (req.method === "GET" && STATIC_ROUTES.has(url.pathname)) {
        await sendStaticAsset(res, STATIC_ROUTES.get(url.pathname));
        return;
      }

      if (req.method === "GET" && url.pathname === "/openapi.json") {
        const spec = await readFile(OPENAPI_PATH, "utf8");
        res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
        res.end(spec);
        return;
      }

      if (req.method === "GET" && isOpportunityPath(url.pathname)) {
        const opportunityId = url.pathname.split("/").pop();
        const includeRaw = url.searchParams.get("includeRaw") === "true";
        await handleOpportunityRequest(res, {
          opportunityId,
          includeRaw,
          fetchImpl,
          baseUrl
        });
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/opportunities/search") {
        const includeRaw = url.searchParams.get("includeRaw") === "true";
        const keywords = url.searchParams.getAll("keyword");
        const keywordCsv = url.searchParams.get("keywords");
        const recentDays = url.searchParams.get("recentDays");
        const rows = url.searchParams.get("rows") ?? 25;
        const oppStatuses = url.searchParams.get("oppStatuses") ?? "posted";

        await handleOpportunitySearchRequest(res, {
          keyword: keywords.length > 0 ? undefined : keywordCsv,
          keywords: keywords.length > 0 ? keywords : undefined,
          recentDays,
          rows,
          oppStatuses,
          oppNum: url.searchParams.get("oppNum") ?? "",
          agencies: url.searchParams.get("agencies") ?? "",
          aln: url.searchParams.get("aln") ?? "",
          eligibilities: url.searchParams.get("eligibilities") ?? "",
          fundingCategories: url.searchParams.get("fundingCategories") ?? "",
          fundingInstruments: url.searchParams.get("fundingInstruments") ?? "",
          includeRaw,
          fetchImpl,
          baseUrl
        });
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/opportunities/search") {
        const body = await readJsonBody(req);
        const includeRaw = url.searchParams.get("includeRaw") === "true";

        await handleOpportunitySearchRequest(res, {
          keyword: body.keyword,
          keywords: body.keywords,
          recentDays: body.recentDays,
          rows: body.rows ?? 25,
          oppStatuses: body.oppStatuses ?? ["posted"],
          oppNum: body.oppNum ?? "",
          agencies: body.agencies ?? "",
          aln: body.aln ?? "",
          eligibilities: body.eligibilities ?? "",
          fundingCategories: body.fundingCategories ?? "",
          fundingInstruments: body.fundingInstruments ?? "",
          includeRaw,
          fetchImpl,
          baseUrl
        });
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/opportunities/fetch") {
        const body = await readJsonBody(req);
        const includeRaw = url.searchParams.get("includeRaw") === "true";
        await handleOpportunityRequest(res, {
          opportunityId: body.opportunityId,
          includeRaw,
          fetchImpl,
          baseUrl
        });
        return;
      }

      sendJson(res, 404, {
        success: false,
        error: {
          type: "NotFound",
          message: "Route not found",
          details: {
            method: req.method,
            path: url.pathname
          }
        }
      });
    } catch (error) {
      handleError(res, error);
    }
  };
}

async function handleOpportunityRequest(
  res,
  { opportunityId, includeRaw, fetchImpl, baseUrl }
) {
  const payload = await fetchOpportunity({
    opportunityId,
    fetchImpl,
    baseUrl
  });

  const response = {
    success: true,
    opportunity: normalizeOpportunity(payload),
    meta: {
      source: "Grants.gov",
      upstreamMessage: payload.msg ?? null,
      upstreamErrorCode: payload.errorcode ?? null
    }
  };

  if (includeRaw) {
    response.raw = payload.data ?? null;
  }

  sendJson(res, 200, response);
}

async function handleOpportunitySearchRequest(
  res,
  {
    keyword,
    keywords,
    recentDays,
    rows,
    oppStatuses,
    oppNum,
    agencies,
    aln,
    eligibilities,
    fundingCategories,
    fundingInstruments,
    includeRaw,
    fetchImpl,
    baseUrl
  }
) {
  const result = await searchOpportunities({
    keyword,
    keywords,
    recentDays,
    rows,
    oppStatuses,
    oppNum,
    agencies,
    aln,
    eligibilities,
    fundingCategories,
    fundingInstruments,
    fetchImpl,
    baseUrl
  });

  const response = {
    success: true,
    criteria: result.criteria,
    opportunities: result.opportunities,
    querySummaries: result.querySummaries,
    meta: result.meta
  };

  if (includeRaw) {
    response.raw = result.rawPayloads;
  }

  sendJson(res, 200, response);
}

function isOpportunityPath(pathname) {
  if (!/^\/api\/opportunities\/[^/]+$/.test(pathname)) {
    return false;
  }

  const segment = pathname.split("/").pop();
  return segment !== "search" && segment !== "fetch";
}

async function readJsonBody(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(chunk);
  }

  const rawBody = Buffer.concat(chunks).toString("utf8").trim();

  if (!rawBody) {
    throw new ValidationError("Request body is required");
  }

  try {
    return JSON.parse(rawBody);
  } catch {
    throw new ValidationError("Request body must be valid JSON");
  }
}

function handleError(res, error) {
  const statusCode =
    typeof error?.statusCode === "number" ? error.statusCode : 500;

  const type =
    error instanceof ValidationError || error instanceof ExternalApiError
      ? error.name
      : "InternalServerError";

  sendJson(res, statusCode, {
    success: false,
    error: {
      type,
      message:
        error instanceof Error ? error.message : "An unexpected error occurred",
      details: error && typeof error === "object" && "details" in error
        ? error.details
        : null
    }
  });
}

function setCommonHeaders(res) {
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-headers", "content-type");
  res.setHeader("access-control-allow-methods", "GET,POST,OPTIONS");
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload, null, 2));
}

async function sendStaticAsset(res, asset) {
  const assetPath = new URL(asset.file, import.meta.url);
  const contents = await readFile(assetPath, "utf8");
  res.writeHead(200, { "content-type": asset.contentType });
  res.end(contents);
}

const isDirectRun =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isDirectRun) {
  const port = Number(process.env.PORT || 3000);
  const host = process.env.HOST || "0.0.0.0";
  const server = createApp();

  server.listen(port, host, () => {
    console.log(`Grants.gov API listening on http://${host}:${port}`);
  });
}
