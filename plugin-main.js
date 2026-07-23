"use strict";

var createAdmin = require("./MyCompanyAdmin.js").admin;
var VERSION = require("./config.json").version;

function cleanError(error) {
    return String(error && (error.stack || error.message) || error || "Unknown MyCompany load error.");
}

function createFallbackRuntime(error) {
    var message = cleanError(error);
    function sendJson(res, status, value) {
        if (typeof res.status === "function") res.status(status);
        else res.statusCode = status;
        if (typeof res.set === "function") res.set("Content-Type", "application/json; charset=utf-8");
        else if (typeof res.setHeader === "function") res.setHeader("Content-Type", "application/json; charset=utf-8");
        if (typeof res.json === "function") res.json(value);
        else if (typeof res.send === "function") res.send(JSON.stringify(value));
        else if (typeof res.end === "function") res.end(JSON.stringify(value));
    }
    return {
        loadError: message,
        modules: {},
        initialize: function () { return Promise.resolve(); },
        captureAgentData: function () {},
        request: function (method, moduleName, asset, req, res) {
            sendJson(res, 503, { ok: false, error: "MyCompany runtime failed to load." });
        },
        adminSnapshot: function () {
            return {
                plugin: { name: "My Company", version: VERSION },
                modules: [], moduleSettings: {}, integrations: {},
                migration: { completed: false, error: message },
                diagnostics: { logs: "", errors: message },
                loadError: message, generatedAt: new Date().toISOString()
            };
        },
        saveAdminSettings: function () { return Promise.reject(new Error("MyCompany runtime failed to load: " + message)); }
    };
}

function writeLoadError(parent, error) {
    try {
        var fs = parent.fs || require("fs");
        var path = parent.path || require("path");
        var meshServer = parent && parent.parent;
        var dataBase = meshServer && meshServer.datapath ? meshServer.datapath : path.dirname(parent.pluginPath || __dirname);
        var dataRoot = path.join(dataBase, "mycompany-data");
        if (!fs.existsSync(dataRoot)) fs.mkdirSync(dataRoot, { recursive: true });
        fs.writeFileSync(path.join(dataRoot, "plugin-load-error.log"), new Date().toISOString() + "\r\n" + cleanError(error) + "\r\n", "utf8");
    } catch (ignored) {}
}

