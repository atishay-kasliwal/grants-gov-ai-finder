# Grants.gov Opportunity API

Small Node API that wraps the Grants.gov `fetchOpportunity` endpoint and returns a cleaner, easier-to-consume response shape.

## Endpoints

### `GET /health`

Simple health check.

### `GET /api/opportunities/:opportunityId`

Fetches and normalizes an opportunity from Grants.gov.

Query params:

- `includeRaw=true` to include the upstream Grants.gov payload in the response.

Example:

```bash
curl http://localhost:3000/api/opportunities/289999
```

### `POST /api/opportunities/fetch`

Accepts a JSON body:

```json
{
  "opportunityId": 289999
}
```

Example:

```bash
curl -X POST http://localhost:3000/api/opportunities/fetch \
  -H "Content-Type: application/json" \
  -d '{"opportunityId":289999}'
```

### `GET /api/opportunities/search`

Searches Grants.gov opportunities by keyword and returns normalized results.

Useful query params:

- `keyword=artificial intelligence`
- `keyword=data analyst`
- `keyword=software engineer`
- `recentDays=30`
- `rows=10`
- `oppStatuses=posted`
- `oppNum=26-512`
- `includeRaw=true`

Example:

```bash
curl "http://localhost:3000/api/opportunities/search?keyword=artificial%20intelligence&keyword=data%20analyst&keyword=software%20engineer&recentDays=30&rows=10"
```

### `POST /api/opportunities/search`

Accepts a JSON body:

```json
{
  "keywords": [
    "artificial intelligence",
    "data analyst",
    "software engineer"
  ],
  "recentDays": 30,
  "rows": 10,
  "oppStatuses": ["posted"],
  "oppNum": ""
}
```

## Response shape

Successful responses look like this:

```json
{
  "success": true,
  "opportunity": {
    "id": 289999,
    "revision": 0,
    "opportunityNumber": "TEST-PTS-20231011-OPP1",
    "opportunityTitle": "Test-PTS-20231011-Opp1 title!",
    "owningAgencyCode": "HHS",
    "listed": "L",
    "agencyName": "Health & Human Services",
    "agencyContactName": "Alison Applegate",
    "agencyContactEmail": "12@hhs.gov",
    "agencyContactPhone": "TBD-",
    "costSharing": false,
    "awardCeiling": 10,
    "awardFloor": 8,
    "postingDate": "Oct 11, 2023 12:00:00 AM EDT",
    "fundingInstruments": [
      {
        "id": "G",
        "description": "Grant"
      }
    ],
    "applicantTypes": [
      {
        "id": "01",
        "description": "County governments"
      }
    ],
    "fundingActivityCategories": [
      {
        "id": "AR",
        "description": "Arts"
      }
    ],
    "assistanceListings": [
      {
        "id": 335392,
        "alnNumber": "93.223",
        "programTitle": "Development and Coordination of Rural Health Services"
      }
    ],
    "attachmentFolders": [
      {
        "id": 1684,
        "folderType": "Full Announcement",
        "folderName": "F1",
        "files": [
          {
            "id": 10190,
            "fileName": "grants-gov-opp-search--20230715011557.csv",
            "mimeType": "text/csv",
            "fileDescription": "F1"
          }
        ]
      }
    ]
  },
  "meta": {
    "source": "Grants.gov",
    "upstreamMessage": "Webservice Succeeds",
    "upstreamErrorCode": 0
  }
}
```

## OpenAPI

The repo includes an OpenAPI description in [openapi.json](./openapi.json).

For the search endpoint, `recentDays` filters by the Grants.gov opportunity `openDate`. That is the closest reliable public proxy here for "recently approved" or newly posted opportunities.

## Filters

The frontend and API wrapper support these search filters today:

- `keyword` or `keywords`
- `rows`
- `recentDays`
- `oppStatuses`
- `oppNum`
- `agencies`
- `aln`
- `eligibilities`
- `fundingCategories`
- `fundingInstruments`

## Run locally

```bash
npm start
```

Or in watch mode:

```bash
npm run dev
```

## Test

```bash
npm test
```
