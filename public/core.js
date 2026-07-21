(function () {
    "use strict";
    window.MyCompanyCore = window.MyCompanyCore || {};
    var core = window.MyCompanyCore;
    core.assetUrl = function (moduleName, assetName, parameters) {
        var endpoint = new URL("pluginadmin.ashx", window.location.href);
        endpoint.searchParams.set("pin", "MyCompany");
        if (moduleName) endpoint.searchParams.set("module", moduleName);
        if (assetName) endpoint.searchParams.set("asset", assetName);
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
                var result = {};
                try { result = text ? JSON.parse(text) : {}; }
                catch (error) { throw new Error("HTTP " + response.status + ": invalid JSON response."); }
                if (!response.ok || result.ok === false) throw new Error(result.error || "HTTP " + response.status);
                return result;
            });
        });
    };
    core.post = function (moduleName, assetName, values) {
        var body = new URLSearchParams();
        Object.keys(values || {}).forEach(function (key) {
            var value = values[key];
            body.set(key, typeof value === "object" ? JSON.stringify(value) : String(value == null ? "" : value));
        });
        return core.api(moduleName, assetName, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
            body: body.toString()
        });
    };
    core.loadScript = function (id, source) {
        return new Promise(function (resolve, reject) {
            var existing = document.getElementById(id);
            if (existing) { resolve(); return; }
            var script = document.createElement("script");
            script.id = id;
            script.src = source;
            script.async = false;
            script.onload = resolve;
            script.onerror = reject;
            (document.head || document.documentElement).appendChild(script);
        });
    };
    core.placeMenuItem = function (item, anchor, order) {
        if (!item || !anchor || !anchor.parentNode) return false;
        var host = anchor.parentNode;
        item.setAttribute("data-mycompany-order", String(order || 100));
        if (item.parentNode !== host) host.insertBefore(item, anchor.nextSibling);
        return true;
    };
    core.ensureMenu = function (definition) {
        var mainAnchor = document.getElementById("MainMenuMyDevices");
        var leftAnchor = document.getElementById("LeftMenuMyDevices");
        if (mainAnchor && mainAnchor.parentNode) {
            var main = document.getElementById(definition.mainId) || mainAnchor.cloneNode(false);
            main.id = definition.mainId;
            main.textContent = definition.title;
            main.title = definition.title;
            main.onclick = definition.open;
            main.onmouseup = definition.open;
            core.placeMenuItem(main, mainAnchor, definition.order);
        }
        if (leftAnchor && leftAnchor.parentNode) {
            var left = document.getElementById(definition.leftId) || leftAnchor.cloneNode(true);
            left.id = definition.leftId;
            left.title = definition.title;
            left.onclick = definition.open;
            left.onmouseup = definition.open;
            core.placeMenuItem(left, leftAnchor, definition.order);
        }
    };
    core.restoreWorkspace = function () {
        var state = core.workspaceState;
        if (!state) return;
        if (state.heading) state.heading.textContent = state.headingText;
        (state.hidden || []).forEach(function (item) {
            item.element.style.cssText = item.cssText;
            item.element.hidden = item.hidden;
        });
        var workspace = document.getElementById("MyCompanyWorkspace");
        if (workspace) workspace.style.display = "none";
        core.workspaceState = null;
    };
    core.showWorkspace = function (title, viewMode, render) {
        if (typeof window.go === "function" && Number(window.xxcurrentView) !== 1) {
            try { window.go(1); } catch (error) {}
        }
        var page = document.getElementById("p1");
        var titleHost = document.getElementById("p1title");
        if (!page || !titleHost) return false;
        var workspace = document.getElementById("MyCompanyWorkspace");
        if (!workspace) {
            workspace = document.createElement("div");
            workspace.id = "MyCompanyWorkspace";
            page.appendChild(workspace);
        }
        var heading = titleHost.querySelector("h1,h2,h3,.title,b,strong") || titleHost;
        if (!core.workspaceState) {
            var hidden = [];
            for (var child = page.firstElementChild; child; child = child.nextElementSibling) {
                if (child === titleHost || child === workspace) continue;
                hidden.push({ element: child, cssText: child.style.cssText, hidden: child.hidden });
                child.hidden = true;
                child.style.setProperty("display", "none", "important");
            }
            core.workspaceState = { heading: heading, headingText: heading.textContent, hidden: hidden };
        }
        heading.textContent = title;
        while (workspace.firstChild) workspace.removeChild(workspace.firstChild);
        workspace.style.display = "block";
        render(workspace);
        window.xxcurrentView = viewMode;
        return false;
    };
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
