"use strict";

var createAdmin = require("./admin.js").admin;
var VERSION = require("./config.json").version;

function errorText(error) {
    return String(error && (error.stack || error.message) || error || "Unknown SIRK Platform load error.");
}

function sendJson(res, status, value) {
    if (typeof res.status === "function") res.status(status); else res.statusCode = status;
    if (typeof res.set === "function") res.set("Content-Type", "application/json; charset=utf-8");
    else if (typeof res.setHeader === "function") res.setHeader("Content-Type", "application/json; charset=utf-8");
    if (typeof res.json === "function") res.json(value);
    else if (typeof res.send === "function") res.send(JSON.stringify(value));
    else if (typeof res.end === "function") res.end(JSON.stringify(value));
}

function createFallbackRuntime(error) {
    var message = errorText(error);
    return {
        loadError: message,
        modules: {},
        initialize: function () { return Promise.resolve(); },
        captureAgentData: function () {},
        request: function (method, moduleName, asset, req, res) {
            sendJson(res, 503, { ok: false, error: "SIRK Platform runtime failed to load." });
        },
        adminSnapshot: function () {
            return {
                plugin: { name: "SIRK Management Platform", shortName: "SIRK-Portal", version: VERSION },
                modules: [],
                moduleSettings: {},
                integrations: {},
                diagnostics: { logs: "", errors: message },
                loadError: message,
                generatedAt: new Date().toISOString()
            };
        },
        saveAdminSettings: function () {
            return Promise.reject(new Error("SIRK Platform runtime failed to load: " + message));
        }
    };
}

function dataRoot(parent) {
    var path = parent.path || require("path");
    var meshServer = parent && parent.parent;
    var dataBase = meshServer && meshServer.datapath
        ? meshServer.datapath
        : path.dirname(parent.pluginPath || __dirname);
    return path.join(dataBase, "sirk-platform-data");
}

function writeLoadError(parent, error) {
    try {
        var fs = parent.fs || require("fs");
        var path = parent.path || require("path");
        var root = dataRoot(parent);
        fs.mkdirSync(root, { recursive: true });
        fs.writeFileSync(
            path.join(root, "plugin-load-error.log"),
            new Date().toISOString() + "\r\n" + errorText(error) + "\r\n",
            "utf8"
        );
    } catch (ignored) {}
}

