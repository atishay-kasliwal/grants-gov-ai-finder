const STORAGE_KEYS = {
  drawerCollapsed: "grant-scout.drawer-collapsed",
  savedRows: "grant-scout.saved-rows"
};

const DEFAULT_PAGE_SIZE = 8;
const COMPACT_BREAKPOINT = 1280;
const MOBILE_BREAKPOINT = 900;

const SOURCES = [
  {
    name: "Grants.gov",
    url: "https://www.grants.gov/",
    description: "Main federal grant portal.",
    match: "Best for broad federal discovery and AI-related keyword searches."
  },
  {
    name: "Simpler Grants",
    url: "https://simpler.grants.gov/search",
    description: "Cleaner browsing for active opportunities.",
    match: "Useful when you want a faster browse of currently open grants."
  },
  {
    name: "SBIR.gov",
    url: "https://www.sbir.gov/topics",
    description: "Startup, R&D, and commercialization funding.",
    match: "Strong fit for software, research products, and innovation teams."
  },
  {
    name: "NSF Seed Fund",
    url: "https://seedfund.nsf.gov/",
    description: "Early-stage deep-tech funding.",
    match: "Excellent for patent-heavy and research commercialization ideas."
  },
  {
    name: "NIH Grants",
    url: "https://www.nih.gov/grants-funding",
    description: "Healthcare, biomedical, and medical AI funding.",
    match: "Best when the product touches biomedical or clinical workflows."
  }
];

const drawerToggle = document.querySelector("#drawer-toggle");
const mobileDrawerToggle = document.querySelector("#mobile-drawer-toggle");
const navButtons = Array.from(document.querySelectorAll(".nav-item"));
const toggleQueryEditorButton = document.querySelector("#toggle-query-editor");
const keywordSummaryList = document.querySelector("#keyword-summary-list");
const keywordSummaryEmpty = document.querySelector("#keyword-summary-empty");
const keywordSectionCount = document.querySelector("#keyword-section-count");
const queryEditor = document.querySelector("#query-editor");
const fillAiScenarioButton = document.querySelector("#fill-ai-scenario");
const resetQueryButton = document.querySelector("#reset-query");
const globalSearchInput = document.querySelector("#global-search");
const toolbarSearchInput = document.querySelector("#toolbar-search");
const workspaceKicker = document.querySelector("#workspace-kicker");
const workspaceTitle = document.querySelector("#workspace-title");
const workspaceSubtitle = document.querySelector("#workspace-subtitle");
const savedViewSelect = document.querySelector("#saved-view-select");
const exportButton = document.querySelector("#export-button");
const metricsStrip = document.querySelector("#metrics-strip");
const agencyFilter = document.querySelector("#agency-filter");
const statusFilter = document.querySelector("#status-filter");
const closingWindowFilter = document.querySelector("#closing-window-filter");
const sortFilter = document.querySelector("#sort-filter");
const viewFiltersForm = document.querySelector("#view-filters-form");
const resetViewFiltersButton = document.querySelector("#reset-view-filters");
const selectPageCheckbox = document.querySelector("#select-page");
const resultsBody = document.querySelector("#results-body");
const mobileResults = document.querySelector("#mobile-results");
const resultsTableView = document.querySelector("#results-table-view");
const sourcesView = document.querySelector("#sources-view");
const pageSizeSelect = document.querySelector("#page-size-select");
const pageIndicator = document.querySelector("#page-indicator");
const resultRange = document.querySelector("#result-range");
const pageFirstButton = document.querySelector("#page-first");
const pagePrevButton = document.querySelector("#page-prev");
const pageNextButton = document.querySelector("#page-next");
const pageLastButton = document.querySelector("#page-last");
const rawPanel = document.querySelector("#raw-panel");
const rawOutput = document.querySelector("#raw-output");
const appShell = document.querySelector(".app-shell");
const queryInputs = {
  keywords: document.querySelector("#keywords"),
  recentDays: document.querySelector("#recentDays"),
  rows: document.querySelector("#rows"),
  oppNum: document.querySelector("#oppNum"),
  agencies: document.querySelector("#agencies"),
  aln: document.querySelector("#aln"),
  eligibilities: document.querySelector("#eligibilities"),
  fundingCategories: document.querySelector("#fundingCategories"),
  fundingInstruments: document.querySelector("#fundingInstruments"),
  includeRaw: document.querySelector("#includeRaw"),
  statuses: Array.from(document.querySelectorAll('input[name="oppStatus"]'))
};

const state = {
  activeNav: "discover",
  compactViewport: window.innerWidth <= COMPACT_BREAKPOINT,
  mobileViewport: window.innerWidth <= MOBILE_BREAKPOINT,
  drawerCollapsed: getInitialDrawerState(),
  mobileDrawerOpen: false,
  queryEditorOpen: false,
  loading: false,
  errorMessage: "",
  rawPayload: null,
  querySummaries: [],
  results: [],
  viewFilters: {
    search: "",
    agency: "all",
    status: "all",
    closingWindow: "any",
    sortBy: "closingSoonest"
  },
  savedView: "all",
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  selectedKeys: new Set(),
  savedKeys: loadSavedKeys(),
  detailsCache: new Map(),
  detailRequests: new Map()
};

init();

