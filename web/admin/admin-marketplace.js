(function () {
    "use strict";

    if (window.__sirkPlatformMarketplaceLoaded) return;
    window.__sirkPlatformMarketplaceLoaded = true;

    var root = document.getElementById("sirk-platform-admin");
    var content = document.getElementById("sirk-platform-admin-content");
    if (!root || !content) return;

    var state = { catalog: [], installed: [], query: "", view: "installed", loading: false };

    function pin() { return root.getAttribute("data-plugin") || "SirkPlatform"; }

    function parseResponse(response) {
        return response.text().then(function (text) {
            var value;
            try { value = JSON.parse(text || "{}"); }
            catch (error) { throw new Error(text || ("HTTP " + response.status)); }
            if (!response.ok || value.ok === false) throw new Error(value.error || ("HTTP " + response.status));
            return value;
        });
    }

    function adminUrl(action, asset) {
        var url = new URL("pluginadmin.ashx", window.location.href);
        url.searchParams.set("pin", pin());
        if (action) url.searchParams.set("action", action);
        if (asset) url.searchParams.set("asset", asset);
        return url;
    }

    function postOperation(operation, payload) {
        payload = payload || {};
        payload.operation = operation;
        var body = new URLSearchParams();
        body.set("payload", JSON.stringify(payload));
        return fetch(adminUrl("plugin-operation").href, {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
            body: body.toString()
        }).then(parseResponse);
    }

    function status(text, error) {
        var host = content.querySelector(".mc-admin-save-status");
        if (!host) return;
        host.className = error ? "mc-admin-save-status mc-admin-error" : "mc-admin-save-status";
        host.textContent = text || "";
    }

    function installed(shortName) {
        shortName = String(shortName || "").toLowerCase();
        return state.installed.find(function (plugin) {
            return String(plugin.shortName || "").toLowerCase() === shortName;
        });
    }

    function ensureStyle() {
        if (document.getElementById("sirk-platform-marketplace-style")) return;
        var style = document.createElement("style");
        style.id = "sirk-platform-marketplace-style";
        style.textContent = [
            ".mc-marketplace-controls{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:12px 0}",
            ".mc-marketplace-tabs{display:flex;gap:4px}",
            ".mc-marketplace-tabs button.active{background:#4f63d9;color:#fff;border-color:#4f63d9}",
            ".mc-marketplace-search{min-width:260px;max-width:420px;flex:1}",
            ".mc-marketplace-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px;margin-top:12px}",
            ".mc-marketplace-card{border:1px solid #ccd4e2;border-radius:8px;padding:14px;background:#fff;display:flex;flex-direction:column;gap:8px}",
            ".mc-marketplace-card h3{margin:0;font-size:18px}",
            ".mc-marketplace-meta{display:flex;gap:8px;flex-wrap:wrap;color:#667085;font-size:12px}",
            ".mc-marketplace-description{line-height:1.35;min-height:38px}",
            ".mc-marketplace-actions{display:flex;gap:8px;align-items:center;margin-top:auto;padding-top:6px}",
            ".mc-marketplace-actions a{font-size:12px}",
            ".mc-marketplace-warning{padding:9px 11px;border:1px solid #f4c86b;background:#fff8e6;border-radius:6px;margin-top:8px}",
            ".mc-marketplace-empty{padding:18px;text-align:center;color:#667085}"
        ].join("");
        (document.head || document.documentElement).appendChild(style);
    }

    function marketplaceHost() {
        var host = content.querySelector("[data-marketplace-host]");
        if (host) return host;
        host = document.createElement("div");
        host.setAttribute("data-marketplace-host", "1");
        var wrap = content.querySelector(".mc-admin-table-wrap");
        if (wrap && wrap.nextSibling) content.insertBefore(host, wrap.nextSibling);
        else content.appendChild(host);
        return host;
    }

    function setView(view) {
        state.view = view;
        var wrap = content.querySelector(".mc-admin-table-wrap");
        if (wrap) wrap.hidden = view !== "installed";
        var host = marketplaceHost();
        host.hidden = view !== "available";
        content.querySelectorAll("[data-marketplace-view]").forEach(function (button) {
            button.classList.toggle("active", button.getAttribute("data-marketplace-view") === view);
        });
        if (view === "available") renderCatalog();
    }

    function ensureControls() {
        var heading = content.querySelector(".mc-admin-section-header h3");
        if (!heading || String(heading.textContent || "").trim() !== "Wtyczki") return false;
        var toolbar = content.querySelector(".mc-admin-toolbar");
        if (!toolbar) return false;
        if (content.querySelector("[data-marketplace-controls]")) return true;

        var controls = document.createElement("div");
        controls.className = "mc-marketplace-controls";
        controls.setAttribute("data-marketplace-controls", "1");

        var tabs = document.createElement("div");
        tabs.className = "mc-marketplace-tabs";
        [
            { key: "installed", label: "Zainstalowane" },
            { key: "available", label: "Dostępne" }
        ].forEach(function (item) {
            var button = document.createElement("button");
            button.type = "button";
            button.className = "mc-admin-secondary";
            button.setAttribute("data-marketplace-view", item.key);
            button.textContent = item.label;
            button.onclick = function () { setView(item.key); };
            tabs.appendChild(button);
        });
        controls.appendChild(tabs);

        var search = document.createElement("input");
        search.type = "search";
        search.className = "mc-admin-input mc-marketplace-search";
        search.placeholder = "Szukaj w Marketplace…";
        search.oninput = function () { state.query = search.value || ""; renderCatalog(); };
        controls.appendChild(search);

        toolbar.parentNode.insertBefore(controls, toolbar.nextSibling);
        setView(state.view);
        return true;
    }

    function installPlugin(item, button) {
        if (!window.confirm("Zainstalować wtyczkę " + item.name + " z repozytorium " + item.author + "? Kod wtyczki działa z uprawnieniami serwera MeshCentral.")) return;
        button.disabled = true;
        status("Dodawanie " + item.name + "…", false);
        postOperation("add", { configUrl: item.configUrl }).then(function (result) {
            state.installed = result.plugins || state.installed;
            var added = installed(item.shortName);
            if (!added) throw new Error("Wtyczka została dodana, ale nie znaleziono jej identyfikatora.");
            if (added.status === 1) return result;
            status("Instalowanie i włączanie " + item.name + "…", false);
            return postOperation("enable", { id: added.id });
        }).then(function (result) {
            state.installed = result.plugins || state.installed;
            status("Wtyczka " + item.name + " została zainstalowana i włączona.", false);
            renderCatalog();
            window.setTimeout(function () { window.location.reload(); }, 1200);
        }).catch(function (error) {
            status(error.message || String(error), true);
            button.disabled = false;
        });
    }

    function renderCatalog() {
        var host = marketplaceHost();
        if (state.view !== "available") return;
        host.innerHTML = "";

        var warning = document.createElement("div");
        warning.className = "mc-marketplace-warning";
        warning.textContent = "Marketplace instaluje kod z zewnętrznych repozytoriów. Instaluj wyłącznie zaufane wtyczki; manifest i zgodność są ponownie walidowane przez MeshCentral.";
        host.appendChild(warning);

        var query = state.query.trim().toLowerCase();
        var items = state.catalog.filter(function (item) {
            if (!query) return true;
            return [item.name, item.shortName, item.author, item.description, item.category].join(" ").toLowerCase().indexOf(query) >= 0;
        });

        if (!items.length) {
            var empty = document.createElement("div");
            empty.className = "mc-marketplace-empty";
            empty.textContent = "Nie znaleziono wtyczek.";
            host.appendChild(empty);
            return;
        }

        var grid = document.createElement("div");
        grid.className = "mc-marketplace-grid";
        items.forEach(function (item) {
            var card = document.createElement("section");
            card.className = "mc-marketplace-card";
            var title = document.createElement("h3");
            title.textContent = item.name;
            card.appendChild(title);

            var meta = document.createElement("div");
            meta.className = "mc-marketplace-meta";
            meta.textContent = "v" + item.version + " · " + item.author + " · " + item.category + " · MeshCentral " + item.meshCentralCompat;
            card.appendChild(meta);

            var description = document.createElement("div");
            description.className = "mc-marketplace-description";
            description.textContent = item.description;
            card.appendChild(description);

            var actions = document.createElement("div");
            actions.className = "mc-marketplace-actions";
            var current = installed(item.shortName);
            var install = document.createElement("button");
            install.type = "button";
            install.className = current ? "mc-admin-secondary" : "mc-admin-primary";
            install.disabled = !!current;
            install.textContent = current ? ("Zainstalowana " + (current.version || "")) : "Instaluj";
            install.onclick = function () { installPlugin(item, install); };
            actions.appendChild(install);

            var homepage = document.createElement("a");
            homepage.href = item.homepage;
            homepage.target = "_blank";
            homepage.rel = "noopener noreferrer";
            homepage.textContent = "Repozytorium";
            actions.appendChild(homepage);
            card.appendChild(actions);
            grid.appendChild(card);
        });
        host.appendChild(grid);
    }

    function load() {
        if (state.loading) return;
        state.loading = true;
        Promise.all([
            fetch(adminUrl("plugin-state").href, { credentials: "same-origin", cache: "no-store" }).then(parseResponse),
            fetch(adminUrl(null, "marketplace.json").href, { credentials: "same-origin", cache: "no-store" }).then(parseResponse)
        ]).then(function (values) {
            state.installed = values[0].plugins || [];
            state.catalog = values[1].plugins || [];
            ensureControls();
            renderCatalog();
        }).catch(function (error) {
            status("Marketplace: " + (error.message || String(error)), true);
        }).then(function () { state.loading = false; });
    }

    var observer = new MutationObserver(function () {
        if (ensureControls() && !state.catalog.length) load();
    });
    observer.observe(content, { childList: true, subtree: true });
    ensureStyle();
    if (ensureControls()) load();
}());