function createPlugin(parent, shortName) {
    var obj = {};
    obj.parent = parent;
    obj.meshServer = parent && parent.parent;
    obj.shortName = shortName || "MyCompany";
    obj.exports = ["onWebUIStartupEnd", "goPageStart", "goPageEnd", "onDeviceRefreshEnd", "commandResult"];

    try {
        obj.runtime = require("./core/runtime-portal.js").createRuntime({ parent: parent, pluginRoot: __dirname, source: obj });
    } catch (error) {
        console.error("MyCompany runtime creation failed", error);
        writeLoadError(parent, error);
        obj.runtime = createFallbackRuntime(error);
    }

    obj.admin = createAdmin(obj);
    obj.server_startup = function () {
        Promise.resolve(obj.runtime.initialize()).catch(function (error) {
            console.error("MyCompany initialization failed", error);
            writeLoadError(parent, error);
        });
    };
    obj.handleAdminReq = function (req, res, user) { return obj.admin.req(req, res, user); };
    obj.handleAdminPostReq = function (req, res, user) { return obj.admin.post(req, res, user); };
    obj.hook_processAgentData = function (command, agent) {
        if (obj.runtime && typeof obj.runtime.captureAgentData === "function") obj.runtime.captureAgentData(command, agent);
    };

    obj.onWebUIStartupEnd = function () {
        if (typeof window === "undefined" || typeof document === "undefined") return;

        var browserVersion = "1.5.99";
        var browserPin = "MyCompany";
        window.__MYCOMPANY_VERSION__ = browserVersion;
        document.documentElement.classList.add("mycompany-native-ui");

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

        style("mycompany-main-style", "main.css");
        style("mycompany-myscripts-style", "myscripts.css");
        style("mycompany-shared-style-0", "shared-ui/shared-ui.css");
        style("mycompany-shared-style-1", "shared-ui/toolbar.css");
        style("mycompany-native-approval-style", "native-approval.css");
        style("mycompany-device-tabs-style", "portal-device-tabs.css");

        load("mycompany-core-script", asset("core.js"))
            .then(function () { return load("mycompany-mesh-plugin-core-script", asset("mesh-plugin-core.js")); })
            .then(function () { return load("mycompany-shared-toolbar-config", asset("shared-ui/toolbar-config.js")); })
            .then(function () { return load("mycompany-shared-toolbar-api", asset("shared-ui/toolbar-api.js")); })
            .then(function () { return load("mycompany-shared-toolbar", asset("shared-ui/toolbar.js")); })
            .then(function () { return load("mycompany-shared-tabs", asset("shared-ui/tabs.js")); })
            .then(function () { return load("mycompany-shared-layout", asset("shared-ui/layout.js")); })
            .then(function () { return load("mycompany-shared-settings", asset("shared-ui/settings.js")); })
            .then(function () { return load("mycompany-shared-status-nav", asset("shared-ui/status-nav.js")); })
            .then(function () { return load("mycompany-shared-tree", asset("shared-ui/tree.js")); })
            .then(function () { return load("mycompany-shared-catalog", asset("shared-ui/catalog.js")); })
            .then(function () { return load("mycompany-shared-results", asset("shared-ui/results.js")); })
            .then(function () { return load("mycompany-shared-result-layout", asset("shared-ui/result-layout.js")); })
            .then(function () { return load("mycompany-shared-script-tools", asset("shared-ui/script-tools.js")); })
            .then(function () { return load("mycompany-shared-script-definition", asset("shared-ui/script-definition-form.js")); })
            .then(function () { return load("mycompany-shared-confirm", asset("shared-ui/confirm-execution-form.js")); })
            .then(function () { return load("mycompany-shared-edit-actions", asset("shared-ui/script-edit-actions.js")); })
            .then(function () { return load("mycompany-shared-system-credentials", asset("shared-ui/system-credentials-form.js")); })
            .then(function () { return load("mycompany-shared-page", asset("shared-ui/page.js")); })
            .then(function () { return load("mycompany-module-shell-script", asset("module-shell.js")); })
            .then(function () { return load("mycompany-device-tabs-script", asset("portal-device-tabs.js")); })
            .then(function () { return load("mycompany-runtime-script", asset("runtime.js")); })
            .then(function () {
                if (!window.MyCompanyRuntime || typeof window.MyCompanyRuntime.initialize !== "function") throw new Error("MyCompany runtime was not loaded.");
                return window.MyCompanyRuntime.initialize();
            })
            .catch(function (error) { if (window.console) console.error("MyCompany browser startup failed", error); });
    };

    obj.goPageStart = function (view) {
        if (typeof window !== "undefined" && window.MyCompanyRuntime && typeof window.MyCompanyRuntime.onNativePageStart === "function") window.MyCompanyRuntime.onNativePageStart(view);
    };
    obj.goPageEnd = function (view) {
        if (typeof window !== "undefined" && window.MyCompanyRuntime && typeof window.MyCompanyRuntime.onNativePageEnd === "function") window.MyCompanyRuntime.onNativePageEnd(view);
    };
    obj.onDeviceRefreshEnd = function (nodeId) {
        if (typeof window !== "undefined" && window.MyCompanyRuntime && typeof window.MyCompanyRuntime.onDeviceRefreshEnd === "function") window.MyCompanyRuntime.onDeviceRefreshEnd(nodeId);
    };
    obj.commandResult = function (server, message) {
        if (typeof window !== "undefined" && window.MyCompanyRuntime && typeof window.MyCompanyRuntime.commandResult === "function") window.MyCompanyRuntime.commandResult(message);
    };

    (function registerAdminAlias() {
        if (!parent || !parent.plugins || !parent.exports) return;
        var alias = obj.shortName === "MyCompany" ? "mycompany" : "MyCompany";
        if (parent.plugins[alias]) return;
        parent.plugins[alias] = {
            exports: [],
            handleAdminReq: function (req, res, user) {
                var active = parent.plugins[obj.shortName];
                if (!active || typeof active.handleAdminReq !== "function") return;
                return active.handleAdminReq(req, res, user);
            },
            handleAdminPostReq: function (req, res, user) {
                var active = parent.plugins[obj.shortName];
                if (!active || typeof active.handleAdminPostReq !== "function") return;
                return active.handleAdminPostReq(req, res, user);
            }
        };
        parent.exports[alias] = [];
    }());

    return obj;
}

module.exports.createPlugin = createPlugin;