function init() {
  statusFilter.innerHTML = [
    '<option value="all">All statuses</option>',
    '<option value="posted">Posted</option>',
    '<option value="forecasted">Forecasted</option>',
    '<option value="closed">Closed</option>',
    '<option value="archived">Archived</option>'
  ].join("");
  bindEvents();
  applyScenarioDefaults();
  syncQueryInputs();
  syncViewFilterInputs();
  renderShellState();
  runRemoteSearch();
}

function bindEvents() {
  drawerToggle.addEventListener("click", () => {
    state.drawerCollapsed = !state.drawerCollapsed;
    sessionStorage.setItem(STORAGE_KEYS.drawerCollapsed, String(state.drawerCollapsed));
    renderShellState();
  });

  mobileDrawerToggle.addEventListener("click", () => {
    state.mobileDrawerOpen = !state.mobileDrawerOpen;
    renderShellState();
  });

  navButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.activeNav = button.dataset.nav || "discover";
      state.page = 1;
      if (state.activeNav === "saved") {
        state.savedView = "saved";
      }
      if (state.activeNav === "discover" && savedViewSelect.value === "saved") {
        state.savedView = "all";
      }
      if (state.mobileViewport) {
        state.mobileDrawerOpen = false;
      }
      syncViewFilterInputs();
      renderApp();
    });
  });

  toggleQueryEditorButton.addEventListener("click", () => {
    if (!state.mobileViewport && getEffectiveDrawerCollapsed()) {
      state.drawerCollapsed = false;
      sessionStorage.setItem(STORAGE_KEYS.drawerCollapsed, "false");
    }
    state.queryEditorOpen = !state.queryEditorOpen;
    renderShellState();
  });

  fillAiScenarioButton.addEventListener("click", () => {
    applyScenarioDefaults();
    syncQueryInputs();
    state.queryEditorOpen = true;
    runRemoteSearch();
  });

  resetQueryButton.addEventListener("click", () => {
    clearQueryInputs();
    syncQueryInputs();
    state.results = [];
    state.querySummaries = [];
    state.rawPayload = null;
    state.errorMessage = "";
    state.page = 1;
    renderKeywordSummary();
    renderApp();
  });

  globalSearchInput.addEventListener("input", handleQuickSearchInput);
  toolbarSearchInput.addEventListener("input", handleQuickSearchInput);

  agencyFilter.addEventListener("change", () => {
    state.viewFilters.agency = agencyFilter.value;
    state.page = 1;
    renderApp();
  });

  statusFilter.addEventListener("change", () => {
    state.viewFilters.status = statusFilter.value;
    state.page = 1;
    renderApp();
  });

  closingWindowFilter.addEventListener("change", () => {
    state.viewFilters.closingWindow = closingWindowFilter.value;
    state.page = 1;
    renderApp();
  });

  sortFilter.addEventListener("change", () => {
    state.viewFilters.sortBy = sortFilter.value;
    state.page = 1;
    renderApp();
  });

  savedViewSelect.addEventListener("change", () => {
    state.savedView = savedViewSelect.value;
    state.page = 1;
    renderApp();
  });

  viewFiltersForm.addEventListener("submit", (event) => {
    event.preventDefault();
    runRemoteSearch();
  });

  resetViewFiltersButton.addEventListener("click", () => {
    state.viewFilters = {
      search: "",
      agency: "all",
      status: "all",
      closingWindow: "any",
      sortBy: "closingSoonest"
    };
    state.savedView = state.activeNav === "saved" ? "saved" : "all";
    state.page = 1;
    syncViewFilterInputs();
    renderApp();
  });

  resultsBody.addEventListener("click", handleTableActionClick);
  mobileResults.addEventListener("click", handleTableActionClick);

  selectPageCheckbox.addEventListener("change", () => {
    const viewModel = buildViewModel();
    viewModel.pageRows.forEach((row) => {
      if (selectPageCheckbox.checked) {
        state.selectedKeys.add(row.key);
      } else {
        state.selectedKeys.delete(row.key);
      }
    });
    renderApp();
  });

  pageSizeSelect.addEventListener("change", () => {
    state.pageSize = Number(pageSizeSelect.value);
    state.page = 1;
    renderApp();
  });

  pageFirstButton.addEventListener("click", () => {
    state.page = 1;
    renderApp();
  });

  pagePrevButton.addEventListener("click", () => {
    state.page = Math.max(1, state.page - 1);
    renderApp();
  });

  pageNextButton.addEventListener("click", () => {
    const viewModel = buildViewModel();
    state.page = Math.min(viewModel.totalPages, state.page + 1);
    renderApp();
  });

  pageLastButton.addEventListener("click", () => {
    const viewModel = buildViewModel();
    state.page = viewModel.totalPages;
    renderApp();
  });

  exportButton.addEventListener("click", () => {
    exportVisibleRows();
  });

  document.querySelectorAll(".th-button").forEach((button) => {
    button.addEventListener("click", () => {
      const sortKey = button.dataset.sortKey;
      if (!sortKey) {
        return;
      }
      state.viewFilters.sortBy = sortKey;
      sortFilter.value = sortKey;
      state.page = 1;
      renderApp();
    });
  });

  window.addEventListener("resize", () => {
    const nextCompact = window.innerWidth <= COMPACT_BREAKPOINT;
    const nextMobile = window.innerWidth <= MOBILE_BREAKPOINT;
    const compactChanged = nextCompact !== state.compactViewport;
    const mobileChanged = nextMobile !== state.mobileViewport;

    state.compactViewport = nextCompact;
    state.mobileViewport = nextMobile;

    if (!state.mobileViewport) {
      state.mobileDrawerOpen = false;
    }

    if (compactChanged || mobileChanged) {
      renderShellState();
      renderApp();
    }
  });
}

