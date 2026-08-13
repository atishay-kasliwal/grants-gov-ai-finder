import { jsonResponse, preflightResponse } from "../src/apiCore.js";

export const onRequestGet = () => jsonResponse(200, { success: true, status: "ok" });

export const onRequestOptions = () => preflightResponse();