function createPlugin(parent, shortName) {
    var obj = {
        parent: parent,
        meshServer: parent && parent.parent,
        shortName: shortName || "SIRK-Portal",
        exports: ["onWebUIStartupEnd", "goPageStart", "goPageEnd", "onDeviceRefreshEnd", "commandResult"]
    };

    try {
        obj.runtime = require("./server/core/runtime-portal.js").createRuntime({
            parent: parent,
            pluginRoot: __dirname,
            source: obj
        });
    } catch (error) {
        console.error("SIRK Platform runtime creation failed", error);
        writeLoadError(parent, error);
        obj.runtime = createFallbackRuntime(error);
    }

    obj.admin = createAdmin(obj);
    obj.server_startup = function () {
        Promise.resolve(obj.runtime.initialize()).catch(function (error) {
            console.error("SIRK Platform initialization failed", error);
            writeLoadError(parent, error);
        });
    };
    obj.handleAdminReq = function (req, res, user) { return obj.admin.req(req, res, user); };
    obj.handleAdminPostReq = function (req, res, user) { return obj.admin.post(req, res, user); };
    obj.hook_processAgentData = function (command, agent) {
        if (obj.runtime && typeof obj.runtime.captureAgentData === "function") {
            obj.runtime.captureAgentData(command, agent);
        }
    };

    obj.onWebUIStartupEnd = function () {
        if (typeof window === "undefined" || typeof document === "undefined") return;

        var browserVersion = VERSION;
        var browserPin = obj.shortName;
        window.__SIRK_PLATFORM_VERSION__ = browserVersion;
        document.documentElement.classList.add("sirk-platform-native-ui");

        function asset(name) {
            var url = new URL("pluginadmin.ashx", window.location.href);
            url.searchParams.set("pin", browserPin);
            url.searchParams.set("asset", name);
            url.searchParams.set("v", browserVersion);
            return url.href;
        }

        function load(id, source) {
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

        function style(id, name) {
            if (document.getElementById(id)) return;
            var link = document.createElement("link");
            link.id = id;
            link.rel = "stylesheet";
            link.href = asset(name);
            (document.head || document.documentElement).appendChild(link);
        }

        style("sirk-platform-main-style", "main.css");
        style("sirk-platform-automation-style", "myscripts.css");
        style("sirk-platform-shared-style", "shared-ui/shared-ui.css");
        style("sirk-platform-toolbar-style", "shared-ui/toolbar.css");
        style("sirk-platform-native-approval-style", "native-approval.css");
        style("sirk-platform-device-tabs-style", "portal-device-tabs.css");

        var scripts = [
            ["sirk-platform-core", "core.js"],
            ["sirk-platform-mesh-core", "mesh-plugin-core.js"],
            ["sirk-platform-toolbar-config", "shared-ui/toolbar-config.js"],
            ["sirk-platform-toolbar-api", "shared-ui/toolbar-api.js"],
            ["sirk-platform-toolbar", "shared-ui/toolbar.js"],
            ["sirk-platform-tabs", "shared-ui/tabs.js"],
            ["sirk-platform-layout", "shared-ui/layout.js"],
            ["sirk-platform-settings", "shared-ui/settings.js"],
            ["sirk-platform-status-nav", "shared-ui/status-nav.js"],
            ["sirk-platform-tree", "shared-ui/tree.js"],
            ["sirk-platform-catalog", "shared-ui/catalog.js"],
            ["sirk-platform-results", "shared-ui/results.js"],
            ["sirk-platform-result-layout", "shared-ui/result-layout.js"],
            ["sirk-platform-script-tools", "shared-ui/script-tools.js"],
            ["sirk-platform-script-definition", "shared-ui/script-definition-form.js"],
            ["sirk-platform-confirm", "shared-ui/confirm-execution-form.js"],
            ["sirk-platform-edit-actions", "shared-ui/script-edit-actions.js"],
            ["sirk-platform-credentials", "shared-ui/system-credentials-form.js"],
            ["sirk-platform-page", "shared-ui/page.js"],
            ["sirk-platform-module-shell", "module-shell.js"],
            ["sirk-platform-device-tabs", "portal-device-tabs.js"],
            ["sirk-platform-runtime", "runtime.js"]
        ];

        scripts.reduce(function (chain, item) {
            return chain.then(function () { return load(item[0], asset(item[1])); });
        }, Promise.resolve()).then(function () {
            if (!window.SirkPlatformRuntime || typeof window.SirkPlatformRuntime.initialize !== "function") {
                throw new Error("SIRK Platform browser runtime was not loaded.");
            }
            return window.SirkPlatformRuntime.initialize();
        }).catch(function (error) {
            if (window.console) console.error("SIRK Platform browser startup failed", error);
        });
    };

    function browserRuntime() {
        return typeof window === "undefined" ? null : window.SirkPlatformRuntime || null;
    }
    obj.goPageStart = function (view) {
        var runtime = browserRuntime();
        if (runtime && typeof runtime.onNativePageStart === "function") runtime.onNativePageStart(view);
    };
    obj.goPageEnd = function (view) {
        var runtime = browserRuntime();
        if (runtime && typeof runtime.onNativePageEnd === "function") runtime.onNativePageEnd(view);
    };
    obj.onDeviceRefreshEnd = function (nodeId) {
        var runtime = browserRuntime();
        if (runtime && typeof runtime.onDeviceRefreshEnd === "function") runtime.onDeviceRefreshEnd(nodeId);
    };
    obj.commandResult = function (server, message) {
        var runtime = browserRuntime();
        if (runtime && typeof runtime.commandResult === "function") runtime.commandResult(message);
    };

    return obj;
}

module.exports.createPlugin = createPlugin;