async function runRemoteSearch() {
  const queryConfig = readQueryInputs();

  if (queryConfig.keywords.length === 0) {
    state.results = [];
    state.querySummaries = [];
    state.rawPayload = null;
    state.errorMessage = "";
    state.loading = false;
    state.page = 1;
    renderApp();
    return;
  }

  state.loading = true;
  state.errorMessage = "";
  state.rawPayload = null;
  renderApp();

  try {
    const url = new URL("/api/opportunities/search", window.location.origin);

    if (queryConfig.includeRaw) {
      url.searchParams.set("includeRaw", "true");
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        keywords: queryConfig.keywords,
        recentDays: queryConfig.recentDays,
        rows: queryConfig.rows,
        oppStatuses: queryConfig.oppStatuses,
        oppNum: queryConfig.oppNum,
        agencies: queryConfig.agencies,
        aln: queryConfig.aln,
        eligibilities: queryConfig.eligibilities,
        fundingCategories: queryConfig.fundingCategories,
        fundingInstruments: queryConfig.fundingInstruments
      })
    });

    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload?.error?.message || "Request failed");
    }

    state.loading = false;
    state.errorMessage = "";
    state.results = Array.isArray(payload.opportunities) ? payload.opportunities : [];
    state.querySummaries = Array.isArray(payload.querySummaries)
      ? payload.querySummaries
      : [];
    state.rawPayload = payload.raw ?? null;
    state.page = 1;

    updateAgencyFilterOptions();
    renderApp();
    enrichVisibleRows();
  } catch (error) {
    state.loading = false;
    state.errorMessage = error instanceof Error ? error.message : "Search failed.";
    state.results = [];
    state.querySummaries = [];
    state.rawPayload = null;
    renderApp();
  }
}

function renderApp() {
  renderShellState();
  renderKeywordSummary();
  renderWorkspaceHeader();
  renderMetricsStrip();
  updateAgencyFilterOptions();
  syncViewFilterInputs();
  renderRawPayload();

  if (state.activeNav === "sources") {
    resultsTableView.hidden = true;
    sourcesView.hidden = false;
    return;
  }

  resultsTableView.hidden = false;
  sourcesView.hidden = true;

  if (state.loading) {
    renderLoadingState();
    return;
  }

  if (state.errorMessage) {
    renderMessageState("error", state.errorMessage);
    return;
  }

  const viewModel = buildViewModel();
  renderTableState(viewModel);
  enrichVisibleRows();
}

function renderShellState() {
  appShell.dataset.drawerCollapsed = String(getEffectiveDrawerCollapsed());
  appShell.dataset.mobileDrawerOpen = String(state.mobileDrawerOpen);
  queryEditor.hidden = !state.queryEditorOpen || getEffectiveDrawerCollapsed();
  toggleQueryEditorButton.textContent = state.queryEditorOpen ? "Close" : "Edit";

  const collapseLabel = getEffectiveDrawerCollapsed()
    ? "Expand navigation drawer"
    : "Collapse navigation drawer";

  drawerToggle.setAttribute("aria-label", collapseLabel);
  drawerToggle.setAttribute("title", collapseLabel);

  navButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.nav === state.activeNav);
  });
}

function renderWorkspaceHeader() {
  if (state.activeNav === "discover") {
    workspaceKicker.textContent = "DISCOVER";
    workspaceTitle.textContent = "Grant opportunities";
  } else if (state.activeNav === "saved") {
    workspaceKicker.textContent = "SAVED";
    workspaceTitle.textContent = "Saved grants";
  } else {
    workspaceKicker.textContent = "SOURCES";
    workspaceTitle.textContent = "Recommended sources";
  }

  if (state.loading) {
    workspaceSubtitle.textContent = "Refreshing opportunities...";
    return;
  }

  if (state.errorMessage) {
    workspaceSubtitle.textContent = "The latest search could not be loaded.";
    return;
  }

  if (state.activeNav === "sources") {
    workspaceSubtitle.textContent =
      "Browse recommended federal funding portals for AI, software, and commercialization opportunities.";
    return;
  }

  const queryKeywordCount = readQueryInputs().keywords.length;
  const viewModel = buildViewModel();

  if (queryKeywordCount === 0) {
    workspaceSubtitle.textContent =
      "Add keywords in the left drawer and run Search to discover opportunities.";
    return;
  }

  if (state.activeNav === "saved") {
    workspaceSubtitle.textContent =
      `Showing ${viewModel.totalRows} saved grants from ${state.results.length} available opportunities.`;
    return;
  }

  workspaceSubtitle.textContent =
    `Showing ${viewModel.totalRows} of ${state.results.length} unique opportunities from ${queryKeywordCount} keywords.`;
}

