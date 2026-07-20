(function () {
    "use strict";

    var API_MAJOR = 3;
    var VERSION = "3.0.0";
    var BUILD_HASH = "mesh-plugin-core-3.0.0-20260718";
    window.MeshPluginCore = window.MeshPluginCore || {};
    var core = window.MeshPluginCore;

    if (core.apiMajor != null && Number(core.apiMajor) !== API_MAJOR) {
        core.conflict = { expectedApiMajor: API_MAJOR, actualApiMajor: core.apiMajor, requestedBuild: BUILD_HASH, actualBuild: core.buildHash || "" };
        if (window.console && typeof window.console.error === "function") window.console.error("MeshPluginCore API conflict", core.conflict);
        return;
    }

    core.apiMajor = API_MAJOR;
    core.version = VERSION;
    core.buildHash = BUILD_HASH;

    core.assetUrl = function (pluginName, assetName) {
        var endpoint = new URL("pluginadmin.ashx", window.location.href);
        endpoint.searchParams.set("pin", pluginName);
        endpoint.searchParams.set("asset", assetName);
        return endpoint.href;
    };

    core.loadScript = function (id, url) {
        return new Promise(function (resolve, reject) {
            var existing = document.getElementById(id);
            if (existing) {
                if (existing.getAttribute("data-mesh-plugin-loaded") === "1" || existing.getAttribute("data-loaded") === "1") resolve();
                else {
                    existing.addEventListener("load", resolve, { once: true });
                    existing.addEventListener("error", reject, { once: true });
                }
                return;
            }
            var script = document.createElement("script");
            script.id = id;
            script.src = url;
            script.async = false;
            script.addEventListener("load", function () {
                script.setAttribute("data-mesh-plugin-loaded", "1");
                script.setAttribute("data-loaded", "1");
                resolve();
            }, { once: true });
            script.addEventListener("error", reject, { once: true });
            (document.head || document.documentElement).appendChild(script);
        });
    };

    core.apiRequest = function (url, options) {
        var request = options || {};
        request.credentials = "same-origin";
        return window.fetch(url, request).then(function (response) {
            return response.text().then(function (text) {
                var result = {};
                try { result = text ? JSON.parse(text) : {}; }
                catch (error) { throw new Error("HTTP " + response.status + ": invalid JSON response."); }
                if (!response.ok || result.ok === false) throw new Error(result.error || ("HTTP " + response.status));
                return result;
            });
        });
    };

    core.preparePluginMenuItem = function (item) {
        if (!item) return item;
        var handler = item.onclick || item.onmouseup;
        var modern = String(item.tagName || "").toLowerCase() === "a" || item.classList.contains("nav-link");
        item.onclick = item.onmouseup = item.onkeypress = null;
        item.removeAttribute("onclick");
        item.removeAttribute("onmouseup");
        item.removeAttribute("onkeypress");
        if (handler) {
            if (modern) item.onclick = handler;
            else item.onmouseup = handler;
            item.onkeypress = function (event) { if (event && event.key === "Enter") return handler(event); };
        }
        if (modern) item.setAttribute("href", "#");
        return item;
    };

    core.placeMenuItem = function (item, anchor, order) {
        if (!item || !anchor || !anchor.parentNode) return false;
        core.preparePluginMenuItem(item);
        var host = anchor.parentNode;
        item.setAttribute("data-meshcentral-plugin-menu", String(order));
        if (item.parentNode !== host) host.insertBefore(item, anchor.nextSibling);
        var items = Array.prototype.slice.call(host.children).filter(function (child) {
            return child.hasAttribute("data-meshcentral-plugin-menu");
        }).sort(function (left, right) {
            return Number(left.getAttribute("data-meshcentral-plugin-menu")) - Number(right.getAttribute("data-meshcentral-plugin-menu"));
        });
        var cursor = anchor;
        items.forEach(function (entry) { host.insertBefore(entry, cursor.nextSibling); cursor = entry; });
        return true;
    };

    core.setPluginMenuActive = function (main, left, active) {
        if (main) { main.classList.remove("fullselect", "semiselect", "active"); if (active) main.classList.add("fullselect"); }
        if (left) { left.classList.remove("lbbuttonsel", "lbbuttonsel2", "active"); if (active) left.classList.add("lbbuttonsel2"); }
    };

    core.hideNativeElement = function (element) {
        if (!element) return null;
        var state = { element: element, cssText: element.style.cssText, hidden: element.hidden, hadDNone: element.classList.contains("d-none") };
        element.hidden = true;
        element.classList.add("d-none");
        element.style.setProperty("display", "none", "important");
        return state;
    };

    core.restoreNativeElement = function (state) {
        if (!state || !state.element) return;
        state.element.style.cssText = state.cssText;
        state.element.hidden = state.hidden;
        if (!state.hadDNone) state.element.classList.remove("d-none");
    };

    core.logClick = function (pluginName, targetName) {
        window.fetch(core.assetUrl(pluginName, "click"), {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
            body: "target=" + encodeURIComponent(String(targetName || "click").slice(0, 160))
        }).catch(function () { });
    };

    if (!core.clickLoggingInstalled) {
        core.clickLoggingInstalled = true;
        document.addEventListener("click", function (event) {
            var marker = event.target && event.target.closest ? event.target.closest("[data-meshcentral-plugin-pin]") : null;
            if (marker) core.logClick(marker.getAttribute("data-meshcentral-plugin-pin"), marker.getAttribute("data-meshcentral-plugin-click") || marker.id || marker.value || marker.textContent || "click");
        }, true);
    }
}());
