import {
  buildSearchResponse,
  errorResponse,
  preflightResponse,
  readJsonBody,
  resolveBaseUrl
} from "../../../src/apiCore.js";

export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const keywords = url.searchParams.getAll("keyword");

    return await buildSearchResponse({
      keyword: keywords.length > 0 ? undefined : url.searchParams.get("keywords"),
      keywords: keywords.length > 0 ? keywords : undefined,
      recentDays: url.searchParams.get("recentDays"),
      rows: url.searchParams.get("rows") ?? 25,
      oppStatuses: url.searchParams.get("oppStatuses") ?? "posted",
      oppNum: url.searchParams.get("oppNum") ?? "",
      agencies: url.searchParams.get("agencies") ?? "",
      aln: url.searchParams.get("aln") ?? "",
      eligibilities: url.searchParams.get("eligibilities") ?? "",
      fundingCategories: url.searchParams.get("fundingCategories") ?? "",
      fundingInstruments: url.searchParams.get("fundingInstruments") ?? "",
      includeRaw: url.searchParams.get("includeRaw") === "true",
      baseUrl: resolveBaseUrl(env)
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const url = new URL(request.url);
    const body = await readJsonBody(request);

    return await buildSearchResponse({
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
      includeRaw: url.searchParams.get("includeRaw") === "true",
      baseUrl: resolveBaseUrl(env)
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export const onRequestOptions = () => preflightResponse();