function renderMetricsStrip() {
  if (state.activeNav === "sources") {
    metricsStrip.innerHTML = `
      <div class="metric-item">
        <strong>${SOURCES.length}</strong>
        <span>Sources</span>
      </div>
      <div class="metric-divider" aria-hidden="true"></div>
      <div class="metric-item">
        <strong>Federal</strong>
        <span>Coverage</span>
      </div>
      <div class="metric-divider" aria-hidden="true"></div>
      <div class="metric-item">
        <strong>AI</strong>
        <span>Best fit</span>
      </div>
      <div class="metric-divider" aria-hidden="true"></div>
      <div class="metric-item">
        <strong>Startup</strong>
        <span>Funding mix</span>
      </div>
    `;
    return;
  }

  if (state.loading) {
    metricsStrip.innerHTML = Array.from({ length: 4 }, () => `
      <div class="metric-item metric-item-loading">
        <strong></strong>
        <span></span>
      </div>
    `).join('<div class="metric-divider" aria-hidden="true"></div>');
    return;
  }

  const queryConfig = readQueryInputs();
  const viewModel = buildViewModel();
  const combinedHits = state.querySummaries.reduce(
    (sum, item) => sum + Number(item.hitCount || 0),
    0
  );

  metricsStrip.innerHTML = [
    createMetricMarkup(viewModel.totalRows, "Opportunities"),
    createMetricMarkup(combinedHits.toLocaleString(), "Combined hits"),
    createMetricMarkup(queryConfig.keywords.length, "Keywords"),
    createMetricMarkup(
      queryConfig.recentDays === null ? "All" : queryConfig.recentDays,
      queryConfig.recentDays === null ? "Date range" : "Days window"
    )
  ].join('<div class="metric-divider" aria-hidden="true"></div>');
}

function renderKeywordSummary() {
  const keywords = state.querySummaries;
  keywordSectionCount.textContent = `(${keywords.length})`;

  if (keywords.length === 0) {
    keywordSummaryList.innerHTML = "";
    keywordSummaryEmpty.hidden = false;
    return;
  }

  keywordSummaryEmpty.hidden = true;
  keywordSummaryList.innerHTML = keywords
    .map((item) => `
      <li>
        <button
          class="keyword-summary-item"
          type="button"
          data-keyword-summary="${escapeHtml(item.keyword)}"
          title="${escapeHtml(item.keyword)}"
        >
          <span class="keyword-summary-text">${escapeHtml(item.keyword)}</span>
          <span class="keyword-summary-count">${Number(item.hitCount || 0)}</span>
        </button>
      </li>
    `)
    .join("");

  keywordSummaryList.querySelectorAll("[data-keyword-summary]").forEach((button) => {
    button.addEventListener("click", () => {
      const keyword = button.dataset.keywordSummary || "";
      const keywordsValue = getNormalizedKeywords(queryInputs.keywords.value);

      if (!keywordsValue.includes(keyword)) {
        keywordsValue.push(keyword);
        queryInputs.keywords.value = keywordsValue.join("\n");
      }

      state.viewFilters.search = keyword;
      syncQuickSearchInputs(keyword);
      renderApp();
    });
  });
}

function renderRawPayload() {
  if (!state.rawPayload) {
    rawPanel.hidden = true;
    rawPanel.removeAttribute("open");
    rawOutput.textContent = "";
    return;
  }

  rawPanel.hidden = false;
  rawOutput.textContent = JSON.stringify(state.rawPayload, null, 2);
}

function renderLoadingState() {
  const loadingRows = Array.from({ length: state.pageSize }, () => `
    <tr class="loading-row">
      <td class="checkbox-cell"><span class="skeleton skeleton-box"></span></td>
      <td><span class="skeleton skeleton-line skeleton-line-lg"></span><span class="skeleton skeleton-line skeleton-line-sm"></span></td>
      <td><span class="skeleton skeleton-line skeleton-line-md"></span><span class="skeleton skeleton-line skeleton-line-sm"></span></td>
      <td class="col-funding"><span class="skeleton skeleton-line skeleton-line-md"></span></td>
      <td class="col-open"><span class="skeleton skeleton-line skeleton-line-sm"></span></td>
      <td><span class="skeleton skeleton-line skeleton-line-sm"></span></td>
      <td class="col-days"><span class="skeleton skeleton-pill"></span></td>
      <td><span class="skeleton skeleton-pill"></span></td>
      <td class="col-match"><span class="skeleton skeleton-line skeleton-line-xs"></span></td>
      <td class="col-keyword"><span class="skeleton skeleton-pill"></span></td>
      <td class="bookmark-cell"><span class="skeleton skeleton-box"></span></td>
    </tr>
  `).join("");

  resultsBody.innerHTML = loadingRows;
  mobileResults.innerHTML = Array.from({ length: 4 }, () => `
    <article class="mobile-card mobile-card-loading">
      <span class="skeleton skeleton-line skeleton-line-lg"></span>
      <span class="skeleton skeleton-line skeleton-line-md"></span>
      <span class="skeleton skeleton-pill"></span>
    </article>
  `).join("");
  resultRange.textContent = "Loading opportunities...";
  pageIndicator.textContent = "—";
  selectPageCheckbox.checked = false;
  setPaginationDisabled(true);
}

function renderMessageState(kind, message) {
  const actionMessage = kind === "error"
    ? `${message} Try Search again after checking the current filters.`
    : message;

  resultsBody.innerHTML = `
    <tr class="message-row">
      <td colspan="11">
        <div class="table-message table-message-${kind}">
          <strong>${kind === "error" ? "API error" : "No results"}</strong>
          <span>${escapeHtml(actionMessage)}</span>
        </div>
      </td>
    </tr>
  `;

  mobileResults.innerHTML = `
    <article class="mobile-empty-state">
      <strong>${kind === "error" ? "API error" : "No results"}</strong>
      <p>${escapeHtml(actionMessage)}</p>
    </article>
  `;
  resultRange.textContent = kind === "error" ? "Search failed" : "0 opportunities";
  pageIndicator.textContent = "1";
  selectPageCheckbox.checked = false;
  setPaginationDisabled(true);
}

