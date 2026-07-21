"use strict";

var createAdmin = require("./MyCompanyAdmin.js").admin;

function cleanError(error) {
    return String(error && (error.stack || error.message) || error || "Unknown MyCompany load error.");
}

function createFallbackRuntime(error) {
    var message = cleanError(error);

    function sendJson(res, status, value) {
        if (typeof res.status === "function") res.status(status);
        if (typeof res.set === "function") {
            res.set("Content-Type", "application/json; charset=utf-8");
        }
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
            sendJson(res, 503, {
                ok: false,
                error: "MyCompany runtime failed to load.",
                detail: message
            });
        },
        adminSnapshot: function () {
            return {
                plugin: { name: "My Company", version: "1.3.9" },
                modules: [],
                moduleSettings: {},
                integrations: {},
                migration: { completed: false, error: message },
                loadError: message,
                generatedAt: new Date().toISOString()
            };
        },
        saveAdminSettings: function () {
            return Promise.reject(new Error(
                "MyCompany runtime failed to load: " + message
            ));
        }
    };
}

function writeLoadError(parent, error) {
    try {
        var fs = parent.fs || require("fs");
        var path = parent.path || require("path");
        var meshServer = parent && parent.parent;
        var dataBase = meshServer && meshServer.datapath
            ? meshServer.datapath
            : path.dirname(parent.pluginPath || __dirname);
        var dataRoot = path.join(dataBase, "mycompany-data");

        if (!fs.existsSync(dataRoot)) {
            fs.mkdirSync(dataRoot, { recursive: true });
        }

        fs.writeFileSync(
            path.join(dataRoot, "plugin-load-error.log"),
            new Date().toISOString() + "\r\n" + cleanError(error) + "\r\n",
            "utf8"
        );
    } catch (ignored) {}
}

