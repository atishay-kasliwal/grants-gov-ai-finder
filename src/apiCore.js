/**
 * Runtime-agnostic request handling shared by the Cloudflare Pages Functions
 * in functions/. The Node server in server.js keeps its own plumbing; the
 * grants.gov logic itself lives in grantsGovClient.js and is reused by both.
 */
import { ExternalApiError, ValidationError } from "./errors.js";
import {
  fetchOpportunity,
  normalizeOpportunity,
  searchOpportunities
} from "./grantsGovClient.js";

export const DEFAULT_GRANTS_GOV_BASE_URL = "https://api.grants.gov";

export const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type",
  "access-control-allow-methods": "GET,POST,OPTIONS"
};

/** Workers have no process.env, so the base URL comes from the Pages binding. */
export function resolveBaseUrl(env) {
  return env?.GRANTS_GOV_BASE_URL || DEFAULT_GRANTS_GOV_BASE_URL;
}

export function jsonResponse(statusCode, payload) {
  return new Response(JSON.stringify(payload, null, 2), {
    status: statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...CORS_HEADERS
    }
  });
}

export function errorResponse(error) {
  const statusCode =
    typeof error?.statusCode === "number" ? error.statusCode : 500;

  const type =
    error instanceof ValidationError || error instanceof ExternalApiError
      ? error.name
      : "InternalServerError";

  return jsonResponse(statusCode, {
    success: false,
    error: {
      type,
      message:
        error instanceof Error ? error.message : "An unexpected error occurred",
      details:
        error && typeof error === "object" && "details" in error
          ? error.details
          : null
    }
  });
}

export function notFoundResponse(request, pathname) {
  return jsonResponse(404, {
    success: false,
    error: {
      type: "NotFound",
      message: "Route not found",
      details: { method: request.method, path: pathname }
    }
  });
}

export function preflightResponse() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function readJsonBody(request) {
  const rawBody = (await request.text()).trim();

  if (!rawBody) {
    throw new ValidationError("Request body is required");
  }

  try {
    return JSON.parse(rawBody);
  } catch {
    throw new ValidationError("Request body must be valid JSON");
  }
}

export async function buildOpportunityResponse({
  opportunityId,
  includeRaw,
  baseUrl
}) {
  const payload = await fetchOpportunity({ opportunityId, baseUrl });

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

  return jsonResponse(200, response);
}

export async function buildSearchResponse({ includeRaw, baseUrl, ...criteria }) {
  const result = await searchOpportunities({ ...criteria, baseUrl });

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

  return jsonResponse(200, response);
}
