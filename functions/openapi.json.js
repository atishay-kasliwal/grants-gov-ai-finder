import spec from "../openapi.json";
import { CORS_HEADERS } from "../src/apiCore.js";

/** Serves /openapi.json from the repo root without duplicating it into public/. */
export const onRequestGet = () =>
  new Response(JSON.stringify(spec, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...CORS_HEADERS
    }
  });
