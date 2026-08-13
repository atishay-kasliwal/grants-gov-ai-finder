import {
  buildOpportunityResponse,
  errorResponse,
  preflightResponse,
  readJsonBody,
  resolveBaseUrl
} from "../../../src/apiCore.js";

export async function onRequestPost({ request, env }) {
  try {
    const url = new URL(request.url);
    const body = await readJsonBody(request);

    return await buildOpportunityResponse({
      opportunityId: body.opportunityId,
      includeRaw: url.searchParams.get("includeRaw") === "true",
      baseUrl: resolveBaseUrl(env)
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export const onRequestOptions = () => preflightResponse();
