const form = document.querySelector("#search-form");
const fillAiScenarioButton = document.querySelector("#fill-ai-scenario");
const resetFormButton = document.querySelector("#reset-form");
const keywordChips = document.querySelectorAll(".keyword-chip");
const summary = document.querySelector("#summary");
const results = document.querySelector("#results");
const rawOutput = document.querySelector("#raw-output");
const statusMessage = document.querySelector("#status-message");

const scenarioDefaults = {
  keywords: [
    "artificial intelligence",
    "machine learning",
    "data analyst",
    "software engineer"
  ].join("\n"),
  recentDays: 30,
  rows: 10,
  oppStatuses: ["posted"]
};

fillAiScenarioButton.addEventListener("click", () => {
  form.keywords.value = scenarioDefaults.keywords;
  form.recentDays.value = scenarioDefaults.recentDays;
  form.rows.value = scenarioDefaults.rows;

  document.querySelectorAll('input[name="oppStatus"]').forEach((input) => {
    input.checked = scenarioDefaults.oppStatuses.includes(input.value);
  });

  statusMessage.textContent = "AI scenario loaded. Run the search when you’re ready.";
});

keywordChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    const nextKeyword = chip.dataset.keyword?.trim();

    if (!nextKeyword) {
      return;
    }

    const existingKeywords = form.keywords.value
      .split(/\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);

    if (!existingKeywords.includes(nextKeyword)) {
      existingKeywords.push(nextKeyword);
      form.keywords.value = existingKeywords.join("\n");
    }

    statusMessage.textContent = `"${nextKeyword}" added to the search box.`;
  });
});

resetFormButton.addEventListener("click", () => {
  form.reset();
  document.querySelector('input[name="oppStatus"][value="posted"]').checked = true;
  summary.hidden = true;
  summary.innerHTML = "";
  results.innerHTML = "";
  rawOutput.hidden = true;
  rawOutput.textContent = "";
  statusMessage.textContent = "Run a search to see results.";
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const payload = buildPayload(form);
  statusMessage.textContent = "Searching Grants.gov...";
  summary.hidden = true;
  results.innerHTML = "";
  rawOutput.hidden = true;

  try {
    const url = new URL("/api/opportunities/search", window.location.origin);
    if (payload.includeRaw) {
      url.searchParams.set("includeRaw", "true");
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(payload.requestBody)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.error?.message || "Request failed");
    }

    renderSummary(data);
    renderResults(data.opportunities);
    renderRaw(data.raw);
    statusMessage.textContent = `Found ${data.opportunities.length} opportunities across ${data.querySummaries.length} keyword searches.`;
  } catch (error) {
    summary.hidden = true;
    results.innerHTML = "";
    rawOutput.hidden = true;
    statusMessage.textContent =
      error instanceof Error ? error.message : "Search failed.";
  }
});

function buildPayload(formElement) {
  const keywordValue = formElement.keywords.value
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);

  const oppStatuses = Array.from(
    formElement.querySelectorAll('input[name="oppStatus"]:checked')
  ).map((input) => input.value);

  return {
    includeRaw: formElement.includeRaw.checked,
    requestBody: {
      keywords: keywordValue,
      recentDays: toNumberOrUndefined(formElement.recentDays.value),
      rows: toNumberOrUndefined(formElement.rows.value),
      oppStatuses,
      oppNum: formElement.oppNum.value.trim(),
      agencies: formElement.agencies.value.trim(),
      aln: formElement.aln.value.trim(),
      eligibilities: formElement.eligibilities.value.trim(),
      fundingCategories: formElement.fundingCategories.value.trim(),
      fundingInstruments: formElement.fundingInstruments.value.trim()
    }
  };
}

function renderSummary(data) {
  const totalHits = data.querySummaries.reduce(
    (sum, item) => sum + Number(item.hitCount || 0),
    0
  );

  summary.hidden = false;
  summary.innerHTML = [
    createSummaryCard("Unique results", data.opportunities.length),
    createSummaryCard("Combined hits", totalHits),
    createSummaryCard("Keywords", data.criteria.keywords.length),
    createSummaryCard(
      "Recent window",
      data.criteria.recentDays === null ? "All" : `${data.criteria.recentDays} days`
    )
  ].join("");
}

function renderResults(opportunities) {
  if (!opportunities.length) {
    results.innerHTML = `
      <article class="result-card">
        <h3>No matches</h3>
        <p>Try broader keywords like <code>artificial intelligence</code>, <code>data</code>, or <code>digital</code>, or increase the recent-day window.</p>
      </article>
    `;
    return;
  }

  results.innerHTML = opportunities
    .map(
      (opportunity) => `
        <article class="result-card">
          <p class="eyebrow">${escapeHtml(opportunity.agencyCode || "Unknown agency")}</p>
          <h3>${escapeHtml(opportunity.opportunityTitle || "Untitled opportunity")}</h3>
          <p class="result-meta">
            <strong>${escapeHtml(opportunity.opportunityNumber || "No number")}</strong><br>
            Opened ${escapeHtml(opportunity.openDate || "Unknown")} and closes ${escapeHtml(opportunity.closeDate || "Unknown")}
          </p>
          <div class="pill-row">
            ${renderPills(opportunity.matchedKeywords)}
          </div>
        </article>
      `
    )
    .join("");
}

function renderRaw(raw) {
  if (!raw) {
    rawOutput.hidden = true;
    rawOutput.textContent = "";
    return;
  }

  rawOutput.hidden = false;
  rawOutput.textContent = JSON.stringify(raw, null, 2);
}

function createSummaryCard(label, value) {
  return `
    <article class="summary-card">
      <p>${escapeHtml(label)}</p>
      <strong>${escapeHtml(String(value))}</strong>
    </article>
  `;
}

function renderPills(values) {
  return values
    .map((value) => `<span class="pill">${escapeHtml(value)}</span>`)
    .join("");
}

function toNumberOrUndefined(value) {
  if (!value.trim()) {
    return undefined;
  }

  return Number(value);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
