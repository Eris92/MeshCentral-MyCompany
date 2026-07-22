(function () {
    "use strict";

    var core = window.MyCompanyCore;
    var root = document.getElementById("sirkStandaloneRoot");
    var portalRoot = document.getElementById("sirkPortalRoot");
    var content = document.getElementById("sirkStandaloneContent");
    var title = document.getElementById("sirkStandaloneTitle");
    var bootstrap = null;
    var initialized = Object.create(null);
    var renderSequence = 0;
    var viewNames = {
        overview: "Przegląd", devices: "Urządzenia", approvals: "Akceptacje",
        automation: "Automatyzacja", monitoring: "Monitoring", assets: "Zasoby",
        management: "Zarządzanie", reports: "Raporty", security: "Security", settings: "Ustawienia"
    };
    var moduleViews = {
        automation: "mycommands",
        assets: "myjira",
        security: "defendertools"
    };

    function asset(name) {
        var base = String(window.__MYCOMPANY_ASSET_BASE__ || "").replace(/\/$/, "");
        return base + "/" + name + "?v=" + encodeURIComponent(window.__MYCOMPANY_PORTAL_VERSION__ || "1");
    }
    function load(id, name) { return core.loadScript(id, asset(name)); }
    function moduleState(key) { return bootstrap && bootstrap.modules && bootstrap.modules[key] || null; }
    function moduleAllowed(key) {
        var state = moduleState(key);
        return !!(state && state.enabled && state.ready !== false && (!state.access || state.access.allowed !== false));
    }
    function isCurrent(sequence) { return sequence === renderSequence; }
    function loading(message) {
        content.innerHTML = '<div class="sirk-standalone-loading"><span></span><p>' + (message || "Ładowanie…") + '</p></div>';
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
            '<section class="sirk-standalone-card"><h2>Urządzenia</h2><p>' + (devices != null ? devices : "Urządzenia dostępne przez API MyCompany.") + '</p></section>',
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
    function mountModule(view, key, sequence) {
        if (!moduleAllowed(key)) {
            error(viewNames[view] + ": moduł jest wyłączony albo użytkownik nie ma dostępu.");
            return;
        }
        loading("Ładowanie: " + viewNames[view] + "…");
        initializeModule(key).then(function () {
            if (!isCurrent(sequence)) return;
            var module = window.MyCompanyModules[key];
            if (!module || typeof module.mount !== "function") throw new Error("Moduł " + key + " nie udostępnia widoku Portalu.");
            content.innerHTML = "";
            module.mount(content, "sirk-standalone-" + view);
        }).catch(function (reason) {
            if (isCurrent(sequence)) error(viewNames[view] + ": " + (reason && reason.message || reason));
        });
    }
    function management(sequence) {
        if (!moduleAllowed("myscripts")) { error("MyScripts jest wyłączony albo użytkownik nie ma dostępu."); return; }
        loading("Ładowanie Zarządzania…");
        if (!window.MyCompanyPortalManagement || typeof window.MyCompanyPortalManagement.mount !== "function") {
            error("Renderer Zarządzania nie został załadowany.");
            return;
        }
        var host = document.createElement("div");
        host.className = "mycompany-management-host";
        content.innerHTML = "";
        content.appendChild(host);
        Promise.resolve(window.MyCompanyPortalManagement.mount(host)).then(function () {
            if (!isCurrent(sequence)) return;
            if (!host.querySelector(".sirk-management-shell,.mc-shared-error,.sirk-card")) {
                throw new Error("Renderer nie utworzył widoku MyScripts.");
            }
        }).catch(function (reason) {
            if (isCurrent(sequence)) error("Zarządzanie: " + (reason && reason.message || reason));
        });
    }
    function approvals(sequence) {
        if (!moduleAllowed("approvalcenter")) { error("Approval Center jest wyłączony albo użytkownik nie ma dostępu."); return; }
        loading("Ładowanie Akceptacji…");
        initializeModule("approvalcenter").then(function () {
            if (!isCurrent(sequence)) return;
            var module = window.MyCompanyModules.approvalcenter;
            if (!module || typeof module.mount !== "function") throw new Error("Approval Center nie udostępnia widoku Portalu.");
            content.innerHTML = "";
            module.mount(content, "sirk-standalone-approval");
        }).catch(function (reason) { if (isCurrent(sequence)) error(reason.message || reason); });
    }
    function settings() {
        var access = moduleState("portal") && moduleState("portal").access;
        if (!access || access.siteAdmin !== true) { error("Ustawienia są dostępne tylko dla Site Admin."); return; }
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
        content.innerHTML = '<div class="sirk-standalone-card sirk-standalone-placeholder"><h2>Urządzenia</h2><p>Warstwa urządzeń jest migrowana do niezależnego API Portalu.</p><p><a href="' + String(window.__MYCOMPANY_NATIVE_URL__ || "#") + '">Otwórz MeshCentral</a></p></div>';
    }
    function render(view) {
        view = viewNames[view] ? view : "overview";
        var sequence = ++renderSequence;
        title.textContent = viewNames[view];
        Array.prototype.forEach.call(document.querySelectorAll(".sirk-standalone-nav [data-view]"), function (button) {
            var active = button.getAttribute("data-view") === view;
            button.classList.toggle("is-active", active);
            button.setAttribute("aria-current", active ? "page" : "false");
        });
        if (view === "overview") overview();
        else if (view === "management") management(sequence);
        else if (view === "approvals") approvals(sequence);
        else if (view === "settings") settings();
        else if (view === "devices") devices();
        else if (moduleViews[view]) mountModule(view, moduleViews[view], sequence);
        else if (view === "monitoring") placeholder(view, "Moduł Zabbix/Monitoring zostanie podłączony do wspólnego API MyCompany.");
        else if (view === "reports") placeholder(view, "Raporty będą korzystać ze wspólnego rejestru wyników MyCompany.");
        else placeholder(view, "Moduł będzie podłączony do niezależnego API MyCompany bez zależności od starego WebUI.");
        if (window.location.hash !== "#" + view) history.replaceState(null, "", "#" + view);
    }
    function setTheme(dark) {
        portalRoot.classList.toggle("sirk-theme-dark", dark);
        portalRoot.classList.toggle("sirk-theme-light", !dark);
        document.documentElement.style.colorScheme = dark ? "dark" : "light";
        try { localStorage.setItem("mycompany.sirkportal.theme", dark ? "dark" : "light"); } catch (ignored) {}
    }
    function bind() {
        root.addEventListener("click", function (event) {
            var nav = event.target.closest("[data-view]");
            if (nav && root.contains(nav)) {
                event.preventDefault();
                event.stopPropagation();
                render(nav.getAttribute("data-view"));
                return;
            }
            var action = event.target.closest("[data-action]");
            if (!action) return;
            event.preventDefault();
            event.stopPropagation();
            if (action.getAttribute("data-action") === "sidebar") {
                var value = !root.classList.contains("is-collapsed");
                root.classList.toggle("is-collapsed", value);
                var icon = action.querySelector("svg");
                if (icon) icon.style.transform = value ? "rotate(180deg)" : "";
                try { localStorage.setItem("mycompany.sirkportal.standaloneCollapsed", value ? "1" : "0"); } catch (ignored) {}
            }
            if (action.getAttribute("data-action") === "theme") setTheme(!portalRoot.classList.contains("sirk-theme-dark"));
        });
        try {
            if (localStorage.getItem("mycompany.sirkportal.standaloneCollapsed") === "1") root.classList.add("is-collapsed");
            setTheme(localStorage.getItem("mycompany.sirkportal.theme") === "dark");
        } catch (ignored) { setTheme(false); }
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
            ["sirk-move-module", "moverequests.js"],
            ["sirk-commands-module", "mycommands.js"],
            ["sirk-jira-module", "myjira.js"],
            ["sirk-defender-module", "defendertools.js"],
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
        loading("Ładowanie modułów MyCompany…");
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
            error("SirK Portal: " + (reason.message || reason));
        });
    }
    start();
}());