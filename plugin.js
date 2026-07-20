"use strict";

var fs = require("fs");
var path = require("path");

module.exports.mycompany = function (parent) {
    var obj = {};
    var pluginRoot = path.join(parent.pluginPath, "mycompany");
    var embeddedRoot = path.join(pluginRoot, "embedded");
    var manifestPath = path.join(pluginRoot, "embedded-manifest.json");
    var manifest = [];
    var embedded = {};

    try { manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")); }
    catch (error) { console.log("MyCompany embedded manifest is missing:", error.message); }

    function createParentProxy() {
        var proxy = Object.create(parent);
        Object.keys(parent || {}).forEach(function (key) { proxy[key] = parent[key]; });
        proxy.pluginPath = embeddedRoot;
        return proxy;
    }

    function embeddedInstance(key) {
        return embedded[key] && embedded[key].instance;
    }

    function loadEmbedded() {
        var proxy = createParentProxy();
        manifest.forEach(function (item) {
            try {
                var entry = path.join(embeddedRoot, item.shortName, item.entry);
                var factory = require(entry)[item.exportName];
                if (typeof factory !== "function") throw new Error("Plugin factory was not exported.");
                var instance = factory(proxy);
                embedded[item.key] = { meta: item, instance: instance };

                if (parent && parent.plugins) parent.plugins[item.shortName] = instance;
                if (parent && parent.exports) parent.exports[item.shortName] = Array.isArray(instance.exports) ? instance.exports : [];

                console.log("MyCompany loaded embedded module:", item.key, "as", item.shortName);
            } catch (error) {
                embedded[item.key] = { meta: item, error: error };
                console.log("MyCompany failed to load embedded module " + item.key + ":", error.stack || error);
            }
        });
    }

    loadEmbedded();

    obj.parent = parent;
    obj.meshServer = parent && parent.parent;
    obj.exports = ["onWebUIStartupEnd", "goPageStart", "goPageEnd", "onDeviceRefreshEnd", "commandResult"];

    [
        ["scripts", "embeddedScriptsStartup"],
        ["commands", "embeddedCommandsStartup"],
        ["approvals", "embeddedApprovalsStartup"],
        ["move", "embeddedMoveStartup"]
    ].forEach(function (pair) {
        var instance = embeddedInstance(pair[0]);
        if (instance && typeof instance.onWebUIStartupEnd === "function") {
            obj[pair[1]] = instance.onWebUIStartupEnd;
            obj.exports.push(pair[1]);
        }
    });

    obj.server_startup = function () {
        ["approvals", "move", "commands", "scripts"].forEach(function (key) {
            var instance = embeddedInstance(key);
            if (!instance || instance.__myCompanyStarted) return;
            instance.__myCompanyStarted = true;
            if (typeof instance.server_startup === "function") {
                try { instance.server_startup(); }
                catch (error) { console.log("MyCompany module startup failed " + key + ":", error.stack || error); }
            }
        });
    };

    obj.handleAdminReq = function (req, res, user) {
        var key = String(req && req.query && req.query.module || "");
        var instance = embeddedInstance(key);
        if (!instance || typeof instance.handleAdminReq !== "function") {
            res.statusCode = 404;
            res.setHeader("Content-Type", "application/json; charset=utf-8");
            res.end(JSON.stringify({ ok: false, error: "Embedded module is unavailable: " + key }));
            return;
        }
        return instance.handleAdminReq(req, res, user);
    };

    obj.handleAdminPostReq = function (req, res, user) {
        var key = String(req && req.query && req.query.module || "");
        var instance = embeddedInstance(key);
        if (!instance || typeof instance.handleAdminPostReq !== "function") {
            res.statusCode = 404;
            res.setHeader("Content-Type", "application/json; charset=utf-8");
            res.end(JSON.stringify({ ok: false, error: "Embedded module POST endpoint is unavailable: " + key }));
            return;
        }
        return instance.handleAdminPostReq(req, res, user);
    };

    var commandsInstance = embeddedInstance("commands");
    if (commandsInstance) {
        if (typeof commandsInstance.hook_processAgentData === "function") obj.hook_processAgentData = function () { return commandsInstance.hook_processAgentData.apply(commandsInstance, arguments); };
        if (typeof commandsInstance.serveraction === "function") obj.serveraction = function () { return commandsInstance.serveraction.apply(commandsInstance, arguments); };
    }

    var approvalsInstance = embeddedInstance("approvals");
    if (approvalsInstance) {
        if (typeof approvalsInstance.hook_setupHttpHandlers === "function") obj.hook_setupHttpHandlers = function () { return approvalsInstance.hook_setupHttpHandlers.apply(approvalsInstance, arguments); };
        if (typeof approvalsInstance.handleExternalApi === "function") obj.handleExternalApi = function () { return approvalsInstance.handleExternalApi.apply(approvalsInstance, arguments); };
    }

    obj.onWebUIStartupEnd = function () {
        if (typeof window === "undefined" || typeof document === "undefined") return;
        if (window.MyCompany && window.MyCompany.initialized) return;

        var app = window.MyCompany = window.MyCompany || {};
        app.initialized = true;
        app.active = false;
        app.activeModule = "settings";
        app.nativeState = null;
        app.inMyCompany = false;
        app.openingEmbedded = false;
        app.modules = {
            scripts: { label: "Scripts", globals: ["MyScripts"] },
            commands: { label: "Commands", globals: ["MyCommands"] },
            approvals: { label: "Approvals", globals: ["ApprovalCenter"] },
            move: { label: "Move Requests", globals: ["MoveRequest"] },
            settings: { label: "Settings", globals: [] }
        };

        window.MyCompanyAssetUrl = function (moduleName, assetName) {
            var endpoint = new URL("pluginadmin.ashx", window.location.href);
            endpoint.searchParams.set("pin", "mycompany");
            endpoint.searchParams.set("module", moduleName);
            endpoint.searchParams.set("asset", assetName);
            endpoint.searchParams.set("v", "0.5.2");
            return endpoint.href;
        };

        function getGlobal(definition) {
            var names = definition && definition.globals || [];
            for (var index = 0; index < names.length; index++) {
                if (window[names[index]]) return window[names[index]];
            }
            return null;
        }

        function loadScript(id, source, readyCheck) {
            if (typeof readyCheck === "function" && readyCheck()) return Promise.resolve();
            var existing = document.getElementById(id);
            if (existing && existing.getAttribute("data-mycompany-loaded") === "1") return Promise.resolve();
            if (existing && existing.parentNode) existing.parentNode.removeChild(existing);

            return new Promise(function (resolve, reject) {
                var script = document.createElement("script");
                script.id = id;
                script.src = source;
                script.async = false;
                script.onload = function () {
                    script.setAttribute("data-mycompany-loaded", "1");
                    resolve();
                };
                script.onerror = function () {
                    if (script.parentNode) script.parentNode.removeChild(script);
                    reject(new Error("Could not load " + source));
                };
                (document.head || document.documentElement).appendChild(script);
            });
        }

        function loadStyle(id, source) {
            var existing = document.getElementById(id);
            if (existing) return;
            var style = document.createElement("link");
            style.id = id;
            style.rel = "stylesheet";
            style.href = source;
            (document.head || document.documentElement).appendChild(style);
        }

        app.bootstrapApprovalCenter = function () {
            var approval = window.ApprovalCenter = window.ApprovalCenter || {};
            if (typeof approval.open === "function" && typeof approval.initialize === "function") {
                return Promise.resolve(approval.initialize()).then(function () { return approval; });
            }
            if (app.approvalBootstrapPromise) return app.approvalBootstrapPromise;

            loadStyle("mycompany-approvalcenter-style", window.MyCompanyAssetUrl("approvals", "plugin.css"));

            app.approvalBootstrapPromise = loadScript(
                "mycompany-approvalcenter-core",
                window.MyCompanyAssetUrl("approvals", "core.js"),
                function () { return !!window.MeshPluginCore; }
            ).then(function () {
                return loadScript(
                    "mycompany-approvalcenter-main",
                    window.MyCompanyAssetUrl("approvals", "main.js"),
                    function () { return !!(window.ApprovalCenter && typeof window.ApprovalCenter.open === "function"); }
                );
            }).then(function () {
                return loadScript(
                    "mycompany-approvalcenter-noapproval",
                    window.MyCompanyAssetUrl("approvals", "noapproval.js"),
                    function () { return document.getElementById("approvalcenter-noapproval-script") != null; }
                );
            }).then(function () {
                var current = window.ApprovalCenter;
                if (!current || typeof current.initialize !== "function" || typeof current.open !== "function") {
                    throw new Error("Approval Center scripts loaded, but the UI API is missing.");
                }
                return Promise.resolve(current.initialize()).then(function () { return current; });
            }).catch(function (error) {
                app.approvalBootstrapPromise = null;
                throw error;
            });

            approval.bootstrapPromise = app.approvalBootstrapPromise;
            return app.approvalBootstrapPromise;
        };

        app.bootstrapMoveRequest = function () {
            var move = window.MoveRequest = window.MoveRequest || {};
            if (typeof move.initialize === "function") return Promise.resolve(move.initialize()).then(function () { return move; });
            if (app.moveBootstrapPromise) return app.moveBootstrapPromise;

            app.moveBootstrapPromise = loadScript(
                "mycompany-moverequest-core",
                window.MyCompanyAssetUrl("move", "core.js"),
                function () { return !!window.MeshPluginCore; }
            ).then(function () {
                return loadScript(
                    "mycompany-moverequest-main",
                    window.MyCompanyAssetUrl("move", "main.js"),
                    function () { return !!(window.MoveRequest && typeof window.MoveRequest.initialize === "function"); }
                );
            }).then(function () {
                var current = window.MoveRequest;
                if (!current || typeof current.initialize !== "function") throw new Error("Move Request UI API is missing.");
                return Promise.resolve(current.initialize()).then(function () { return current; });
            }).catch(function (error) {
                app.moveBootstrapPromise = null;
                throw error;
            });

            return app.moveBootstrapPromise;
        };

        function removeEmbeddedMenus() {
            [
                "MainMenuMyScripts", "LeftMenuMyScripts",
                "MainMenuMyCommands", "LeftMenuMyCommands",
                "MainMenuApprovalCenter", "LeftMenuApprovalCenter",
                "MainMenuMoveRequest", "LeftMenuMoveRequest",
                "MainMenuMoveRequests", "LeftMenuMoveRequests"
            ].forEach(function (id) {
                var node = document.getElementById(id);
                if (node && node.parentNode) node.parentNode.removeChild(node);
            });
        }

        function invokeEmbeddedStartups() {
            var api = window.pluginHandler && window.pluginHandler.mycompany;
            if (api) {
                [
                    ["scripts", "embeddedScriptsStartup"],
                    ["commands", "embeddedCommandsStartup"],
                    ["approvals", "embeddedApprovalsStartup"],
                    ["move", "embeddedMoveStartup"]
                ].forEach(function (pair) {
                    if (typeof api[pair[1]] === "function") {
                        try { api[pair[1]](); }
                        catch (error) { if (window.console) console.error("MyCompany module bootstrap failed: " + pair[0], error); }
                    }
                });
            }

            app.bootstrapApprovalCenter().catch(function (error) {
                if (window.console) console.error("MyCompany direct Approval Center bootstrap failed", error);
            });
            app.bootstrapMoveRequest().catch(function (error) {
                if (window.console) console.error("MyCompany direct Move Request bootstrap failed", error);
            });
        }

        function hideElement(element) {
            if (!element) return null;
            var state = { element: element, display: element.style.display };
            element.style.display = "none";
            return state;
        }

        function restoreElement(state) {
            if (state && state.element) state.element.style.display = state.display;
        }

        app.ensureNavigation = function () {
            var titleHost = document.getElementById("p1title");
            if (!titleHost) return null;

            var navigation = document.getElementById("MyCompanyNavigation");
            if (navigation) {
                if (navigation.parentNode !== titleHost) titleHost.appendChild(navigation);
                return navigation;
            }

            navigation = document.createElement("div");
            navigation.id = "MyCompanyNavigation";
            navigation.style.display = "none";
            navigation.style.flexWrap = "wrap";
            navigation.style.gap = "8px";
            navigation.style.width = "100%";
            navigation.style.boxSizing = "border-box";
            navigation.style.marginTop = "8px";
            navigation.style.padding = "0 0 4px 0";

            [
                ["Scripts", "scripts"],
                ["Commands", "commands"],
                ["Approvals", "approvals"],
                ["Move Requests", "move"],
                ["Settings", "settings"]
            ].forEach(function (pair) {
                var button = document.createElement("button");
                button.type = "button";
                button.className = "btn btn-secondary btn-sm";
                button.textContent = pair[0];
                button.setAttribute("data-mycompany-module", pair[1]);
                button.onclick = function (event) {
                    if (event) {
                        if (event.preventDefault) event.preventDefault();
                        if (event.stopPropagation) event.stopPropagation();
                    }
                    return app.showModule(pair[1]);
                };
                navigation.appendChild(button);
            });

            titleHost.appendChild(navigation);
            return navigation;
        };

        app.showNavigation = function (key) {
            var navigation = app.ensureNavigation();
            if (!navigation) return;
            navigation.style.display = "flex";
            Array.prototype.forEach.call(navigation.querySelectorAll("[data-mycompany-module]"), function (button) {
                var active = button.getAttribute("data-mycompany-module") === key;
                button.className = active ? "btn btn-primary btn-sm" : "btn btn-secondary btn-sm";
            });
        };

        app.hideNavigation = function () {
            var navigation = document.getElementById("MyCompanyNavigation");
            if (navigation) navigation.style.display = "none";
        };

        app.closeActivePlugin = function () {
            var closed = [];
            var active = window.MeshPluginCore && window.MeshPluginCore.activePlugin;
            var candidates = [active, window.ApprovalCenter, window.MyScripts, window.MyCommands];
            candidates.forEach(function (plugin) {
                if (!plugin || closed.indexOf(plugin) >= 0) return;
                closed.push(plugin);
                if (plugin.state && plugin.state.active && typeof plugin.close === "function") {
                    try { plugin.close(false); } catch (error) { }
                }
            });
        };

        app.ensureWorkspace = function () {
            var page = document.getElementById("p1");
            var titleHost = document.getElementById("p1title");
            if (!page || !titleHost) return null;
            app.ensureNavigation();

            var host = document.getElementById("MyCompanyWorkspace");
            if (host) return host;

            host = document.createElement("div");
            host.id = "MyCompanyWorkspace";
            host.style.display = "none";
            host.style.boxSizing = "border-box";
            host.style.width = "100%";
            host.style.height = "calc(100vh - 150px)";
            host.style.overflow = "auto";
            host.style.padding = "8px 12px 18px";

            var content = document.createElement("div");
            content.id = "MyCompanyContent";
            content.style.border = "1px solid rgba(127,127,127,.65)";
            content.style.borderRadius = "5px";
            content.style.padding = "18px";
            content.style.minHeight = "260px";
            host.appendChild(content);
            page.appendChild(host);
            return host;
        };

        app.showNativePage = function () {
            var page = document.getElementById("p1");
            var titleHost = document.getElementById("p1title");
            var workspace = app.ensureWorkspace();
            if (!page || !titleHost || !workspace) return null;
            var heading = titleHost.querySelector("h1") || titleHost.querySelector(".fs-4") || titleHost.querySelector("h2");
            if (!app.nativeState) {
                var hidden = [];
                for (var child = page.firstElementChild; child; child = child.nextElementSibling) {
                    if (child !== titleHost && child !== workspace) hidden.push(hideElement(child));
                }
                app.nativeState = { heading: heading, headingText: heading ? heading.textContent : "", hidden: hidden };
            }
            if (heading) heading.textContent = "My Company";
            workspace.style.display = "block";
            page.style.display = "";
            return page;
        };

        app.restoreNativePage = function () {
            if (!app.nativeState) return;
            if (app.nativeState.heading) app.nativeState.heading.textContent = app.nativeState.headingText;
            (app.nativeState.hidden || []).forEach(restoreElement);
            var workspace = document.getElementById("MyCompanyWorkspace");
            if (workspace) workspace.style.display = "none";
            app.nativeState = null;
        };

        app.showStatus = function (title, message, isError) {
            app.inMyCompany = true;
            app.showNavigation(app.activeModule || "settings");
            if (!app.showNativePage()) return false;
            var content = document.getElementById("MyCompanyContent");
            content.innerHTML = "";
            var heading = document.createElement("h3");
            heading.textContent = title || "My Company";
            content.appendChild(heading);
            var status = document.createElement("div");
            status.className = isError ? "alert alert-danger" : "alert alert-info";
            status.textContent = message || "";
            content.appendChild(status);
            app.active = true;
            window.xxcurrentView = 106;
            return false;
        };

        app.openApprovalCenter = function (providerType) {
            var title = providerType === "moverequest" ? "Move Requests" : "Approval Center";
            app.activeModule = providerType === "moverequest" ? "move" : "approvals";
            app.inMyCompany = true;
            app.showNavigation(app.activeModule);
            app.closeActivePlugin();
            app.showStatus(title, "Loading...", false);

            app.bootstrapApprovalCenter().then(function (approval) {
                app.restoreNativePage();
                app.active = false;
                app.openingEmbedded = true;
                approval.open();
                app.showNavigation(app.activeModule);
                if (providerType && typeof approval.activateTab === "function") {
                    window.setTimeout(function () {
                        approval.activateTab(providerType);
                        app.showNavigation(app.activeModule);
                    }, 50);
                }
                window.setTimeout(function () {
                    app.openingEmbedded = false;
                    app.showNavigation(app.activeModule);
                }, 150);
            }).catch(function (error) {
                app.openingEmbedded = false;
                var prefix = providerType === "moverequest" ? "Move Requests uses Approval Center. " : "";
                app.showStatus(title, prefix + (error && error.message || "Approval Center initialization failed."), true);
            });
            return false;
        };

        app.renderSettings = function () {
            app.activeModule = "settings";
            app.inMyCompany = true;
            app.closeActivePlugin();
            app.showNavigation("settings");
            if (!app.showNativePage()) return false;

            var content = document.getElementById("MyCompanyContent");
            content.innerHTML = "";
            var heading = document.createElement("h3");
            heading.textContent = "Settings";
            content.appendChild(heading);

            var description = document.createElement("p");
            description.textContent = "Embedded module status";
            content.appendChild(description);

            ["scripts", "commands", "approvals", "move"].forEach(function (key) {
                var definition = app.modules[key];
                var target = getGlobal(definition);
                var ready = false;
                if (key === "scripts") ready = !!(target && typeof target.open === "function");
                else if (key === "commands") ready = !!(target && typeof target.openStandalone === "function");
                else if (key === "approvals") ready = !!(target && typeof target.open === "function");
                else if (key === "move") ready = !!(target && typeof target.initialize === "function");

                var row = document.createElement("div");
                row.style.padding = "10px 0";
                row.style.borderBottom = "1px solid rgba(127,127,127,.25)";
                var title = document.createElement("strong");
                title.textContent = definition.label;
                row.appendChild(title);
                var detail = document.createElement("div");
                detail.textContent = ready ? "Embedded and initialized" : "Embedded - UI is initializing";
                detail.style.opacity = ".8";
                row.appendChild(detail);
                content.appendChild(row);
            });

            app.active = true;
            window.xxcurrentView = 106;
            return false;
        };

        app.showModule = function (key) {
            if (!app.modules[key]) return app.showStatus("Module", "Unknown module: " + key, true);
            if (key === "settings") return app.renderSettings();

            app.activeModule = key;
            app.inMyCompany = true;
            app.showNavigation(key);
            app.closeActivePlugin();
            app.restoreNativePage();
            app.active = false;
            app.openingEmbedded = true;

            if (key === "scripts") {
                if (window.MyScripts && typeof window.MyScripts.open === "function") {
                    var scriptsResult = window.MyScripts.open();
                    window.setTimeout(function () { app.openingEmbedded = false; app.showNavigation("scripts"); }, 100);
                    return scriptsResult;
                }
                app.openingEmbedded = false;
                invokeEmbeddedStartups();
                return app.showStatus("Scripts", "My Scripts UI is still loading. Try again in a moment.", true);
            }

            if (key === "commands") {
                if (window.MyCommands && typeof window.MyCommands.openStandalone === "function") {
                    var commandsResult = window.MyCommands.openStandalone();
                    window.setTimeout(function () { app.openingEmbedded = false; app.showNavigation("commands"); }, 100);
                    return commandsResult;
                }
                app.openingEmbedded = false;
                invokeEmbeddedStartups();
                return app.showStatus("Commands", "My Commands UI is still loading or access is not granted.", true);
            }

            app.openingEmbedded = false;
            if (key === "approvals") return app.openApprovalCenter("");
            if (key === "move") return app.openApprovalCenter("moverequest");
            return false;
        };

        app.open = function (event) {
            if (event) {
                if (event.preventDefault) event.preventDefault();
                if (event.stopPropagation) event.stopPropagation();
            }
            app.inMyCompany = true;
            app.activeModule = "settings";
            app.openingEmbedded = true;
            if (typeof window.go === "function") window.go(1);
            app.openingEmbedded = false;
            return app.renderSettings();
        };

        app.ensureMenus = function () {
            var mainAnchor = document.getElementById("MainMenuMyDevices");
            if (mainAnchor && mainAnchor.parentNode && !document.getElementById("MainMenuMyCompany")) {
                var main = mainAnchor.cloneNode(false);
                main.id = "MainMenuMyCompany";
                main.textContent = "My Company";
                main.title = "My Company";
                main.href = "#";
                main.onclick = app.open;
                main.onmouseup = app.open;
                mainAnchor.parentNode.insertBefore(main, mainAnchor.nextSibling);
            }

            var leftAnchor = document.getElementById("LeftMenuMyDevices");
            if (leftAnchor && leftAnchor.parentNode && !document.getElementById("LeftMenuMyCompany")) {
                var left = leftAnchor.cloneNode(true);
                left.id = "LeftMenuMyCompany";
                left.title = "My Company";
                left.href = "#";
                left.onclick = app.open;
                left.onmouseup = app.open;
                leftAnchor.parentNode.insertBefore(left, leftAnchor.nextSibling);
            }
        };

        [0, 100, 500, 1500, 3000].forEach(function (delay) {
            window.setTimeout(invokeEmbeddedStartups, delay);
        });
        [800, 1800, 3500].forEach(function (delay) {
            window.setTimeout(removeEmbeddedMenus, delay);
        });

        app.ensureWorkspace();
        app.ensureNavigation();
        app.ensureMenus();
        window.setTimeout(app.ensureMenus, 1000);
        window.setTimeout(app.ensureMenus, 3000);
    };

    obj.goPageStart = function (view) {
        if (typeof window === "undefined") return;
        var app = window.MyCompany;
        if (app && app.active) app.restoreNativePage();
        if (app && !app.openingEmbedded) {
            app.inMyCompany = false;
            app.hideNavigation();
        }
        if (window.MyScripts && typeof window.MyScripts.onNativePageStart === "function") window.MyScripts.onNativePageStart(view);
        if (window.MyCommands && typeof window.MyCommands.onNativePageStart === "function") window.MyCommands.onNativePageStart(view);
        if (window.ApprovalCenter && typeof window.ApprovalCenter.onNativePageStart === "function") window.ApprovalCenter.onNativePageStart(view);
    };

    obj.goPageEnd = function (view) {
        if (typeof window === "undefined") return;
        if (window.MyScripts && typeof window.MyScripts.onNativePageEnd === "function") window.MyScripts.onNativePageEnd(view);
        if (window.MyCommands && typeof window.MyCommands.onNativePageEnd === "function") window.MyCommands.onNativePageEnd(view);
        if (window.ApprovalCenter && typeof window.ApprovalCenter.onNativePageEnd === "function") window.ApprovalCenter.onNativePageEnd(view);
        if (window.MyCompany) {
            window.MyCompany.ensureMenus();
            window.MyCompany.ensureNavigation();
            if (window.MyCompany.inMyCompany) window.MyCompany.showNavigation(window.MyCompany.activeModule || "settings");
        }
    };

    obj.onDeviceRefreshEnd = function (nodeId) {
        if (typeof window === "undefined") return;
        if (window.MyCommands) {
            window.MyCommands.pendingNodeId = nodeId;
            if (typeof window.MyCommands.onDeviceRefreshEnd === "function") window.MyCommands.onDeviceRefreshEnd(nodeId);
        }
        if (window.MoveRequest) {
            if (typeof window.MoveRequest.setHostNodeId === "function") window.MoveRequest.setHostNodeId(nodeId);
            if (typeof window.MoveRequest.scheduleHostButton === "function") window.MoveRequest.scheduleHostButton();
        }
    };

    obj.commandResult = function (server, message) {
        if (typeof window !== "undefined" && window.MyCommands && typeof window.MyCommands.commandResult === "function") window.MyCommands.commandResult(message);
    };

    return obj;
};
