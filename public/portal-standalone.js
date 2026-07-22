(function () {
    "use strict";

    var core = window.MyCompanyCore;
    var root = document.getElementById("sirkStandaloneRoot");
    var content = document.getElementById("sirkStandaloneContent");
    var title = document.getElementById("sirkStandaloneTitle");
    var bootstrap = null;
    var initialized = Object.create(null);
    var viewNames = {
        overview: "Przegląd",
        devices: "Urządzenia",
        approvals: "Akceptacje",
        automation: "Automatyzacja",
        monitoring: "Monitoring",
        assets: "Zasoby",
        management: "Zarządzanie",
        reports: "Raporty",
        security: "Security",
        settings: "Ustawienia"
    };

    function asset(name) {
        var base = String(window.__MYCOMPANY_ASSET_BASE__ || "").replace(/\/$/, "");
        return base + "/" + name + "?v=" + encodeURIComponent(window.__MYCOMPANY_PORTAL_VERSION__ || "1");
    }

    function load(id, name) {
        return core.loadScript(id, asset(name));
    }

    function moduleState(key) {
        return bootstrap && bootstrap.modules && bootstrap.modules[key] || null;
    }

    function moduleAllowed(key) {
        var state = moduleState(key);
        return !!(state && state.enabled && state.ready !== false && (!state.access || state.access.allowed !== false));
    }

    function error(message) {
        content.innerHTML = "";
        var box = document.createElement("div");
        box.className = "sirk-standalone-error";
        box.textContent = String(message || "Nieznany błąd Portalu.");
        content.appendChild(box);
    }

    function placeholder(view, description) {
        content.innerHTML = '<div class="sirk-standalone-card sirk-standalone-placeholder"><h2>' + viewNames[view] + '</h2><p>' + description + '</p></div>';
    }

    function overview() {
        var devices = bootstrap && bootstrap.summary && bootstrap.summary.devices;
        content.innerHTML = [
            '<div class="sirk-standalone-grid">',
            '<section class="sirk-standalone-card"><h2>Urządzenia</h2><p>' + (devices != null ? devices : "Dane urządzeń będą pobierane przez API Portalu.") + '</p></section>',
            '<section class="sirk-standalone-card"><h2>Akceptacje</h2><p>Move Requests, Commands i Scripts wymagające zatwierdzenia.</p></section>',
            '<section class="sirk-standalone-card"><h2>Integracje</h2><p>Jira, Zabbix, Defender XDR, Entra i automatyzacja.</p></section>',
            '</div>'
        ].join("");
    }

    function initializeModule(key) {
        if (initialized[key]) return initialized[key];
        var module = window.MyCompanyModules && window.MyCompanyModules[key];
        if (!module) return Promise.reject(new Error("Moduł " + key + " nie został załadowany."));
        initialized[key] = Promise.resolve(typeof module.initialize === "function" ? module.initialize(moduleState(key) || {}) : null);
        return initialized[key];
    }

    function management() {
        if (!moduleAllowed("myscripts")) {
            error("MyScripts jest wyłączony albo użytkownik nie ma dostępu.");
            return;
        }
        content.innerHTML = "";
        var host = document.createElement("div");
        host.className = "mycompany-management-host";
        content.appendChild(host);
        if (!window.MyCompanyPortalManagement || typeof window.MyCompanyPortalManagement.mount !== "function") {
            error("Renderer Zarządzania nie został załadowany.");
            return;
        }
        window.MyCompanyPortalManagement.mount(host);
    }

    function approvals() {
        if (!moduleAllowed("approvalcenter")) {
            error("Approval Center jest wyłączony albo użytkownik nie ma dostępu.");
            return;
        }
        content.innerHTML = "";
        initializeModule("approvalcenter").then(function () {
            var module = window.MyCompanyModules.approvalcenter;
            if (!module || typeof module.mount !== "function") throw new Error("Approval Center nie udostępnia widoku Portalu.");
            module.mount(content, "sirk-standalone-approval");
        }).catch(function (reason) { error(reason.message || reason); });
    }

    function settings() {
        var access = moduleState("portal") && moduleState("portal").access;
        if (!access || access.siteAdmin !== true) {
            error("Ustawienia są dostępne tylko dla Site Admin.");
            return;
        }
        content.innerHTML = "";
        var frame = document.createElement("iframe");
        frame.className = "sirk-standalone-settings-frame";
        frame.title = "MyCompany settings";
        var url = new URL(window.__MYCOMPANY_API_BASE__, window.location.href);
        url.searchParams.set("pin", "MyCompany");
        frame.src = url.href;
        content.appendChild(frame);
    }

    function devices() {
        content.innerHTML = '<div class="sirk-standalone-card sirk-standalone-placeholder"><h2>Urządzenia</h2><p>Warstwa urządzeń jest migrowana do niezależnego API Portalu. Do czasu zakończenia migracji pełny pulpit, terminal i pliki są dostępne przez MeshCentral.</p><p><a href="' + String(window.__MYCOMPANY_NATIVE_URL__ || "#") + '">Otwórz MeshCentral</a></p></div>';
    }

    function render(view) {
        view = viewNames[view] ? view : "overview";
        title.textContent = viewNames[view];
        Array.prototype.forEach.call(document.querySelectorAll(".sirk-standalone-nav [data-view]"), function (button) {
            button.classList.toggle("is-active", button.getAttribute("data-view") === view);
        });
        if (view === "overview") overview();
        else if (view === "management") management();
        else if (view === "approvals") approvals();
        else if (view === "settings") settings();
        else if (view === "devices") devices();
        else placeholder(view, "Moduł będzie podłączony do niezależnego API MyCompany bez zależności od starego WebUI.");
        if (window.location.hash !== "#" + view) history.replaceState(null, "", "#" + view);
    }

    function bind() {
        root.addEventListener("click", function (event) {
            var nav = event.target.closest("[data-view]");
            if (nav && root.contains(nav)) {
                render(nav.getAttribute("data-view"));
                return;
            }
            var collapse = event.target.closest('[data-action="sidebar"]');
            if (collapse) {
                var value = !root.classList.contains("is-collapsed");
                root.classList.toggle("is-collapsed", value);
                collapse.textContent = value ? "›" : "‹";
                try { localStorage.setItem("mycompany.sirkportal.standaloneCollapsed", value ? "1" : "0"); } catch (ignored) {}
            }
        });
        try {
            if (localStorage.getItem("mycompany.sirkportal.standaloneCollapsed") === "1") {
                root.classList.add("is-collapsed");
                root.querySelector('[data-action="sidebar"]').textContent = "›";
            }
        } catch (ignored) {}
        window.addEventListener("hashchange", function () { render(location.hash.slice(1)); });
    }

    function loadDependencies() {
        var files = [
            ["sirk-shared-toolbar-config", "shared-ui/toolbar-config.js"],
            ["sirk-shared-toolbar-api", "shared-ui/toolbar-api.js"],
            ["sirk-shared-toolbar", "shared-ui/toolbar.js"],
            ["sirk-shared-tabs", "shared-ui/tabs.js"],
            ["sirk-shared-layout", "shared-ui/layout.js"],
            ["sirk-shared-settings", "shared-ui/settings.js"],
            ["sirk-shared-status-nav", "shared-ui/status-nav.js"],
            ["sirk-shared-page", "shared-ui/page.js"],
            ["sirk-shared-tree", "shared-ui/tree.js"],
            ["sirk-shared-results", "shared-ui/results.js"],
            ["sirk-shared-result-layout", "shared-ui/result-layout.js"],
            ["sirk-shared-script-tools", "shared-ui/script-tools.js"],
            ["sirk-shared-script-definition", "shared-ui/script-definition-form.js"],
            ["sirk-shared-confirm", "shared-ui/confirm-execution-form.js"],
            ["sirk-shared-edit-actions", "shared-ui/script-edit-actions.js"],
            ["sirk-shared-system-credentials", "shared-ui/system-credentials-form.js"],
            ["sirk-module-shell", "module-shell.js"],
            ["sirk-icon-data", "portal-icon-data.js"],
            ["sirk-approval-module", "approvalcenter.js"],
            ["sirk-management-renderer", "portal-management.js"],
            ["sirk-subfolder-icons", "portal-subfolder-icons.js"],
            ["sirk-folder-collapse", "portal-folder-collapse.js"]
        ];
        var chain = Promise.resolve();
        files.forEach(function (entry) { chain = chain.then(function () { return load(entry[0], entry[1]); }); });
        return chain;
    }

    function start() {
        bind();
        core.api("", "bootstrap").then(function (value) {
            bootstrap = value || {};
            window.MyCompanyRuntime = window.MyCompanyRuntime || { state: {} };
            window.MyCompanyRuntime.state = window.MyCompanyRuntime.state || {};
            window.MyCompanyRuntime.state.bootstrap = bootstrap;
            bootstrap.access = bootstrap.access || ((bootstrap.modules && bootstrap.modules.portal && bootstrap.modules.portal.access) || {});
            return loadDependencies();
        }).then(function () {
            render(location.hash.slice(1) || "overview");
        }).catch(function (reason) {
            error(reason.message || reason);
        });
    }

    start();
}());
