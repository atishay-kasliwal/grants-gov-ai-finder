const form = document.querySelector("#search-form");
const fillAiScenarioButton = document.querySelector("#fill-ai-scenario");
const resetFormButton = document.querySelector("#reset-form");
const keywordChips = document.querySelectorAll(".keyword-chip");
const summary = document.querySelector("#summary");
const resultsBody = document.querySelector("#results-body");
const rawPanel = document.querySelector("#raw-panel");
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

fillAiScenarioButton.addEventListener("click", async () => {
  applyScenarioDefaults();
  statusMessage.textContent = "AI scenario loaded. Refreshing the table...";
  await runSearchFromForm();
});

keywordChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    const nextKeyword = chip.dataset.keyword?.trim();

    if (!nextKeyword) {
      return;
    }

    const existingKeywords = getNormalizedKeywords(form.keywords.value);
    if (!existingKeywords.includes(nextKeyword)) {
      existingKeywords.push(nextKeyword);
      form.keywords.value = existingKeywords.join("\n");
    }

    statusMessage.textContent = `"${nextKeyword}" added to the keyword list.`;
  });
});

resetFormButton.addEventListener("click", () => {
  form.reset();
  clearStatusSelections();
  document.querySelector('input[name="oppStatus"][value="posted"]').checked = true;
  summary.innerHTML = "";
  rawPanel.hidden = true;
  rawPanel.removeAttribute("open");
  rawOutput.textContent = "";
  renderPlaceholder("Ready for a new search.");
  statusMessage.textContent = "Filters reset. Run a search when you’re ready.";
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  await runSearchFromForm();
});

window.addEventListener("load", async () => {
  applyScenarioDefaults();
  await runSearchFromForm();
});

async function runSearchFromForm() {
  const payload = buildPayload(form);

  if (payload.requestBody.keywords.length === 0) {
    statusMessage.textContent = "Add at least one keyword to search.";
    renderPlaceholder("Add keywords like artificial intelligence or software innovation.");
    return;
  }

  statusMessage.textContent = "Searching Grants.gov...";
  summary.innerHTML = "";
  renderPlaceholder("Searching live opportunities...");
  rawPanel.hidden = true;
  rawPanel.removeAttribute("open");

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
    statusMessage.textContent = `Showing ${data.opportunities.length} unique opportunities from ${data.criteria.keywords.length} keywords.`;
  } catch (error) {
    summary.innerHTML = "";
    renderPlaceholder("Search failed. Adjust the filters or try again.");
    rawPanel.hidden = true;
    statusMessage.textContent =
      error instanceof Error ? error.message : "Search failed.";
  }
}

function buildPayload(formElement) {
  const oppStatuses = Array.from(
    formElement.querySelectorAll('input[name="oppStatus"]:checked')
  ).map((input) => input.value);

  return {
    includeRaw: formElement.includeRaw.checked,
    requestBody: {
      keywords: getNormalizedKeywords(formElement.keywords.value),
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

  summary.innerHTML = [
    createMetricCard("Unique results", data.opportunities.length),
    createMetricCard("Combined hits", totalHits),
    createMetricCard("Keywords", data.criteria.keywords.length),
    createMetricCard(
      "Recent window",
      data.criteria.recentDays === null ? "All dates" : `${data.criteria.recentDays} days`
    )
  ].join("");
}

function renderResults(opportunities) {
  if (!opportunities.length) {
    renderPlaceholder("No matches found. Try broader terms or increase recent days.");
    return;
  }

  resultsBody.innerHTML = opportunities
    .map(
      (opportunity) => `
        <tr>
          <td>
            <div class="cell-title">${escapeHtml(opportunity.opportunityTitle || "Untitled opportunity")}</div>
            <div class="cell-subtitle">${escapeHtml(opportunity.opportunityNumber || "No opportunity number")}</div>
          </td>
          <td>
            <div class="cell-title">${escapeHtml(opportunity.agencyCode || "Unknown agency")}</div>
            <div class="cell-subtitle">${escapeHtml(opportunity.agencyName || "Agency name unavailable")}</div>
          </td>
          <td>${escapeHtml(opportunity.openDate || "Unknown")}</td>
          <td>${escapeHtml(opportunity.closeDate || "Unknown")}</td>
          <td><span class="table-badge">${escapeHtml(opportunity.opportunityStatus || "Unknown")}</span></td>
          <td><div class="table-chip-row">${renderPills(opportunity.matchedKeywords)}</div></td>
        </tr>
      `
    )
    .join("");
}

function renderRaw(raw) {
  if (!raw) {
    rawPanel.hidden = true;
    rawPanel.removeAttribute("open");
    rawOutput.textContent = "";
    return;
  }

  rawPanel.hidden = false;
  rawOutput.textContent = JSON.stringify(raw, null, 2);
}

function renderPlaceholder(message) {
  resultsBody.innerHTML = `
    <tr class="placeholder-row">
      <td colspan="6">${escapeHtml(message)}</td>
    </tr>
  `;
}

function createMetricCard(label, value) {
  return `
    <article class="metric-card">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(String(value))}</strong>
    </article>
  `;
}

function renderPills(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return '<span class="table-chip table-chip-muted">none</span>';
  }

  return values
    .map((value) => `<span class="table-chip">${escapeHtml(value)}</span>`)
    .join("");
}

function applyScenarioDefaults() {
  form.keywords.value = scenarioDefaults.keywords;
  form.recentDays.value = scenarioDefaults.recentDays;
  form.rows.value = scenarioDefaults.rows;
  form.oppNum.value = "";
  form.agencies.value = "";
  form.aln.value = "";
  form.eligibilities.value = "";
  form.fundingCategories.value = "";
  form.fundingInstruments.value = "";
  form.includeRaw.checked = false;
  clearStatusSelections();

  document.querySelectorAll('input[name="oppStatus"]').forEach((input) => {
    input.checked = scenarioDefaults.oppStatuses.includes(input.value);
  });
}

function clearStatusSelections() {
  document.querySelectorAll('input[name="oppStatus"]').forEach((input) => {
    input.checked = false;
  });
}

function getNormalizedKeywords(value) {
  return value
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
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