function renderTableState(viewModel) {
  if (viewModel.totalRows === 0) {
    const message = getEmptyStateMessage();
    renderMessageState("empty", message);
    return;
  }

  resultsBody.innerHTML = viewModel.pageRows.map(renderTableRow).join("");
  mobileResults.innerHTML = viewModel.pageRows.map(renderMobileCard).join("");

  const allSelected = viewModel.pageRows.length > 0
    && viewModel.pageRows.every((row) => state.selectedKeys.has(row.key));

  selectPageCheckbox.checked = allSelected;
  selectPageCheckbox.indeterminate = !allSelected
    && viewModel.pageRows.some((row) => state.selectedKeys.has(row.key));

  resultRange.textContent = `${viewModel.rangeStart} to ${viewModel.rangeEnd} of ${viewModel.totalRows} opportunities`;
  pageIndicator.textContent = `${viewModel.currentPage}`;
  setPaginationDisabled(viewModel.totalPages <= 1, viewModel);
}

function renderTableRow(row) {
  const selected = state.selectedKeys.has(row.key);
  const saved = state.savedKeys.has(row.key);
  const fundingMarkup = row.fundingAmountValue !== null
    ? `<strong>${formatCurrency(row.fundingAmountValue)}</strong><span>Max award</span>`
    : `<strong>Not listed</strong><span>Funding TBD</span>`;

  return `
    <tr class="${selected ? "is-selected" : ""} ${saved ? "is-saved" : ""}" data-row-key="${escapeHtml(row.key)}">
      <td class="checkbox-cell">
        <input
          type="checkbox"
          data-row-select-key="${escapeHtml(row.key)}"
          aria-label="Select ${escapeHtml(row.opportunityTitle)}"
          ${selected ? "checked" : ""}
        >
      </td>
      <td>
        <div class="opportunity-cell">
          <div>
            <div class="cell-title">${escapeHtml(row.opportunityTitle)}</div>
            <div class="cell-subtitle">${escapeHtml(row.opportunityNumber || "No opportunity number")}</div>
          </div>
        </div>
      </td>
      <td>
        <div class="cell-title">${escapeHtml(row.agencyCode || "Unknown")}</div>
        <div class="cell-subtitle">${escapeHtml(row.agencyDisplayName)}</div>
      </td>
      <td class="col-funding">
        <div class="amount-cell">
          ${fundingMarkup}
        </div>
      </td>
      <td class="col-open">${escapeHtml(row.openDate || "Unknown")}</td>
      <td>${escapeHtml(row.closeDate || "Unknown")}</td>
      <td class="col-days">
        <span class="days-indicator ${row.daysClass}">${escapeHtml(row.daysLabel)}</span>
      </td>
      <td>
        <span class="status-pill">${escapeHtml(row.statusLabel)}</span>
      </td>
      <td class="col-match">
        <span class="match-score">${row.matchScore}%</span>
      </td>
      <td class="col-keyword">
        <span class="keyword-pill">${escapeHtml(row.displayKeyword)}</span>
      </td>
      <td class="bookmark-cell">
        <button
          class="icon-button bookmark-button ${saved ? "is-active" : ""}"
          type="button"
          data-bookmark-key="${escapeHtml(row.key)}"
          aria-label="${saved ? "Remove from saved grants" : "Save grant"}"
          aria-pressed="${saved ? "true" : "false"}"
        >
          ${renderBookmarkIcon(saved)}
        </button>
      </td>
    </tr>
  `;
}

function renderMobileCard(row) {
  const saved = state.savedKeys.has(row.key);
  const selected = state.selectedKeys.has(row.key);

  return `
    <article class="mobile-card ${selected ? "is-selected" : ""}">
      <div class="mobile-card-top">
        <div>
          <h2>${escapeHtml(row.opportunityTitle)}</h2>
          <p>${escapeHtml(row.agencyCode || "Unknown")} · ${escapeHtml(row.agencyDisplayName)}</p>
        </div>
        <button
          class="icon-button bookmark-button ${saved ? "is-active" : ""}"
          type="button"
          data-bookmark-key="${escapeHtml(row.key)}"
          aria-label="${saved ? "Remove from saved grants" : "Save grant"}"
          aria-pressed="${saved ? "true" : "false"}"
        >
          ${renderBookmarkIcon(saved)}
        </button>
      </div>

      <div class="mobile-card-grid">
        <div>
          <span>Funding</span>
          <strong>${row.fundingAmountValue !== null ? formatCurrency(row.fundingAmountValue) : "Not listed"}</strong>
        </div>
        <div>
          <span>Closes</span>
          <strong>${escapeHtml(row.closeDate || "Unknown")}</strong>
        </div>
        <div>
          <span>Days left</span>
          <strong>${escapeHtml(row.daysLabel)}</strong>
        </div>
        <div>
          <span>Match</span>
          <strong class="match-score">${row.matchScore}%</strong>
        </div>
      </div>

      <div class="mobile-card-footer">
        <span class="status-pill">${escapeHtml(row.statusLabel)}</span>
        <span class="keyword-pill">${escapeHtml(row.displayKeyword)}</span>
      </div>
    </article>
  `;
}