function createPlugin(parent, shortName) {
    var obj = {};
    obj.parent = parent;
    obj.meshServer = parent && parent.parent;
    obj.shortName = shortName || "MyCompany";
    obj.exports = [
        "onWebUIStartupEnd",
        "goPageStart",
        "goPageEnd",
        "onDeviceRefreshEnd",
        "commandResult"
    ];

    try {
        obj.runtime = require("./core/runtime.js").createRuntime({
            parent: parent,
            pluginRoot: __dirname,
            source: obj
        });
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

    obj.handleAdminReq = function (req, res, user) {
        return obj.admin.req(req, res, user);
    };

    obj.handleAdminPostReq = function (req, res, user) {
        return obj.admin.post(req, res, user);
    };

    obj.hook_processAgentData = function (command, agent) {
        if (
            obj.runtime &&
            typeof obj.runtime.captureAgentData === "function"
        ) {
            obj.runtime.captureAgentData(command, agent);
        }
    };

    obj.onWebUIStartupEnd = function () {
        if (typeof window === "undefined" || typeof document === "undefined") {
            return;
        }

        function asset(name) {
            var url = new URL("pluginadmin.ashx", window.location.href);
            url.searchParams.set("pin", obj.shortName || "MyCompany");
            url.searchParams.set("asset", name);
            url.searchParams.set("v", "1.3.9");
            return url.href;
        }

        function load(id, source) {
            return new Promise(function (resolve, reject) {
                var existing = document.getElementById(id);
                if (existing) {
                    if (existing.getAttribute("data-loaded") === "1") {
                        resolve();
                    } else {
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

        if (!document.getElementById("mycompany-main-style")) {
            var style = document.createElement("link");
            style.id = "mycompany-main-style";
            style.rel = "stylesheet";
            style.href = asset("main.css");
            (document.head || document.documentElement).appendChild(style);
        }

        if (!document.getElementById("mycompany-myscripts-style")) {
            var masterStyle = document.createElement("link");
            masterStyle.id = "mycompany-myscripts-style";
            masterStyle.rel = "stylesheet";
            masterStyle.href = asset("myscripts.css");
            (document.head || document.documentElement).appendChild(masterStyle);
        }

        [
            "shared-ui/shared-ui.css",
            "shared-ui/toolbar.css"
        ].forEach(function (source, index) {
            var id = "mycompany-shared-style-" + index;
            if (document.getElementById(id)) return;
            var sharedStyle = document.createElement("link");
            sharedStyle.id = id;
            sharedStyle.rel = "stylesheet";
            sharedStyle.href = asset(source);
            (document.head || document.documentElement).appendChild(sharedStyle);
        });

        load("mycompany-core-script", asset("core.js"))
            .then(function () {
                return load(
                    "mycompany-mesh-plugin-core-script",
                    asset("mesh-plugin-core.js")
                );
            })
            .then(function () {
                return load(
                    "mycompany-shared-toolbar-config",
                    asset("shared-ui/toolbar-config.js")
                );
            })
            .then(function () {
                return load(
                    "mycompany-shared-toolbar-api",
                    asset("shared-ui/toolbar-api.js")
                );
            })
            .then(function () {
                return load(
                    "mycompany-shared-toolbar",
                    asset("shared-ui/toolbar.js")
                );
            })
            .then(function () {
                return load(
                    "mycompany-shared-tabs",
                    asset("shared-ui/tabs.js")
                );
            })
            .then(function () {
                return load(
                    "mycompany-shared-layout",
                    asset("shared-ui/layout.js")
                );
            })
            .then(function () {
                return load(
                    "mycompany-shared-settings",
                    asset("shared-ui/settings.js")
                );
            })
            .then(function () {
                return load(
                    "mycompany-shared-status-nav",
                    asset("shared-ui/status-nav.js")
                );
            })
            .then(function () {
                return load(
                    "mycompany-shared-page",
                    asset("shared-ui/page.js")
                );
            })
            .then(function () {
                return load(
                    "mycompany-module-shell-script",
                    asset("module-shell.js")
                );
            })
            .then(function () {
                return load("mycompany-runtime-script", asset("runtime.js"));
            })
            .then(function () {
                return window.MyCompanyRuntime.initialize();
            })
            .catch(function (error) {
                if (window.console) {
                    console.error("MyCompany browser startup failed", error);
                }
            });
    };

    obj.goPageStart = function (view) {
        if (
            typeof window !== "undefined" &&
            window.MyCompanyRuntime &&
            typeof window.MyCompanyRuntime.onNativePageStart === "function"
        ) {
            window.MyCompanyRuntime.onNativePageStart(view);
        }
    };

    obj.goPageEnd = function (view) {
        if (
            typeof window !== "undefined" &&
            window.MyCompanyRuntime &&
            typeof window.MyCompanyRuntime.onNativePageEnd === "function"
        ) {
            window.MyCompanyRuntime.onNativePageEnd(view);
        }
    };

    obj.onDeviceRefreshEnd = function (nodeId) {
        if (
            typeof window !== "undefined" &&
            window.MyCompanyRuntime &&
            typeof window.MyCompanyRuntime.onDeviceRefreshEnd === "function"
        ) {
            window.MyCompanyRuntime.onDeviceRefreshEnd(nodeId);
        }
    };

    obj.commandResult = function (server, message) {
        if (
            typeof window !== "undefined" &&
            window.MyCompanyRuntime &&
            typeof window.MyCompanyRuntime.commandResult === "function"
        ) {
            window.MyCompanyRuntime.commandResult(message);
        }
    };

    (function registerAdminAlias() {
        if (!parent || !parent.plugins || !parent.exports) return;
        var alias = obj.shortName === "MyCompany" ? "mycompany" : "MyCompany";
        if (parent.plugins[alias]) return;

        parent.plugins[alias] = {
            exports: [],
            handleAdminReq: function (req, res, user) {
                return obj.handleAdminReq(req, res, user);
            },
            handleAdminPostReq: function (req, res, user) {
                return obj.handleAdminPostReq(req, res, user);
            }
        };
        parent.exports[alias] = [];
    }());

    return obj;
}

module.exports.createPlugin = createPlugin;
