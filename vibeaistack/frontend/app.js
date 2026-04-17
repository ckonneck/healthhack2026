(() => {
  const navigationItems = [
    { key: "search", href: "/index.html", label: "Service search" },
    { key: "survey", href: "/form.html", label: "Get guidance" },
    { key: "add", href: "/providers.html", label: "For providers" }
  ];

  const loaderState = {
    element: null,
    messageElement: null,
    isVisible: false
  };

  function joinClasses(...values) {
    return values.filter(Boolean).join(" ");
  }

  function renderNavigation(currentNav, navigationLabels = {}) {
    return `
      <nav class="nav-links page-header__nav" aria-label="Primary">
        ${navigationItems.map(item => `
          <a class="nav-link" ${item.key === currentNav ? 'aria-current="page"' : ""} href="${item.href}">
            ${navigationLabels[item.key] || item.label}
          </a>
        `).join("")}
      </nav>
    `;
  }

  // Shared page header used across the static pages.
  function renderPageHeader({
    eyebrow = "Care Compass",
    title,
    description = "",
    currentNav,
    navigationLabels = {},
    compact = false,
    titleTag = "h1",
    titleClass = "brand-title"
  }) {
    const titleMarkup = `<${titleTag} class="${joinClasses("page-header__title", titleClass)}">${title}</${titleTag}>`;
    const descriptionMarkup = description
      ? `<p class="page-header__description brand-subtitle">${description}</p>`
      : "";

    return `
      <div class="page-header__content ${compact ? "site-ident" : "brand-block"}">
        <p class="eyebrow">${eyebrow}</p>
        ${titleMarkup}
        ${descriptionMarkup}
      </div>
      ${renderNavigation(currentNav, navigationLabels)}
    `;
  }

  function renderEmptyState({ title, message, className = "" }) {
    return `
      <div class="${joinClasses("card", "card-stack", "empty-state", className)}" role="status">
        <div class="empty-state__title empty-title">${title}</div>
        <p class="empty-state__copy empty-copy">${message}</p>
      </div>
    `;
  }

  function renderMetaStack(lines, emptyMessage = "") {
    const items = Array.isArray(lines) ? lines.filter(Boolean) : [];
    const rows = items.length ? items : emptyMessage ? [emptyMessage] : [];

    return `
      <div class="card-meta meta-stack">
        ${rows.map(line => `<p class="meta-row">${line}</p>`).join("")}
      </div>
    `;
  }

  function renderTagList(tags) {
    const items = Array.isArray(tags) ? tags.filter(Boolean) : [];

    if (!items.length) {
      return "";
    }

    return `
      <div class="tag-list">
        ${items.map(tag => `<span class="tag">${tag}</span>`).join("")}
      </div>
    `;
  }

  // Small progress shell for step-based flows.
  function renderProgressIndicator({
    eyebrow = "Guided Intake",
    currentStep = 1,
    totalSteps = 1,
    labelId,
    fillId
  }) {
    const safeTotal = Math.max(totalSteps, 1);
    const progress = `${(currentStep / safeTotal) * 100}%`;

    return `
      <div class="progress-indicator survey-progress-block">
        <div class="progress-indicator__header survey-progress-top">
          <p class="eyebrow">${eyebrow}</p>
          <p id="${labelId}" class="progress-indicator__label survey-step-label">Step ${currentStep} of ${safeTotal}</p>
        </div>
        <div class="progress-indicator__track survey-progress-bar" aria-hidden="true">
          <span id="${fillId}" class="progress-indicator__fill survey-progress-fill" style="width: ${progress};"></span>
        </div>
      </div>
    `;
  }

  // Shared radio-tile pattern for survey choices.
  function renderOptionTileGroup({
    label,
    name,
    hint = "",
    ariaLabel,
    options = []
  }) {
    return `
      <div class="option-group choice-group">
        <span class="field-label">${label}</span>
        <div class="option-grid choice-grid" role="radiogroup" aria-label="${ariaLabel || label}">
          ${options.map(option => `
            <label class="option choice-option">
              <input class="option-input choice-input" type="radio" name="${name}" value="${option.value}" ${option.disabled ? "disabled" : ""} />
              <span class="option-tile choice-card">
                <span class="option-tile__title choice-title">${option.label}</span>
                ${option.description ? `<span class="option-tile__description">${option.description}</span>` : ""}
              </span>
            </label>
          `).join("")}
        </div>
        ${hint ? `<p class="field-hint">${hint}</p>` : ""}
      </div>
    `;
  }

  function ensureGlobalLoader() {
    if (loaderState.element) {
      return loaderState.element;
    }

    const existingLoader = document.getElementById("globalPageLoader");

    if (existingLoader) {
      loaderState.element = existingLoader;
      loaderState.messageElement = existingLoader.querySelector("[data-loader-message]");
      return existingLoader;
    }

    const loader = document.createElement("div");
    loader.id = "globalPageLoader";
    loader.className = "global-loader";
    loader.setAttribute("aria-hidden", "true");
    loader.innerHTML = `
      <div class="global-loader__panel" role="status" aria-live="polite" aria-atomic="true">
        <div class="global-loader__frame" aria-hidden="true">
          <span class="global-loader__ring"></span>
          <img class="global-loader__logo" src="/public/logo.svg" alt="" />
        </div>
        <p class="global-loader__message" data-loader-message>Loading Care Compass...</p>
      </div>
    `;

    document.body.appendChild(loader);
    loaderState.element = loader;
    loaderState.messageElement = loader.querySelector("[data-loader-message]");
    return loader;
  }

  function showGlobalLoader(options = {}) {
    const { message = "Loading Care Compass..." } = options;
    const loader = ensureGlobalLoader();

    if (loaderState.messageElement) {
      loaderState.messageElement.textContent = message;
    }

    loader.classList.add("is-visible");
    loader.setAttribute("aria-hidden", "false");
    document.body.classList.add("has-global-loader");
    loaderState.isVisible = true;
  }

  function hideGlobalLoader() {
    if (!loaderState.isVisible) {
      return;
    }

    const loader = ensureGlobalLoader();
    loader.classList.remove("is-visible");
    loader.setAttribute("aria-hidden", "true");
    document.body.classList.remove("has-global-loader");
    loaderState.isVisible = false;
  }

  async function withGlobalLoader(task, options = {}) {
    const {
      message = "Loading Care Compass...",
      delayMs = 320
    } = options;
    let shouldShow = true;
    const showTimer = window.setTimeout(() => {
      if (shouldShow) {
        showGlobalLoader({ message });
      }
    }, Math.max(0, delayMs));

    try {
      return await task();
    } finally {
      shouldShow = false;
      window.clearTimeout(showTimer);
      hideGlobalLoader();
    }
  }

  window.CareCompassUI = {
    renderEmptyState,
    renderMetaStack,
    renderOptionTileGroup,
    renderPageHeader,
    renderProgressIndicator,
    renderTagList,
    showGlobalLoader,
    hideGlobalLoader,
    withGlobalLoader
  };
})();