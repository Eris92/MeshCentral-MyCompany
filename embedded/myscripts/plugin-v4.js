"use strict";

var createWrappedPlugin = require("./plugin-v3.js").myscripts;

module.exports.myscripts = function (parent) {
    var obj = createWrappedPlugin(parent);

    obj.onWebUIStartupEnd = function () {
        if (typeof window === "undefined" || typeof document === "undefined") return;

        var version = "2.0.17";
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
                script.onload = function () {
                    script.setAttribute("data-loaded", "1");
                    resolve();
                };
                script.onerror = reject;
                (document.head || document.documentElement).appendChild(script);
            });
        }

        ["plugin.css", "enhancements.css", "ui-fixes.css", "ui-polish.css", "ui-final.css", "ui-actions.css"].forEach(function (file) {
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
            .then(function () { return window.MyScripts.initialize(); })
            .catch(function (error) {
                window.MyScripts.bootstrapPromise = null;
                if (window.console) window.console.error("My Scripts bootstrap error", error);
            });
    };

    return obj;
};
