(function () {
    "use strict";

    var admin = document.getElementById("mycompany-admin");
    var tabs = admin && admin.querySelector(".mc-admin-tabs");
    var content = document.getElementById("mycompany-admin-content");
    if (!admin || !tabs || !content) return;

    var STORAGE_COLLAPSED = "mycompany.admin.managementCollapsed";
    var shell = document.createElement("div");
    var toolbarHost = document.createElement("div");
    var toolbar = document.createElement("div");
    var workspace = document.createElement("div");
    var layout = document.createElement("div");
    var middle = document.createElement("div");

    shell.className = "mc-admin-shell mc-admin-management-shell mc-portal-module-shell mc-portal-module-admin";
    toolbarHost.className = "mc-portal-module-toolbar";
    toolbar.className = "mc-admin-management-toolbar mc-shared-toolbar mc-portal-toolbar";
    workspace.className = "mc-portal-module-workspace";
    layout.className = "mc-admin-management-layout mc-portal-module-layout";
    tabs.classList.add("mc-portal-module-primary");
    middle.className = "mc-admin-middle mc-portal-module-secondary";
    content.classList.add("mc-portal-module-details");

    admin.insertBefore(shell, tabs);
    shell.appendChild(toolbarHost);
    toolbarHost.appendChild(toolbar);
    shell.appendChild(workspace);
    workspace.appendChild(layout);
    layout.appendChild(tabs);
    layout.appendChild(middle);
    layout.appendChild(content);

    try {
        if (new URL(window.location.href).searchParams.get("portal") === "1") {
            admin.classList.add("mc-admin-portal-embedded");
            document.documentElement.classList.add("mc-portal-admin-document");
        }
    } catch (error) {}

    function svg(path) {
        return '<svg viewBox="0 0 24 24" aria-hidden="true">' + path + "</svg>";
    }

    var icons = {
        overview: svg('<path d="M4 5h16v14H4z"/><path d="M8 9h8M8 13h8"/>'),
        settings: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/>'),
        plugins: svg('<path d="M8 3v4M16 3v4M5 7h14v5a7 7 0 0 1-14 0V7Z"/><path d="M12 19v3"/>'),
        server: svg('<rect x="4" y="3" width="16" height="7" rx="1"/><rect x="4" y="14" width="16" height="7" rx="1"/><path d="M7 6.5h.01M7 17.5h.01M10 6.5h7M10 17.5h7"/>'),
        debug: svg('<path d="M9 9h6v9a3 3 0 0 1-6 0V9Z"/><path d="M10 5h4l1 4H9l1-4ZM4 13h5M15 13h5M6 8l3 3M18 8l-3 3M6 18h3M15 18h3"/>'),
        portal: svg('<path d="M4 5h16v14H4z"/><path d="M4 9h16M8 9v10"/>'),
        approvalcenter: svg('<circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16.5 9"/>'),
        moverequests: svg('<path d="M5 7h12l-3-3m3 3-3 3M19 17H7l3 3m-3-3 3-3"/>'),
        mycommands: svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m7 10 3 2-3 2m5 1h5"/>'),
        myscripts: svg('<path d="M6 3h9l3 3v15H6z"/><path d="M9 11h6m-6 4h6"/>'),
        folderpermissions: svg('<path d="M3 6h6l2 2h10v11H3V6Z"/><path d="M12 12h6M15 9v6"/>'),
        myjira: svg('<path d="m12 3 8 8-8 10-8-10 8-8Z"/><path d="m9 11 3 3 3-3"/>'),
        defendertools: svg('<path d="M12 3 4 6v6c0 5 3.4 8 8 9 4.6-1 8-4 8-9V6l-8-3Z"/><path d="m8.5 12 2.3 2.3 4.7-5"/>'),
        config: svg('<path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h8M8 16h5"/>'),
        logs: svg('<path d="M6 3h9l3 3v15H6z"/><path d="M9 11h6M9 15h6"/>'),
        errors: svg('<path d="M12 3 2.8 20h18.4L12 3Z"/><path d="M12 9v5M12 17h.01"/>')
    };

    function toolButton(action, title, icon) {
        var button = document.createElement("button");
        button.type = "button";
        button.className = "mc-admin-management-tool mc-shared-toolbar-button mc-portal-toolbar-button";
        button.setAttribute("data-admin-tool", action);
        button.title = title;
        button.setAttribute("aria-label", title);
        button.innerHTML = '<span class="mc-shared-toolbar-icon mc-portal-toolbar-icon">' + icon + "</span>";
        toolbar.appendChild(button);
        return button;
    }

    var collapse = toolButton("collapse", "Zwiń menu", svg('<path d="m15 18-6-6 6-6"/>'));
    var refresh = toolButton("refresh", "Odśwież", svg('<path d="M20 6v5h-5M4 18v-5h5"/><path d="M6.1 8A7 7 0 0 1 18 6l2 5M4 13l2 5a7 7 0 0 0 11.9-2"/>'));
    var search = toolButton("search", "Szukaj ustawienia", svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>'));
    var searchBox = document.createElement("label");
    searchBox.className = "mc-admin-management-search mc-shared-toolbar-search";
    searchBox.hidden = true;
    searchBox.innerHTML = '<span class="sr-only">Szukaj ustawienia</span><input class="mc-portal-filter" type="search" placeholder="Szukaj sekcji…">';
    toolbar.appendChild(searchBox);

    function isCollapsed() {
        try { return window.localStorage.getItem(STORAGE_COLLAPSED) === "1"; }
        catch (error) { return false; }
    }

    function setCollapsed(value) {
        value = value === true;
        shell.classList.toggle("is-collapsed", value);
        layout.classList.toggle("is-collapsed", value);
        collapse.querySelector(".mc-shared-toolbar-icon").innerHTML = value
            ? svg('<path d="m9 18 6-6-6-6"/>')
            : svg('<path d="m15 18-6-6 6-6"/>');
        collapse.title = value ? "Rozwiń menu" : "Zwiń menu";
        collapse.setAttribute("aria-label", collapse.title);
        try { window.localStorage.setItem(STORAGE_COLLAPSED, value ? "1" : "0"); } catch (error) {}
    }

    function decorateButton(button, key) {
        if (!button) return;
        button.classList.add("mc-portal-nav-item");
        if (button.querySelector(".mc-admin-management-item-icon")) return;
        var label = document.createElement("span");
        label.className = "mc-admin-management-item-label mc-portal-nav-label";
        label.textContent = button.textContent.trim();
        button.textContent = "";
        var icon = document.createElement("span");
        icon.className = "mc-admin-management-item-icon mc-portal-nav-icon";
        icon.innerHTML = icons[key] || icons.settings;
        button.appendChild(icon);
        button.appendChild(label);
        button.title = label.textContent;
    }

    function decorateNavigation() {
        tabs.querySelectorAll("[data-tab]").forEach(function (button) {
            decorateButton(button, button.getAttribute("data-tab"));
        });
        middle.querySelectorAll("[data-settings-key]").forEach(function (button) {
            decorateButton(button, button.getAttribute("data-settings-key"));
        });
        middle.querySelectorAll("[data-debug-key]").forEach(function (button) {
            decorateButton(button, button.getAttribute("data-debug-key"));
        });
    }

    function activeTab() {
        var activeButton = tabs.querySelector("[data-tab].active");
        return activeButton ? activeButton.getAttribute("data-tab") : "overview";
    }

    function cleanApprovalProviderOptions() {
        var header = content.querySelector(".mc-admin-section-header h3");
        if (!header || header.textContent.trim() !== "Approval Center") return;
        content.querySelectorAll(".mc-admin-card").forEach(function (card) {
            var title = card.querySelector("h3");
            if (!title || ["Move Requests", "My Commands", "Scripts"].indexOf(title.textContent.trim()) < 0) return;
            card.querySelectorAll(".mc-admin-check").forEach(function (field) {
                var label = field.querySelector("strong");
                if (label && ["Provider enabled", "Show in Requests", "Show in Overview"].indexOf(label.textContent.trim()) >= 0) field.remove();
            });
        });
    }

    function applySearch() {
        var query = String(searchBox.querySelector("input").value || "").trim().toLocaleLowerCase();
        [tabs, middle].forEach(function (host) {
            host.querySelectorAll("button").forEach(function (button) {
                var label = button.querySelector(".mc-admin-management-item-label");
                button.hidden = !!query && (!label || label.textContent.toLocaleLowerCase().indexOf(query) < 0);
            });
        });
    }

    function relocateNavigation() {
        var active = activeTab();
        var selector = active === "settings"
            ? ".mc-admin-settings-nav:not(.mc-admin-debug-nav)"
            : active === "debug" ? ".mc-admin-debug-nav" : "";
        var navigation = selector ? (content.querySelector(selector) || middle.querySelector(selector)) : null;

        middle.innerHTML = "";
        if (navigation) {
            navigation.classList.add("mc-admin-section-nav");
            middle.appendChild(navigation);
        }
        middle.hidden = !navigation;
        shell.classList.toggle("has-middle", !!navigation);
        shell.setAttribute("data-admin-view", active);
        shell.style.setProperty("--portal-secondary-width", navigation ? "236px" : "0px");

        var settingsLayout = content.querySelector(".mc-admin-settings-layout");
        if (settingsLayout) settingsLayout.classList.add("mc-admin-settings-layout-single");
        cleanApprovalProviderOptions();
        decorateNavigation();
        applySearch();

        if (window.MyCompanyPortalUiContract && typeof window.MyCompanyPortalUiContract.refresh === "function") {
            window.MyCompanyPortalUiContract.refresh();
        }
    }

    collapse.onclick = function () { setCollapsed(!layout.classList.contains("is-collapsed")); };
    refresh.onclick = function () { window.location.reload(); };
    search.onclick = function () {
        searchBox.hidden = !searchBox.hidden;
        search.classList.toggle("is-active", !searchBox.hidden);
        if (!searchBox.hidden) searchBox.querySelector("input").focus();
    };
    searchBox.querySelector("input").addEventListener("input", applySearch);

    tabs.addEventListener("click", function () { window.setTimeout(relocateNavigation, 0); });
    new MutationObserver(relocateNavigation).observe(content, { childList: true, subtree: true });
    setCollapsed(isCollapsed());
    relocateNavigation();
}());
