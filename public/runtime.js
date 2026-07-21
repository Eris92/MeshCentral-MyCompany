(function () {
    "use strict";
    window.MyCompanyRuntime = window.MyCompanyRuntime || {};
    window.MyCompanyModules = window.MyCompanyModules || {};
    var runtime = window.MyCompanyRuntime;
    var core = window.MyCompanyCore;
    runtime.state = runtime.state || { bootstrap: null, initializePromise: null, nodeId: "" };
    var files = {
        approvalcenter: "approvalcenter.js",
        moverequests: "moverequests.js",
        mycommands: "mycommands.js",
        myjira: "myjira.js",
        defendertools: "defendertools.js",
        myscripts: "myscripts.js",
        portal: "portal.js"
    };
    var order = ["approvalcenter", "moverequests", "mycommands", "myjira", "defendertools", "myscripts", "portal"];

    function installCredentialsActions() {
        if (!window.SharedScriptTools || window.__myCompanyCredentialsActions) return;
        window.__myCompanyCredentialsActions = true;
        var originalCreate = window.SharedScriptTools.create;
        window.SharedScriptTools.create = function (options) {
            var tools = originalCreate.call(window.SharedScriptTools, options);
            var originalActions = tools.scriptActions;
            tools.scriptActions = function (script, config) {
                config = config || {};
                var actions = originalActions.call(tools, script, config) || [];
                var hasCredentials = !!(script && (
                    (Array.isArray(script.secretVariables) && script.secretVariables.length) ||
                    (Array.isArray(script.secretDefinitions) && script.secretDefinitions.length)
                ));
                if (hasCredentials && config.canEdit === true && !actions.some(function (action) {
                    return action && action.key === "credentials";
                })) {
                    actions.unshift({
                        key: "credentials",
                        icon: "🔑",
                        className: "mc-tree-credentials-action",
                        title: "Edit script credentials",
                        onClick: function () {
                            if (typeof config.onCredentials === "function") config.onCredentials(script);
                            else if (typeof config.onEdit === "function") config.onEdit(script);
                        }
                    });
                }
                return actions;
            };
            return tools;
        };
    }

    function notify(method) {
        var args = Array.prototype.slice.call(arguments, 1);
        Object.keys(window.MyCompanyModules).forEach(function (key) {
            var module = window.MyCompanyModules[key];
            if (module && typeof module[method] === "function") {
                try { module[method].apply(module, args); }
                catch (error) {
                    if (window.console) console.error("MyCompany " + key + " " + method + " failed", error);
                }
            }
        });
    }

    runtime.initialize = function () {
        if (runtime.state.initializePromise) return runtime.state.initializePromise;
        runtime.state.initializePromise = core.api("", "bootstrap").then(function (bootstrap) {
            runtime.state.bootstrap = bootstrap;
            var chain = core.loadScript(
                "mycompany-shared-directory-tree",
                core.assetUrl("", "shared-ui/tree.js")
            ).then(function () {
                return core.loadScript(
                    "mycompany-shared-catalog-view",
                    core.assetUrl("", "shared-ui/catalog.js")
                );
            }).then(function () {
                return core.loadScript(
                    "mycompany-shared-results-view",
                    core.assetUrl("", "shared-ui/results.js")
                );
            }).then(function () {
                return core.loadScript(
                    "mycompany-shared-result-layout",
                    core.assetUrl("", "shared-ui/result-layout.js")
                );
            }).then(function () {
                return core.loadScript(
                    "mycompany-shared-script-tools",
                    core.assetUrl("", "shared-ui/script-tools.js")
                );
            }).then(function () {
                return core.loadScript(
                    "mycompany-shared-script-definition-form",
                    core.assetUrl("", "shared-ui/script-definition-form.js")
                );
            }).then(function () {
                return core.loadScript(
                    "mycompany-shared-confirm-execution-form",
                    core.assetUrl("", "shared-ui/confirm-execution-form.js")
                );
            }).then(function () {
                installCredentialsActions();
                return core.loadScript(
                    "mycompany-shared-script-edit-actions",
                    core.assetUrl("", "shared-ui/script-edit-actions.js")
                );
            }).then(function () {
                return core.loadScript(
                    "mycompany-shared-system-credentials-form",
                    core.assetUrl("", "shared-ui/system-credentials-form.js")
                );
            });
            order.forEach(function (key) {
                var state = bootstrap.modules[key];
                if (!state || !state.enabled || state.ready === false) return;
                if (key === "portal" && window.top !== window.self) return;
                if (key === "portal" && state.config && state.config.standaloneConflict === true) {
                    if (window.console) {
                        console.error("MyCompany Portal was not loaded because standalone SirKPortal is active.");
                    }
                    return;
                }
                chain = chain.then(function () {
                    return core.loadScript("mycompany-module-" + key, core.assetUrl("", files[key]));
                }).then(function () {
                    var module = window.MyCompanyModules[key];
                    if (!module || typeof module.initialize !== "function") return null;
                    return Promise.resolve(module.initialize(state)).then(function () {
                        if (runtime.state.nodeId && typeof module.onDeviceRefreshEnd === "function") {
                            module.onDeviceRefreshEnd(runtime.state.nodeId);
                        }
                    });
                }).then(function () {
                    if (key !== "portal") return null;
                    return core.loadScript("mycompany-portal-final-fix", core.assetUrl("", "portal-fix.js"));
                });
            });
            return chain;
        }).catch(function (error) {
            runtime.state.initializePromise = null;
            throw error;
        });
        return runtime.state.initializePromise;
    };

    runtime.onNativePageStart = function (view) {
        if (core.workspaceState && Number(view) !== Number(window.xxcurrentView)) core.restoreWorkspace();
        notify("onNativePageStart", view);
    };

    runtime.onNativePageEnd = function (view) {
        notify("onNativePageEnd", view);
    };

    runtime.onDeviceRefreshEnd = function (nodeId) {
        runtime.state.nodeId = String(nodeId || "");
        notify("onDeviceRefreshEnd", runtime.state.nodeId);
    };

    runtime.commandResult = function (message) {
        notify("commandResult", message);
    };
}());
