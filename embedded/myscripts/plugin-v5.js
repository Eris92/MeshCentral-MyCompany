"use strict";

var createWrappedPlugin = require("./plugin-v4.js").myscripts;

module.exports.myscripts = function (parent) {
    var obj = createWrappedPlugin(parent);
    var originalAdminReq = obj.handleAdminReq;
    var root = parent.path.join(parent.pluginPath, "myscripts");
    var extraAssets = {
        "defender-integration.js": "defender-integration.js",
        "reports-integration.js": "reports-integration.js",
        "ui-layout-v3.js": "ui-layout-v3.js",
        "ui-layout-v3.css": "ui-layout-v3.css",
        "ui-stability-v4.js": "ui-stability-v4.js",
        "ui-stability-v4.css": "ui-stability-v4.css"
    };

    obj.handleAdminReq = function (req, res, user) {
        var asset = String(req && req.query && req.query.asset || "");
        var fileName = extraAssets[asset];
        if (!fileName) return originalAdminReq.call(obj, req, res, user);

        parent.fs.readFile(parent.path.join(root, "public", fileName), function (error, data) {
            if (error) {
                res.statusCode = 404;
                res.setHeader("Content-Type", "text/plain; charset=utf-8");
                res.end("Not found");
                return;
            }
            res.statusCode = 200;
            res.setHeader("Content-Type", asset.slice(-4) === ".css" ? "text/css; charset=utf-8" : "text/javascript; charset=utf-8");
            res.setHeader("Cache-Control", "no-store");
            res.end(data);
        });
    };

    obj.onWebUIStartupEnd = function () {
        if (typeof window === "undefined" || typeof document === "undefined") return;

        var version = "2.0.22";
        window.MyScripts = window.MyScripts || {};
        if (window.MyScripts.bootstrapPromise) return;

        function assetUrl(asset) {
            var endpoint = new URL("pluginadmin.ashx", window.location.href);
            endpoint.searchParams.set("pin", "mycompany"); endpoint.searchParams.set("module", "scripts");
            endpoint.searchParams.set("asset", asset);
            endpoint.searchParams.set("v", version);
            return endpoint.href;
        }

        function loadScript(id, source) {
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
                script.onerror = reject;
                (document.head || document.documentElement).appendChild(script);
            });
        }

        [
            "plugin.css",
            "enhancements.css",
            "ui-fixes.css",
            "ui-polish.css",
            "ui-final.css",
            "ui-actions.css",
            "ui-layout-v3.css",
            "ui-stability-v4.css"
        ].forEach(function (file) {
            var id = "myscripts-" + file.replace(/\W/g, "-");
            if (document.getElementById(id)) return;
            var style = document.createElement("link");
            style.id = id;
            style.rel = "stylesheet";
            style.href = assetUrl(file);
            (document.head || document.documentElement).appendChild(style);
        });

        window.MyScripts.bootstrapPromise = loadScript("myscripts-core-script", assetUrl("core.js"))
            .then(function () { return loadScript("myscripts-main-script", assetUrl("main.js")); })
            .then(function () { return loadScript("myscripts-enhancements-script", assetUrl("enhancements.js")); })
            .then(function () { return loadScript("myscripts-ui-fixes-script", assetUrl("ui-fixes.js")); })
            .then(function () { return loadScript("myscripts-ui-polish-script", assetUrl("ui-polish.js")); })
            .then(function () { return loadScript("myscripts-ui-final-script", assetUrl("ui-final.js")); })
            .then(function () { return loadScript("myscripts-ui-actions-script", assetUrl("ui-actions.js")); })
            .then(function () { return loadScript("myscripts-defender-integration-script", assetUrl("defender-integration.js")); })
            .then(function () { return loadScript("myscripts-reports-integration-script", assetUrl("reports-integration.js")); })
            .then(function () { return loadScript("myscripts-ui-layout-v3-script", assetUrl("ui-layout-v3.js")); })
            .then(function () { return window.MyScripts.initialize(); })
            .then(function () { return loadScript("myscripts-ui-stability-v4-script", assetUrl("ui-stability-v4.js")); })
            .then(function () {
                var query = "";
                try { query = String(new URL(window.location.href).searchParams.get("script") || ""); } catch (error) { }
                if (query && window.MyScripts && typeof window.MyScripts.renderTree === "function") window.MyScripts.renderTree();
            })
            .catch(function (error) {
                window.MyScripts.bootstrapPromise = null;
                if (window.console) window.console.error("My Scripts bootstrap error", error);
            });
    };

    return obj;
};
