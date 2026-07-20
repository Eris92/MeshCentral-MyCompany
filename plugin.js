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

    function loadEmbedded() {
        var proxy = createParentProxy();
        manifest.forEach(function (item) {
            try {
                var entry = path.join(embeddedRoot, item.shortName, item.entry);
                var factory = require(entry)[item.exportName];
                if (typeof factory !== "function") throw new Error("Plugin factory was not exported.");
                embedded[item.key] = { meta: item, instance: factory(proxy) };
                console.log("MyCompany loaded embedded module:", item.key);
            } catch (error) {
                embedded[item.key] = { meta: item, error: error };
                console.log("MyCompany failed to load embedded module " + item.key + ":", error.stack || error);
            }
        });
    }

    function embeddedInstance(key) {
        return embedded[key] && embedded[key].instance;
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
        Object.keys(embedded).forEach(function (key) {
            var instance = embeddedInstance(key);
            if (instance && typeof instance.server_startup === "function") {
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
        app.modules = {
            scripts: { label: "Scripts", globals: ["MyScripts"] },
            commands: { label: "Commands", globals: ["MyCommands"] },
            approvals: { label: "Approvals", globals: ["ApprovalCenter"] },
            move: { label: "Move Requests", globals: ["MoveRequest"] }
        };

        window.MyCompanyAssetUrl = function (moduleName, assetName) {
            var endpoint = new URL("pluginadmin.ashx", window.location.href);
            endpoint.searchParams.set("pin", "mycompany");
            endpoint.searchParams.set("module", moduleName);
            endpoint.searchParams.set("asset", assetName);
            return endpoint.href;
        };

        function getGlobal(definition) {
            for (var index = 0; index < definition.globals.length; index++) {
                if (window[definition.globals[index]]) return window[definition.globals[index]];
            }
            return null;
        }

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

        function bootstrapModules() {
            var api = window.pluginHandler && window.pluginHandler.mycompany;
            if (!api) return;
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
            window.setTimeout(removeEmbeddedMenus, 500);
            window.setTimeout(removeEmbeddedMenus, 1500);
            window.setTimeout(removeEmbeddedMenus, 3500);
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

        app.ensureWorkspace = function () {
            var page = document.getElementById("p1");
            var titleHost = document.getElementById("p1title");
            if (!page || !titleHost) return null;
            var host = document.getElementById("MyCompanyWorkspace");
            if (host) return host;

            host = document.createElement("div");
            host.id = "MyCompanyWorkspace";
            host.style.display = "none";
            host.style.boxSizing = "border-box";
            host.style.width = "100%";
            host.style.height = "calc(100vh - 104px)";
            host.style.overflow = "auto";
            host.style.padding = "8px 12px 18px";

            var nav = document.createElement("div");
            nav.id = "MyCompanyNavigation";
            nav.style.display = "flex";
            nav.style.flexWrap = "wrap";
            nav.style.gap = "8px";
            nav.style.marginBottom = "10px";
            [["Scripts", "scripts"], ["Commands", "commands"], ["Approvals", "approvals"], ["Move Requests", "move"], ["Settings", "settings"]].forEach(function (pair) {
                var button = document.createElement("button");
                button.type = "button";
                button.className = "btn btn-secondary btn-sm";
                button.textContent = pair[0];
                button.onclick = function () { return app.showModule(pair[1]); };
                nav.appendChild(button);
            });
            host.appendChild(nav);

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

        app.showError = function (title, message) {
            if (!app.showNativePage()) return false;
            var content = document.getElementById("MyCompanyContent");
            content.innerHTML = "";
            var heading = document.createElement("h3");
            heading.textContent = title || "Module error";
            content.appendChild(heading);
            var status = document.createElement("div");
            status.className = "alert alert-danger";
            status.textContent = message || "The module could not be opened.";
            content.appendChild(status);
            app.active = true;
            window.xxcurrentView = 106;
            return false;
        };

        app.openApprovalCenter = function (providerType) {
            var approval = window.ApprovalCenter;
            if (!approval) return app.showError("Approval Center", "Approval Center UI has not loaded.");
            var open = function () {
                if (typeof approval.open !== "function") return app.showError("Approval Center", "Approval Center does not expose an open function.");
                approval.open();
                if (providerType && typeof approval.activateTab === "function") {
                    window.setTimeout(function () { approval.activateTab(providerType); }, 0);
                }
                return false;
            };
            var pending = approval.bootstrapPromise || (typeof approval.initialize === "function" ? approval.initialize() : null);
            if (pending && typeof pending.then === "function") {
                pending.then(open).catch(function (error) { app.showError("Approval Center", error && error.message || "Approval Center initialization failed."); });
                return false;
            }
            return open();
        };

        app.renderSettings = function () {
            if (!app.showNativePage()) return false;
            var content = document.getElementById("MyCompanyContent");
            content.innerHTML = "";
            var heading = document.createElement("h3");
            heading.textContent = "Embedded modules";
            content.appendChild(heading);
            Object.keys(app.modules).forEach(function (key) {
                var definition = app.modules[key];
                var target = getGlobal(definition);
                var ready = false;
                if (key === "scripts") ready = !!(target && typeof target.open === "function");
                else if (key === "commands") ready = !!(target && typeof target.openStandalone === "function");
                else if (key === "approvals") ready = !!(target && typeof target.open === "function");
                else if (key === "move") ready = !!(target && typeof target.openHostDialog === "function");
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
            if (key === "settings") return app.renderSettings();
            app.restoreNativePage();
            app.active = false;
            app.activeModule = key;

            if (key === "scripts") {
                if (window.MyScripts && typeof window.MyScripts.open === "function") return window.MyScripts.open();
                return app.showError("Scripts", "My Scripts UI has not loaded.");
            }
            if (key === "commands") {
                if (window.MyCommands && typeof window.MyCommands.openStandalone === "function") return window.MyCommands.openStandalone();
                return app.showError("Commands", "My Commands UI has not loaded or access is not granted.");
            }
            if (key === "approvals") return app.openApprovalCenter("");
            if (key === "move") return app.openApprovalCenter("moverequest");
            return app.showError("Module", "Unknown module: " + key);
        };

        app.open = function (event) {
            if (event) { if (event.preventDefault) event.preventDefault(); if (event.stopPropagation) event.stopPropagation(); }
            if (typeof window.go === "function") window.go(1);
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

        bootstrapModules();
        app.ensureWorkspace();
        app.ensureMenus();
        window.setTimeout(app.ensureMenus, 1000);
        window.setTimeout(app.ensureMenus, 3000);
    };

    obj.goPageStart = function (view) {
        if (typeof window === "undefined") return;
        if (window.MyCompany && window.MyCompany.active) window.MyCompany.restoreNativePage();
        if (window.MyScripts && typeof window.MyScripts.onNativePageStart === "function") window.MyScripts.onNativePageStart(view);
        if (window.MyCommands && typeof window.MyCommands.onNativePageStart === "function") window.MyCommands.onNativePageStart(view);
        if (window.ApprovalCenter && typeof window.ApprovalCenter.onNativePageStart === "function") window.ApprovalCenter.onNativePageStart(view);
    };

    obj.goPageEnd = function (view) {
        if (typeof window === "undefined") return;
        if (window.MyScripts && typeof window.MyScripts.onNativePageEnd === "function") window.MyScripts.onNativePageEnd(view);
        if (window.MyCommands && typeof window.MyCommands.onNativePageEnd === "function") window.MyCommands.onNativePageEnd(view);
        if (window.ApprovalCenter && typeof window.ApprovalCenter.onNativePageEnd === "function") window.ApprovalCenter.onNativePageEnd(view);
        if (window.MyCompany) window.MyCompany.ensureMenus();
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
