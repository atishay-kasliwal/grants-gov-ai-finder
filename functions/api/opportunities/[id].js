import {
  buildOpportunityResponse,
  errorResponse,
  preflightResponse,
  resolveBaseUrl
} from "../../../src/apiCore.js";

/**
 * GET /api/opportunities/:id
 *
 * Pages routes exact filenames ahead of dynamic segments, so search.js and
 * fetch.js win over this handler — the same exclusion isOpportunityPath()
 * applies in the Node server.
 */
export async function onRequestGet({ request, env, params }) {
  try {
    const url = new URL(request.url);

    return await buildOpportunityResponse({
      opportunityId: params.id,
      includeRaw: url.searchParams.get("includeRaw") === "true",
      baseUrl: resolveBaseUrl(env)
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export const onRequestOptions = () => preflightResponse();