function buildViewModel() {
  const allRows = state.results.map((opportunity) => decorateOpportunity(opportunity));
  let rows = allRows;

  if (state.activeNav === "saved") {
    rows = rows.filter((row) => state.savedKeys.has(row.key));
  }

  if (state.savedView === "saved") {
    rows = rows.filter((row) => state.savedKeys.has(row.key));
  } else if (state.savedView === "closingSoon") {
    rows = rows.filter((row) => row.daysRemaining !== null && row.daysRemaining <= 30);
  }

  if (state.viewFilters.search.trim()) {
    const needle = state.viewFilters.search.trim().toLowerCase();
    rows = rows.filter((row) => {
      const haystack = [
        row.opportunityTitle,
        row.opportunityNumber,
        row.agencyCode,
        row.agencyDisplayName,
        row.displayKeyword
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(needle);
    });
  }

  if (state.viewFilters.agency !== "all") {
    rows = rows.filter((row) => row.agencyCode === state.viewFilters.agency);
  }

  if (state.viewFilters.status !== "all") {
    rows = rows.filter((row) => row.statusValue === state.viewFilters.status);
  }

  if (state.viewFilters.closingWindow !== "any") {
    const windowDays = Number(state.viewFilters.closingWindow);
    rows = rows.filter((row) =>
      row.daysRemaining !== null
      && row.daysRemaining >= 0
      && row.daysRemaining <= windowDays
    );
  }

  rows = sortRows(rows, state.viewFilters.sortBy);

  const totalRows = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / state.pageSize));
  state.page = Math.min(state.page, totalPages);

  const startIndex = (state.page - 1) * state.pageSize;
  const pageRows = rows.slice(startIndex, startIndex + state.pageSize);

  return {
    allRows,
    filteredRows: rows,
    pageRows,
    totalRows,
    totalPages,
    currentPage: state.page,
    rangeStart: totalRows === 0 ? 0 : startIndex + 1,
    rangeEnd: totalRows === 0 ? 0 : Math.min(startIndex + pageRows.length, totalRows)
  };
}

function decorateOpportunity(opportunity) {
  const key = getOpportunityKey(opportunity);
  const details = opportunity.id !== null && opportunity.id !== undefined
    ? state.detailsCache.get(String(opportunity.id))
    : null;
  const fundingAmountValue = getFundingAmount(details);
  const agencyDisplayName =
    details?.agencyName
    || opportunity.agencyName
    || "Agency name unavailable";
  const daysRemaining = getDaysRemaining(opportunity.closeDateIso);
  const matchedKeywords = Array.isArray(opportunity.matchedKeywords)
    ? opportunity.matchedKeywords
    : [];
  const displayKeyword = matchedKeywords[0] || "No keyword";
  const matchScore = getMatchScore(opportunity, matchedKeywords);
  const statusValue = opportunity.opportunityStatus || "unknown";
  const statusLabel = capitalize(statusValue);
  const daysClass = getDaysClass(daysRemaining);
  const daysLabel = getDaysLabel(daysRemaining);

  return {
    ...opportunity,
    key,
    agencyDisplayName,
    fundingAmountValue,
    daysRemaining,
    daysClass,
    daysLabel,
    displayKeyword,
    matchScore,
    statusValue,
    statusLabel
  };
}

function updateAgencyFilterOptions() {
  const currentValue = state.viewFilters.agency;
  const options = Array.from(
    new Set(
      state.results
        .map((opportunity) => opportunity.agencyCode)
        .filter(Boolean)
    )
  ).sort((left, right) => left.localeCompare(right));

  agencyFilter.innerHTML = [
    '<option value="all">All agencies</option>',
    ...options.map((agency) => `<option value="${escapeHtml(agency)}">${escapeHtml(agency)}</option>`)
  ].join("");

  if (options.includes(currentValue)) {
    agencyFilter.value = currentValue;
  } else {
    state.viewFilters.agency = "all";
    agencyFilter.value = "all";
  }
}

function syncQueryInputs() {
  const config = readQueryInputs();
  queryInputs.keywords.value = config.keywords.join("\n");
  queryInputs.recentDays.value = config.recentDays ?? "";
  queryInputs.rows.value = config.rows ?? DEFAULT_PAGE_SIZE;
  queryInputs.oppNum.value = config.oppNum;
  queryInputs.agencies.value = config.agencies;
  queryInputs.aln.value = config.aln;
  queryInputs.eligibilities.value = config.eligibilities;
  queryInputs.fundingCategories.value = config.fundingCategories;
  queryInputs.fundingInstruments.value = config.fundingInstruments;
  queryInputs.includeRaw.checked = config.includeRaw;
}

function syncViewFilterInputs() {
  syncQuickSearchInputs(state.viewFilters.search);
  statusFilter.value = state.viewFilters.status;
  closingWindowFilter.value = state.viewFilters.closingWindow;
  sortFilter.value = state.viewFilters.sortBy;
  savedViewSelect.value = state.savedView;
  pageSizeSelect.value = String(state.pageSize);
}

function syncQuickSearchInputs(value) {
  if (globalSearchInput.value !== value) {
    globalSearchInput.value = value;
  }
  if (toolbarSearchInput.value !== value) {
    toolbarSearchInput.value = value;
  }
}

function handleQuickSearchInput(event) {
  const value = event.currentTarget.value;
  state.viewFilters.search = value;
  state.page = 1;
  syncQuickSearchInputs(value);
  renderApp();
}

