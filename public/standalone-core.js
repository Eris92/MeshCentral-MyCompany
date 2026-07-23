(function () {
    "use strict";

    (function prepareInitialView() {
        var content = document.getElementById("sirkStandaloneContent");
        var child = false;
        var savedActive = "all";

        try {
            child = new URL(window.location.href).searchParams.get("sirkWorkspaceChild") === "1";
        } catch (error) {}

        try {
            var saved = JSON.parse(localStorage.getItem("mycompany.sirkportal.deviceTabs") || "{}");
            savedActive = String(saved && saved.active || "all");
        } catch (error) {}

        if (child && window.location.hash !== "#devices") {
            try {
                var url = new URL(window.location.href);
                url.hash = "devices";
                history.replaceState(history.state, "", url.href);
            } catch (error) {
                window.location.hash = "devices";
            }
        }

        var requested = String(window.location.hash || "#overview").replace(/^#/, "") || "overview";
        var buttons = document.querySelectorAll(".sirk-standalone-nav [data-view]");
        Array.prototype.forEach.call(buttons, function (button) {
            var active = button.getAttribute("data-view") === requested;
            button.classList.toggle("is-active", active);
            button.setAttribute("aria-current", active ? "page" : "false");
        });

        var requestedButton = document.querySelector('.sirk-standalone-nav [data-view="' + requested.replace(/"/g, "\\\"") + '"] b');
        var title = document.getElementById("sirkStandaloneTitle");
        if (title && requestedButton) title.textContent = requestedButton.textContent;

        if (content && (child || (requested === "devices" && savedActive !== "all"))) {
            document.documentElement.classList.add("sirk-device-restore-pending");
            content.style.visibility = "hidden";
            content.style.pointerEvents = "none";
            content.setAttribute("aria-busy", "true");
        }
    }());

    window.MyCompanyCore = window.MyCompanyCore || {};
    window.MyCompanyModules = window.MyCompanyModules || {};
    var core = window.MyCompanyCore;
    core.assetVersion = String(window.__MYCOMPANY_PORTAL_VERSION__ || "1.5.0");

    core.redirectToLogin = function () {
        if (core.loginRedirectPending) return;
        core.loginRedirectPending = true;
        try {
            window.sessionStorage.setItem("mycompanyPortalReturnHash", window.location.hash || "#overview");
        } catch (error) {}
        var login = new URL("login?return=portal", window.location.href);
        window.location.replace(login.href);
    };

    function authenticationError() {
        var error = new Error("Authentication required.");
        error.name = "AuthenticationError";
        error.status = 401;
        return error;
    }

    core.assetUrl = function (moduleName, assetName, parameters) {
        var endpoint = new URL(String(window.__MYCOMPANY_API_BASE__ || "pluginadmin.ashx"), window.location.href);
        endpoint.searchParams.set("pin", "MyCompany");
        if (moduleName) endpoint.searchParams.set("module", moduleName);
        if (assetName) endpoint.searchParams.set("asset", assetName);
        endpoint.searchParams.set("v", core.assetVersion);
        Object.keys(parameters || {}).forEach(function (key) {
            if (parameters[key] != null) endpoint.searchParams.set(key, parameters[key]);
        });
        return endpoint.href;
    };

    core.api = function (moduleName, assetName, options, parameters) {
        var request = options || {};
        request.credentials = "same-origin";
        request.cache = "no-store";
        return window.fetch(core.assetUrl(moduleName, assetName, parameters), request).then(function (response) {
            return response.text().then(function (text) {
                if (response.status === 401) {
                    core.redirectToLogin();
                    throw authenticationError();
                }
                var result = {};
                try { result = text ? JSON.parse(text) : {}; }
                catch (error) {
                    var invalid = new Error("HTTP " + response.status + ": invalid JSON response.");
                    invalid.status = response.status;
                    throw invalid;
                }
                if (!response.ok || result.ok === false) throw new Error(result.error || "HTTP " + response.status);
                return result;
            });
        });
    };

    core.post = function (moduleName, assetName, values) {
        var body = new URLSearchParams();
        body.set("payload", JSON.stringify(values && typeof values === "object" ? values : {}));
        return core.api(moduleName, assetName, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
            body: body.toString()
        });
    };

    core.loadScript = function (id, source) {
        return new Promise(function (resolve, reject) {
            var existing = document.getElementById(id);
            if (existing) {
                if (existing.getAttribute("data-loaded") === "1") resolve();
                else {
                    existing.addEventListener("load", resolve, { once: true });
                    existing.addEventListener("error", reject, { once: true });
                }
                return;
            }
            var script = document.createElement("script");
            script.id = id;
            script.src = source;
            script.async = false;
            script.onload = function () { script.setAttribute("data-loaded", "1"); resolve(); };
            script.onerror = function () { reject(new Error("Unable to load " + source)); };
            (document.head || document.documentElement).appendChild(script);
        });
    };

    // Standalone modules share backend logic but never register native MeshCentral menus.
    core.ensureMenu = function () { return false; };
    core.showWorkspace = function (title, viewMode, render) {
        var host = document.getElementById("sirkStandaloneContent");
        if (!host) return false;
        host.innerHTML = "";
        render(host);
        return false;
    };
    core.restoreWorkspace = function () {};

    core.element = function (tag, className, text) {
        var value = document.createElement(tag);
        if (className) value.className = className;
        if (text != null) value.textContent = text;
        return value;
    };

    core.card = function (title, description) {
        var card = core.element("div", "mc-shared-card");
        card.appendChild(core.element("strong", "", title));
        if (description) card.appendChild(core.element("div", "mc-shared-muted", description));
        return card;
    };

    core.flattenScripts = function (node, target) {
        target = target || [];
        if (!node) return target;
        if (node.type === "script") target.push(node);
        (node.children || []).forEach(function (child) { core.flattenScripts(child, target); });
        return target;
    };
}());