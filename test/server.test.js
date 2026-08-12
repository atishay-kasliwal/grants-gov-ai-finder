import test from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { createRequestHandler } from "../src/server.js";

const samplePayload = {
  errorcode: 0,
  msg: "Webservice Succeeds",
  data: {
    id: 289999,
    revision: 0,
    opportunityNumber: "TEST-PTS-20231011-OPP1",
    opportunityTitle: "Test-PTS-20231011-Opp1 title!",
    owningAgencyCode: "HHS",
    listed: "L",
    synopsis: {
      opportunityId: 289999,
      agencyName: "Health & Human Services",
      agencyContactName: "Alison Applegate",
      agencyContactEmail: "12@hhs.gov",
      agencyContactPhone: "TBD-",
      postingDate: "Oct 11, 2023 12:00:00 AM EDT",
      costSharing: false,
      awardCeiling: "10",
      awardFloor: "8",
      applicantTypes: [{ id: "01", description: "County governments" }],
      fundingInstruments: [{ id: "G", description: "Grant" }],
      fundingActivityCategories: [{ id: "AR", description: "Arts" }]
    },
    synopsisAttachmentFolders: [],
    alns: []
  }
};

test("GET /health returns ok", async () => {
  const handler = createRequestHandler({
    fetchImpl: async () => {
      throw new Error("fetch should not be called");
    }
  });
  const { statusCode, json } = await invokeHandler(handler, {
    method: "GET",
    url: "/health"
  });

  assert.equal(statusCode, 200);
  assert.deepEqual(json, { success: true, status: "ok" });
});

test("GET / serves the frontend", async () => {
  const handler = createRequestHandler();
  const { statusCode, headers, body } = await invokeHandler(handler, {
    method: "GET",
    url: "/"
  });

  assert.equal(statusCode, 200);
  assert.match(headers["content-type"], /text\/html/);
  assert.match(body, /Grant Scout/);
});

test("GET /api/opportunities/:id returns normalized data", async () => {
  const handler = createRequestHandler({
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => samplePayload
    })
  });
  const { statusCode, json } = await invokeHandler(handler, {
    method: "GET",
    url: "/api/opportunities/289999?includeRaw=true"
  });

  assert.equal(statusCode, 200);
  assert.equal(json.success, true);
  assert.equal(json.opportunity.id, 289999);
  assert.equal(json.meta.upstreamErrorCode, 0);
  assert.equal(json.raw.id, 289999);
});

test("POST /api/opportunities/fetch validates the request body", async () => {
  const handler = createRequestHandler({
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => samplePayload
    })
  });
  const { statusCode, json } = await invokeHandler(handler, {
    method: "POST",
    url: "/api/opportunities/fetch",
    body: JSON.stringify({})
  });

  assert.equal(statusCode, 400);
  assert.equal(json.success, false);
  assert.equal(json.error.type, "ValidationError");
});

test("GET /api/opportunities/search returns normalized search results", async () => {
  const handler = createRequestHandler({
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        errorcode: 0,
        msg: "Webservice Succeeds",
        data: {
          hitCount: 1,
          errorMsgs: [],
          oppHits: [
            {
              id: "999",
              number: "AI-999",
              title: "AI for Public Services",
              agencyCode: "DOC",
              agencyName: "Department of Commerce",
              openDate: "08/10/2026",
              closeDate: "09/15/2026",
              oppStatus: "posted",
              docType: "synopsis",
              alnist: []
            }
          ]
        }
      })
    })
  });

  const { statusCode, json } = await invokeHandler(handler, {
    method: "GET",
    url: "/api/opportunities/search?keyword=artificial%20intelligence&recentDays=30&rows=10"
  });

  assert.equal(statusCode, 200);
  assert.equal(json.success, true);
  assert.equal(json.criteria.recentDays, 30);
  assert.equal(json.opportunities.length, 1);
  assert.equal(json.opportunities[0].opportunityNumber, "AI-999");
});

async function invokeHandler(handler, { method, url, body = "" }) {
  const request = Readable.from(body ? [Buffer.from(body)] : []);
  request.method = method;
  request.url = url;

  const response = createMockResponse();
  await handler(request, response);

  const contentType = response.headers["content-type"] || "";
  const json = contentType.includes("application/json")
    ? JSON.parse(response.body)
    : null;

  return {
    statusCode: response.statusCode,
    headers: response.headers,
    body: response.body,
    json
  };
}

function createMockResponse() {
  return {
    headers: {},
    statusCode: 200,
    body: "",
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    writeHead(statusCode, headers = {}) {
      this.statusCode = statusCode;

      for (const [name, value] of Object.entries(headers)) {
        this.headers[name.toLowerCase()] = value;
      }
    },
    end(chunk = "") {
      this.body += chunk;
    }
  };
}