function handleTableActionClick(event) {
  const bookmarkButton = event.target.closest("[data-bookmark-key]");
  if (bookmarkButton) {
    const key = bookmarkButton.dataset.bookmarkKey;
    if (!key) {
      return;
    }

    if (state.savedKeys.has(key)) {
      state.savedKeys.delete(key);
    } else {
      state.savedKeys.add(key);
    }
    saveSavedKeys();
    renderApp();
    return;
  }

  const checkbox = event.target.closest("[data-row-select-key]");
  if (checkbox) {
    const key = checkbox.dataset.rowSelectKey;
    if (!key) {
      return;
    }

    if (checkbox.checked) {
      state.selectedKeys.add(key);
    } else {
      state.selectedKeys.delete(key);
    }
    renderApp();
  }
}

function enrichVisibleRows() {
  if (state.loading || state.errorMessage || state.activeNav === "sources") {
    return;
  }

  const viewModel = buildViewModel();
  viewModel.pageRows
    .filter((row) => row.id !== null && row.id !== undefined)
    .forEach((row) => {
      const id = String(row.id);

      if (state.detailsCache.has(id) || state.detailRequests.has(id)) {
        return;
      }

      const request = fetch(`/api/opportunities/${id}`)
        .then((response) => response.json())
        .then((payload) => {
          if (payload?.success && payload.opportunity) {
            state.detailsCache.set(id, payload.opportunity);
            renderApp();
          }
        })
        .catch(() => {
          return null;
        })
        .finally(() => {
          state.detailRequests.delete(id);
        });

      state.detailRequests.set(id, request);
    });
}

function exportVisibleRows() {
  const viewModel = buildViewModel();
  const rows = viewModel.filteredRows;

  if (rows.length === 0) {
    return;
  }

  const header = [
    "Opportunity title",
    "Opportunity number",
    "Agency code",
    "Agency name",
    "Funding amount",
    "Open date",
    "Close date",
    "Days left",
    "Status",
    "Match score",
    "Matched keyword"
  ];

  const lines = [
    header.join(","),
    ...rows.map((row) => [
      csvEscape(row.opportunityTitle),
      csvEscape(row.opportunityNumber || ""),
      csvEscape(row.agencyCode || ""),
      csvEscape(row.agencyDisplayName),
      csvEscape(row.fundingAmountValue !== null ? formatCurrency(row.fundingAmountValue) : "Not listed"),
      csvEscape(row.openDate || ""),
      csvEscape(row.closeDate || ""),
      csvEscape(row.daysLabel),
      csvEscape(row.statusLabel),
      csvEscape(`${row.matchScore}%`),
      csvEscape(row.displayKeyword)
    ].join(","))
  ];

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "grant-scout-export.csv";
  link.click();
  URL.revokeObjectURL(link.href);
}

function applyScenarioDefaults() {
  queryInputs.keywords.value = [
    "artificial intelligence",
    "machine learning",
    "data analyst",
    "software engineer"
  ].join("\n");
  queryInputs.recentDays.value = "30";
  queryInputs.rows.value = "10";
  queryInputs.oppNum.value = "";
  queryInputs.agencies.value = "";
  queryInputs.aln.value = "";
  queryInputs.eligibilities.value = "";
  queryInputs.fundingCategories.value = "";
  queryInputs.fundingInstruments.value = "";
  queryInputs.includeRaw.checked = false;
  queryInputs.statuses.forEach((input) => {
    input.checked = input.value === "posted";
  });
}

function clearQueryInputs() {
  queryInputs.keywords.value = "";
  queryInputs.recentDays.value = "30";
  queryInputs.rows.value = "10";
  queryInputs.oppNum.value = "";
  queryInputs.agencies.value = "";
  queryInputs.aln.value = "";
  queryInputs.eligibilities.value = "";
  queryInputs.fundingCategories.value = "";
  queryInputs.fundingInstruments.value = "";
  queryInputs.includeRaw.checked = false;
  queryInputs.statuses.forEach((input) => {
    input.checked = input.value === "posted";
  });
}

function readQueryInputs() {
  return {
    keywords: getNormalizedKeywords(queryInputs.keywords.value),
    recentDays: toNumberOrNull(queryInputs.recentDays.value),
    rows: toNumberOrNull(queryInputs.rows.value) || 10,
    oppStatuses: queryInputs.statuses.filter((input) => input.checked).map((input) => input.value),
    oppNum: queryInputs.oppNum.value.trim(),
    agencies: queryInputs.agencies.value.trim(),
    aln: queryInputs.aln.value.trim(),
    eligibilities: queryInputs.eligibilities.value.trim(),
    fundingCategories: queryInputs.fundingCategories.value.trim(),
    fundingInstruments: queryInputs.fundingInstruments.value.trim(),
    includeRaw: queryInputs.includeRaw.checked
  };
}

function getEffectiveDrawerCollapsed() {
  return !state.mobileViewport && state.drawerCollapsed;
}

function getOpportunityKey(opportunity) {
  return String(
    opportunity.id
    ?? opportunity.opportunityNumber
    ?? opportunity.opportunityTitle
  );
}

function getFundingAmount(opportunityDetails) {
  if (!opportunityDetails) {
    return null;
  }

  if (typeof opportunityDetails.awardCeiling === "number") {
    return opportunityDetails.awardCeiling;
  }

  if (typeof opportunityDetails.awardFloor === "number") {
    return opportunityDetails.awardFloor;
  }

  return null;
}

function getDaysRemaining(closeDateIso) {
  if (!closeDateIso) {
    return null;
  }

  const now = new Date("2026-08-12T12:00:00Z");
  const closeDate = new Date(`${closeDateIso}T23:59:59Z`);
  const diff = Math.ceil((closeDate.getTime() - now.getTime()) / 86400000);
  return Number.isFinite(diff) ? diff : null;
}

