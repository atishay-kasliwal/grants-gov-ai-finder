import test from "node:test";
import assert from "node:assert/strict";
import {
  fetchOpportunity,
  normalizeOpportunity,
  normalizeSearchHit,
  searchOpportunities,
  validateOpportunityId
} from "../src/grantsGovClient.js";
import { ExternalApiError, ValidationError } from "../src/errors.js";

const samplePayload = {
  errorcode: 0,
  msg: "Webservice Succeeds",
  token: "example-token",
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
    synopsisAttachmentFolders: [
      {
        id: 1684,
        folderType: "Full Announcement",
        folderName: "F1",
        synopsisAttachments: [
          {
            id: 10190,
            mimeType: "text/csv",
            fileName: "grants-gov-opp-search--20230715011557.csv",
            fileDescription: "F1"
          }
        ]
      }
    ],
    alns: [
      {
        id: 335392,
        alnNumber: "93.223",
        programTitle: "Development and Coordination of Rural Health Services"
      }
    ]
  }
};

test("validateOpportunityId accepts positive integers", () => {
  assert.equal(validateOpportunityId("289999"), 289999);
});

test("validateOpportunityId rejects invalid values", () => {
  assert.throws(
    () => validateOpportunityId("abc"),
    ValidationError
  );
});

test("fetchOpportunity posts to the expected Grants.gov path", async () => {
  let receivedUrl;
  let receivedOptions;

  const payload = await fetchOpportunity({
    opportunityId: 289999,
    baseUrl: "https://api.grants.gov",
    fetchImpl: async (url, options) => {
      receivedUrl = String(url);
      receivedOptions = options;
      return {
        ok: true,
        status: 200,
        json: async () => samplePayload
      };
    }
  });

  assert.equal(receivedUrl, "https://api.grants.gov/v1/api/fetchOpportunity");
  assert.equal(receivedOptions.method, "POST");
  assert.deepEqual(JSON.parse(receivedOptions.body), { opportunityId: 289999 });
  assert.equal(payload.data.id, 289999);
});

test("fetchOpportunity surfaces upstream API errors", async () => {
  await assert.rejects(
    () =>
      fetchOpportunity({
        opportunityId: 289999,
        fetchImpl: async () => ({
          ok: true,
          status: 200,
          json: async () => ({ errorcode: 99, msg: "Upstream failure" })
        })
      }),
    ExternalApiError
  );
});

test("normalizeOpportunity returns a clean response shape", () => {
  const normalized = normalizeOpportunity(samplePayload);

  assert.deepEqual(normalized, {
    id: 289999,
    revision: 0,
    opportunityNumber: "TEST-PTS-20231011-OPP1",
    opportunityTitle: "Test-PTS-20231011-Opp1 title!",
    owningAgencyCode: "HHS",
    listed: "L",
    agencyName: "Health & Human Services",
    agencyContactName: "Alison Applegate",
    agencyContactEmail: "12@hhs.gov",
    agencyContactPhone: "TBD-",
    costSharing: false,
    awardCeiling: 10,
    awardFloor: 8,
    postingDate: "Oct 11, 2023 12:00:00 AM EDT",
    fundingInstruments: [{ id: "G", description: "Grant" }],
    applicantTypes: [{ id: "01", description: "County governments" }],
    fundingActivityCategories: [{ id: "AR", description: "Arts" }],
    assistanceListings: [
      {
        id: 335392,
        alnNumber: "93.223",
        programTitle: "Development and Coordination of Rural Health Services"
      }
    ],
    attachmentFolders: [
      {
        id: 1684,
        folderType: "Full Announcement",
        folderName: "F1",
        files: [
          {
            id: 10190,
            fileName: "grants-gov-opp-search--20230715011557.csv",
            mimeType: "text/csv",
            fileDescription: "F1"
          }
        ]
      }
    ]
  });
});

test("normalizeSearchHit returns a clean search result shape", () => {
  const normalized = normalizeSearchHit({
    id: "123",
    number: "TEST-123",
    title: "AI Research Grant",
    agencyCode: "NSF",
    agencyName: "National Science Foundation",
    openDate: "08/01/2026",
    closeDate: "09/15/2026",
    oppStatus: "posted",
    docType: "synopsis",
    alnist: ["47.070"]
  });

  assert.deepEqual(normalized, {
    id: 123,
    opportunityNumber: "TEST-123",
    opportunityTitle: "AI Research Grant",
    agencyCode: "NSF",
    agencyName: "National Science Foundation",
    openDate: "08/01/2026",
    openDateIso: "2026-08-01",
    closeDate: "09/15/2026",
    closeDateIso: "2026-09-15",
    opportunityStatus: "posted",
    documentType: "synopsis",
    assistanceListingNumbers: ["47.070"]
  });
});

test("searchOpportunities merges results across multiple keywords", async () => {
  const result = await searchOpportunities({
    keywords: ["artificial intelligence", "software engineer"],
    oppNum: "26-512",
    recentDays: 30,
    rows: 10,
    now: new Date("2026-08-12T12:00:00Z"),
    fetchImpl: async (_url, options) => {
      const requestBody = JSON.parse(options.body);

      if (requestBody.keyword === "artificial intelligence") {
        return {
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
                  id: "101",
                  number: "AI-101",
                  title: "Artificial Intelligence Research Opportunity",
                  agencyCode: "NSF",
                  agencyName: "National Science Foundation",
                  openDate: "08/05/2026",
                  closeDate: "09/10/2026",
                  oppStatus: "posted",
                  docType: "synopsis",
                  alnist: ["47.070"]
                }
              ]
            }
          })
        };
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({
          errorcode: 0,
          msg: "Webservice Succeeds",
          data: {
            hitCount: 2,
            errorMsgs: [],
            oppHits: [
              {
                id: "101",
                number: "AI-101",
                title: "Artificial Intelligence Research Opportunity",
                agencyCode: "NSF",
                agencyName: "National Science Foundation",
                openDate: "08/05/2026",
                closeDate: "09/10/2026",
                oppStatus: "posted",
                docType: "synopsis",
                alnist: ["47.070"]
              },
              {
                id: "202",
                number: "SE-202",
                title: "Software Engineering for Secure AI Systems",
                agencyCode: "DARPA",
                agencyName: "Defense Advanced Research Projects Agency",
                openDate: "07/20/2026",
                closeDate: "08/30/2026",
                oppStatus: "posted",
                docType: "synopsis",
                alnist: []
              }
            ]
          }
        })
      };
    }
  });

  assert.deepEqual(result.criteria, {
    keywords: ["artificial intelligence", "software engineer"],
    statuses: ["posted"],
    rowsPerKeyword: 10,
    recentDays: 30,
    oppNum: "26-512",
    asOfDate: "2026-08-12"
  });
  assert.equal(result.opportunities.length, 2);
  assert.deepEqual(result.opportunities[0].matchedKeywords, [
    "artificial intelligence",
    "software engineer"
  ]);
  assert.equal(result.opportunities[1].opportunityNumber, "SE-202");
});
