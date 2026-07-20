"use strict";

var createWrappedPlugin = require("./plugin-v5.js").myscripts;

module.exports.myscripts = function (parent) {
    var obj = createWrappedPlugin(parent);
    var originalAdminReq = obj.handleAdminReq;
    var originalStartup = obj.onWebUIStartupEnd;
    var root = parent.path.join(parent.pluginPath, "myscripts");
    var extraAssets = {
        "ui-stability-v4.js": { file: "ui-stability-v4.js", type: "text/javascript; charset=utf-8" },
        "ui-stability-v4.css": { file: "ui-stability-v4.css", type: "text/css; charset=utf-8" }
    };

    obj.handleAdminReq = function (req, res, user) {
        var asset = String(req && req.query && req.query.asset || "");
        var entry = extraAssets[asset];
        if (!entry) return originalAdminReq.call(obj, req, res, user);

        parent.fs.readFile(parent.path.join(root, "public", entry.file), function (error, data) {
            if (error) {
                res.statusCode = 404;
                res.setHeader("Content-Type", "text/plain; charset=utf-8");
                res.end("Not found");
                return;
            }
            res.statusCode = 200;
            res.setHeader("Content-Type", entry.type);
            res.setHeader("Cache-Control", "no-store");
            res.end(data);
        });
    };

    obj.onWebUIStartupEnd = function () {
        if (typeof originalStartup === "function") originalStartup.call(obj);
        if (typeof window === "undefined" || typeof document === "undefined") return;

        function assetUrl(asset) {
            var endpoint = new URL("pluginadmin.ashx", window.location.href);
            endpoint.searchParams.set("pin", "mycompany"); endpoint.searchParams.set("module", "scripts");
            endpoint.searchParams.set("asset", asset);
            endpoint.searchParams.set("v", "2.0.21");
            return endpoint.href;
        }

        function ensureStyle() {
            var id = "myscripts-ui-stability-v4-css";
            if (document.getElementById(id)) return;
            var style = document.createElement("link");
            style.id = id;
            style.rel = "stylesheet";
            style.href = assetUrl("ui-stability-v4.css");
            (document.head || document.documentElement).appendChild(style);
        }

        function loadScript() {
            return new Promise(function (resolve, reject) {
                var id = "myscripts-ui-stability-v4-script";
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
                script.src = assetUrl("ui-stability-v4.js");
                script.async = false;
                script.onload = function () { script.setAttribute("data-loaded", "1"); resolve(); };
                script.onerror = reject;
                (document.head || document.documentElement).appendChild(script);
            });
        }

        ensureStyle();
        Promise.resolve(window.MyScripts && window.MyScripts.bootstrapPromise).then(loadScript).then(function () {
            var query = null;
            try { query = new URL(window.location.href).searchParams.get("script"); } catch (error) { }
            if (query && window.MyScripts && window.MyScripts.state && window.MyScripts.state.tree && typeof window.MyScripts.renderTree === "function") {
                window.MyScripts.renderTree();
            }
        }).catch(function (error) {
            if (window.console) window.console.error("My Scripts stability layer error", error);
        });
    };

    return obj;
};