function getDaysClass(daysRemaining) {
  if (daysRemaining === null) {
    return "is-neutral";
  }

  if (daysRemaining <= 21) {
    return "is-amber";
  }

  if (daysRemaining >= 60) {
    return "is-green";
  }

  return "is-neutral";
}

function getDaysLabel(daysRemaining) {
  if (daysRemaining === null) {
    return "—";
  }

  if (daysRemaining < 0) {
    return "Closed";
  }

  return String(daysRemaining);
}

function getMatchScore(opportunity, matchedKeywords) {
  const title = String(opportunity.opportunityTitle || "").toLowerCase();
  const keywordHits = matchedKeywords.reduce(
    (count, keyword) => count + (title.includes(keyword.toLowerCase()) ? 1 : 0),
    0
  );
  const base = 80 + matchedKeywords.length * 4 + keywordHits * 6;
  return Math.min(99, Math.max(72, base));
}

function getEmptyStateMessage() {
  const queryKeywords = readQueryInputs().keywords.length;

  if (queryKeywords === 0) {
    return "Add keywords in the drawer and run Search to begin.";
  }

  if (state.activeNav === "saved") {
    return "No saved grants yet. Bookmark opportunities to see them here.";
  }

  if (state.savedView === "saved") {
    return "No saved grants match the current filters.";
  }

  return "No opportunities match the current filters. Try broader keywords or a larger closing window.";
}

function setPaginationDisabled(disabled, viewModel = null) {
  if (disabled) {
    pageFirstButton.disabled = true;
    pagePrevButton.disabled = true;
    pageNextButton.disabled = true;
    pageLastButton.disabled = true;
    return;
  }

  pageFirstButton.disabled = viewModel.currentPage === 1;
  pagePrevButton.disabled = viewModel.currentPage === 1;
  pageNextButton.disabled = viewModel.currentPage === viewModel.totalPages;
  pageLastButton.disabled = viewModel.currentPage === viewModel.totalPages;
}

function sortRows(rows, sortBy) {
  const sortedRows = [...rows];

  switch (sortBy) {
    case "agencyAz":
      sortedRows.sort((left, right) =>
        String(left.agencyCode || "").localeCompare(String(right.agencyCode || ""))
      );
      return sortedRows;
    case "recentlyOpened":
      sortedRows.sort((left, right) =>
        compareDatesDesc(left.openDateIso, right.openDateIso)
      );
      return sortedRows;
    case "matchHighest":
      sortedRows.sort((left, right) => right.matchScore - left.matchScore);
      return sortedRows;
    case "fundingHighest":
      sortedRows.sort((left, right) => (right.fundingAmountValue || 0) - (left.fundingAmountValue || 0));
      return sortedRows;
    case "daysLeft":
      sortedRows.sort((left, right) => compareNullableNumberAsc(left.daysRemaining, right.daysRemaining));
      return sortedRows;
    case "titleAz":
      sortedRows.sort((left, right) =>
        String(left.opportunityTitle || "").localeCompare(String(right.opportunityTitle || ""))
      );
      return sortedRows;
    case "closingSoonest":
    default:
      sortedRows.sort((left, right) => compareDatesAsc(left.closeDateIso, right.closeDateIso));
      return sortedRows;
  }
}

function compareDatesAsc(left, right) {
  const leftValue = left ? Date.parse(`${left}T00:00:00Z`) : Number.POSITIVE_INFINITY;
  const rightValue = right ? Date.parse(`${right}T00:00:00Z`) : Number.POSITIVE_INFINITY;
  return leftValue - rightValue;
}

function compareDatesDesc(left, right) {
  const leftValue = left ? Date.parse(`${left}T00:00:00Z`) : 0;
  const rightValue = right ? Date.parse(`${right}T00:00:00Z`) : 0;
  return rightValue - leftValue;
}

function compareNullableNumberAsc(left, right) {
  if (left === null && right === null) {
    return 0;
  }
  if (left === null) {
    return 1;
  }
  if (right === null) {
    return -1;
  }
  return left - right;
}

function createMetricMarkup(value, label) {
  return `
    <div class="metric-item">
      <strong>${escapeHtml(String(value))}</strong>
      <span>${escapeHtml(label)}</span>
    </div>
  `;
}

function renderBookmarkIcon(saved) {
  return `
    <svg viewBox="0 0 20 20" focusable="false" class="bookmark-icon ${saved ? "is-filled" : ""}">
      <path d="M6 3.5h8a1.5 1.5 0 0 1 1.5 1.5v11l-5.5-3l-5.5 3V5A1.5 1.5 0 0 1 6 3.5Z" />
    </svg>
  `;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function getNormalizedKeywords(value) {
  return value
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function toNumberOrNull(value) {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function csvEscape(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function loadSavedKeys() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.savedRows);
    if (!raw) {
      return new Set();
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed) : new Set();
  } catch {
    return new Set();
  }
}

function saveSavedKeys() {
  localStorage.setItem(
    STORAGE_KEYS.savedRows,
    JSON.stringify(Array.from(state.savedKeys))
  );
}

function getInitialDrawerState() {
  const storedValue = sessionStorage.getItem(STORAGE_KEYS.drawerCollapsed);
  if (storedValue === null) {
    return window.innerWidth <= COMPACT_BREAKPOINT;
  }

  return storedValue === "true";
}
