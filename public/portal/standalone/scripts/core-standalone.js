(function () {
    "use strict";
    var core = window.SirkPlatformCore;
    if (!core) throw new Error("SirkPlatformCore is required before standalone transport.");
    core.assetUrl = function (moduleName, assetName, parameters) {
        var base = String(window.__SIRK_PLATFORM_API_BASE__ || "/api").replace(/\/$/, "");
        var endpoint = !moduleName && assetName === "bootstrap"
            ? new URL(base + "/bootstrap", window.location.href)
            : new URL(base + "/modules/" + encodeURIComponent(moduleName || "_runtime") + "/" + encodeURIComponent(assetName || "index"), window.location.href);
        endpoint.searchParams.set("v", core.assetVersion);
        Object.keys(parameters || {}).forEach(function (key) {
            if (parameters[key] != null) endpoint.searchParams.set(key, parameters[key]);
        });
        return endpoint.href;
    };
}());
