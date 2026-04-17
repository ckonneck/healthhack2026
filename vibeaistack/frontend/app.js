(() => {
  const navigationItems = [
    { key: "search", href: "/index.html", label: "Service search" },
    { key: "survey", href: "/form.html", label: "Health check" },
    { key: "add", href: "/providers.html", label: "For providers" }
  ];

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

  window.CareCompassUI = {
    renderEmptyState,
    renderMetaStack,
    renderOptionTileGroup,
    renderPageHeader,
    renderProgressIndicator,
    renderTagList
  };
})();
