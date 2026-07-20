"use strict";

var backendCore = require("./core.js");
var createModule = require("./module.js").createModule;

module.exports.mycommands = function (parent) {
    var obj = {};
    var pluginRoot = parent.path.join(parent.pluginPath, "mycommands");
    var config = backendCore.readJson(parent.fs, parent.path.join(pluginRoot, "config.json"), {
        name: "My Commands",
        shortName: "mycommands",
        version: "4.4.2",
        viewmode: 102,
        pageText: "My Commands",
        leftMenuIcon: "assets/LeftMenu.png",
        credentialsEnabled: false,
        showInMenu: false,
        showOnDevice: true
    });
    var pluginModule = createModule(config, parent, obj);
    var auditLogger = backendCore.createAuditLogger(parent, "mycommands", obj);
    var assets = {
        "core.js": { path: parent.path.join(pluginRoot, "public", "core.js"), type: "text/javascript; charset=utf-8" },
        "main.js": { path: parent.path.join(pluginRoot, "public", "main.js"), type: "text/javascript; charset=utf-8" },
        "plugin.css": { path: parent.path.join(pluginRoot, "public", "plugin.css"), type: "text/css; charset=utf-8" },
        "LeftMenu.png": { path: parent.path.join(pluginRoot, "assets", "LeftMenu.png"), type: "image/png" }
    };

    obj.parent = parent;
    obj.meshServer = parent.parent;
    obj.exports = ["onWebUIStartupEnd", "onDeviceRefreshEnd", "goPageStart", "goPageEnd", "commandResult"];

    if (typeof parent.registerPermissions === "function") {
        parent.registerPermissions("mycommands", {
            access: {
                title: "My Commands access",
                desc: "Allows the user to run configured commands and scripts on devices.",
                default: "denied"
            }
        });
    }

    function send(res, code, type, body) {
        res.statusCode = code;
        res.setHeader("Content-Type", type);
        res.setHeader("Cache-Control", "no-store");
        res.end(body);
    }

    function sendJson(res, code, value) {
        send(res, code, "application/json; charset=utf-8", JSON.stringify(value));
    }

    function handlePromise(res, work, map) {
        Promise.resolve(work).then(function (value) {
            sendJson(res, 200, map ? map(value) : { ok: true, result: value });
        }).catch(function (error) {
            sendJson(res, 400, { ok: false, error: String(error && error.message || error || "Request failed.") });
        });
    }

    obj.server_startup = function () {
        var error = pluginModule.ensureStorage();
        if (error) console.log("My Commands storage initialization failed:", error);
    };

    obj.onWebUIStartupEnd = function () {
        if (typeof window === "undefined" || typeof document === "undefined") return;
        window.MyCommands = window.MyCommands || {};
        if (window.MyCommands.bootstrapPromise) return;

        var assetUrl = function (asset) {
            var endpoint = new URL("pluginadmin.ashx", window.location.href);
            endpoint.searchParams.set("pin", "mycompany"); endpoint.searchParams.set("module", "commands");
            endpoint.searchParams.set("asset", asset);
            endpoint.searchParams.set("v", "4.4.2");
            return endpoint.href;
        };
        var place = function (item, anchor) {
            if (!item || !anchor || !anchor.parentNode) return;
            var host = anchor.parentNode;
            item.setAttribute("data-meshcentral-plugin-menu", "102");
            if (item.parentNode !== host) host.insertBefore(item, anchor.nextSibling);
            var entries = Array.prototype.slice.call(host.children).filter(function (child) { return child.hasAttribute("data-meshcentral-plugin-menu"); }).sort(function (left, right) { return Number(left.getAttribute("data-meshcentral-plugin-menu")) - Number(right.getAttribute("data-meshcentral-plugin-menu")); });
            var cursor = anchor;
            entries.forEach(function (entry) { host.insertBefore(entry, cursor.nextSibling); cursor = entry; });
        };
        var open = function (event) {
            if (window.MyCommands && typeof window.MyCommands.openStandalone === "function") return window.MyCommands.openStandalone(event);
            window.MyCommands.pendingOpen = true;
            if (event && event.preventDefault) event.preventDefault();
            return false;
        };
        var installMenuShell = function () {
            var mainAnchor = document.getElementById("MainMenuMyDevices");
            var leftAnchor = document.getElementById("LeftMenuMyDevices");
            if (mainAnchor && mainAnchor.parentNode) {
                var main = document.getElementById("MainMenuMyCommands") || mainAnchor.cloneNode(false);
                var modern = String(main.tagName || "").toLowerCase() === "a" || main.classList.contains("nav-link");
                main.id = "MainMenuMyCommands";
                main.textContent = "My Commands";
                main.title = "My Commands";
                main.tabIndex = 0;
                main.setAttribute("data-meshcentral-plugin-pin", "mycommands");
                main.setAttribute("data-meshcentral-plugin-click", "Main menu");
                main.classList.remove("fullselect", "semiselect", "active");
                main.onclick = main.onmouseup = null;
                if (modern) { main.href = "#"; main.onclick = open; } else main.onmouseup = open;
                place(main, mainAnchor);
            }
            if (leftAnchor && leftAnchor.parentNode) {
                var left = document.getElementById("LeftMenuMyCommands") || leftAnchor.cloneNode(true);
                var leftModern = String(left.tagName || "").toLowerCase() === "a" || left.classList.contains("nav-link");
                left.id = "LeftMenuMyCommands";
                left.title = "My Commands";
                left.setAttribute("aria-label", "My Commands");
                left.setAttribute("data-meshcentral-plugin-pin", "mycommands");
                left.setAttribute("data-meshcentral-plugin-click", "Left menu");
                left.tabIndex = 0;
                left.classList.remove("lbbuttonsel", "lbbuttonsel2", "active");
                left.onclick = left.onmouseup = null;
                if (leftModern) { left.href = "#"; left.onclick = open; } else left.onmouseup = open;
                var icon = left.querySelector(".lbtg");
                if (icon) {
                    icon.className = "lbtg";
                    icon.style.backgroundImage = "url(\"" + assetUrl("LeftMenu.png") + "\")";
                    icon.style.backgroundPosition = "center";
                    icon.style.backgroundRepeat = "no-repeat";
                    icon.style.backgroundSize = "contain";
                }
                place(left, leftAnchor);
            }
        };

        var bootstrap = null;
        try {
            var request = new XMLHttpRequest();
            request.open("GET", assetUrl("access"), false);
            request.send();
            if (request.status >= 200 && request.status < 300) bootstrap = JSON.parse(request.responseText);
        } catch (error) { }
        if (bootstrap) window.MyCommands.state = Object.assign(window.MyCommands.state || {}, { access: bootstrap.access, ui: bootstrap.ui });
        if (bootstrap && bootstrap.access && bootstrap.access.allowed && bootstrap.ui && bootstrap.ui.showInMenu) installMenuShell();

        var loadScript = function (id, source) {
            return new Promise(function (resolve, reject) {
                var existing = document.getElementById(id);
                if (existing) {
                    if (existing.getAttribute("data-loaded") === "1") resolve();
                    else { existing.addEventListener("load", resolve, { once: true }); existing.addEventListener("error", reject, { once: true }); }
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
        };
        var style = document.getElementById("mycommands-style");
        if (!style) { style = document.createElement("link"); style.id = "mycommands-style"; style.rel = "stylesheet"; style.href = assetUrl("plugin.css"); (document.head || document.documentElement).appendChild(style); }
        window.MyCommands.bootstrapPromise = loadScript("mycommands-core-script", assetUrl("core.js")).then(function () {
            return loadScript("mycommands-main-script", assetUrl("main.js"));
        }).then(function () { return window.MyCommands.initialize(); }).catch(function (error) {
            window.MyCommands.bootstrapPromise = null;
            if (window.console) console.error("My Commands bootstrap error", error);
        });
    };

    obj.onDeviceRefreshEnd = function (nodeId) {
        if (typeof window === "undefined" || !window.MyCommands) return;
        window.MyCommands.pendingNodeId = nodeId;
        if (typeof window.MyCommands.onDeviceRefreshEnd === "function") window.MyCommands.onDeviceRefreshEnd(nodeId);
    };

    obj.goPageStart = function (view) {
        if (typeof window !== "undefined" && window.MyCommands && typeof window.MyCommands.onNativePageStart === "function") window.MyCommands.onNativePageStart(view);
    };

    obj.goPageEnd = function (view) {
        if (typeof window !== "undefined" && window.MyCommands && typeof window.MyCommands.onNativePageEnd === "function") window.MyCommands.onNativePageEnd(view);
    };

    obj.commandResult = function (server, message) {
        if (typeof window !== "undefined" && window.MyCommands && typeof window.MyCommands.commandResult === "function") window.MyCommands.commandResult(message);
    };

    obj.hook_processAgentData = function (command, agent) {
        pluginModule.captureAgentData(command, agent);
    };

    obj.serveraction = function (command, myparent, grandparent) {
        pluginModule.handleServerAction(command, myparent, grandparent, function (error, result) {
            try {
                myparent.ws.send(JSON.stringify({ action: "plugin", plugin: "mycommands", method: "commandResult", responseid: command.responseid, ok: !error, error: error || null, result: result || null }));
            } catch (sendError) { }
        });
    };

    obj.handleAdminReq = function (req, res, user) {
        var asset = String(req && req.query && req.query.asset || "");
        if (asset === "access") { var bootstrap = pluginModule.getBootstrap(user); sendJson(res, 200, { ok: true, access: bootstrap.access, ui: bootstrap.ui, config: pluginModule.getClientConfig() }); return; }
        if (asset === "config") { sendJson(res, 200, pluginModule.getClientConfig()); return; }
        if (asset === "settings") { var settings = pluginModule.getSettings(user); if (!settings) { sendJson(res, 403, { ok: false, error: "Permission denied." }); return; } sendJson(res, 200, { ok: true, settings: settings }); return; }
        if (asset === "catalog") { var catalog = pluginModule.getCatalog(user); if (!catalog) { sendJson(res, 403, { ok: false, error: "Permission denied." }); return; } sendJson(res, 200, { ok: true, catalog: catalog }); return; }
        if (asset === "scripts") { var scripts = pluginModule.getScripts(user); if (!scripts) { sendJson(res, 403, { ok: false, error: "Permission denied." }); return; } sendJson(res, 200, { ok: true, tree: scripts, ts: Date.now() }); return; }
        if (asset === "output") { var output = pluginModule.getOutput(user, req && req.query && req.query.responseid); if (!output) { sendJson(res, 403, { ok: false, error: "Permission denied." }); return; } sendJson(res, 200, { ok: true, ready: output.ready, output: output.output }); return; }
        var file = assets[asset];
        if (!file) { send(res, 404, "text/plain; charset=utf-8", "Not found"); return; }
        parent.fs.readFile(file.path, function (error, data) { if (error) send(res, 404, "text/plain; charset=utf-8", "Not found"); else send(res, 200, file.type, data); });
    };

    obj.handleAdminPostReq = function (req, res, user) {
        var asset = String(req && req.query && req.query.asset || "");
        if (asset === "click") { auditLogger(user, req && req.body && req.body.target); sendJson(res, 200, { ok: true }); return; }
        if (asset === "settings") {
            pluginModule.saveSettings(user, req && req.body, function (error) { if (error) sendJson(res, 400, { ok: false, error: error }); else sendJson(res, 200, { ok: true, config: pluginModule.getClientConfig() }); });
            return;
        }
        if (asset === "submit") {
            var body = req && req.body || {}, values = {};
            try { values = JSON.parse(String(body.variableValues || "{}")); }
            catch (error) { sendJson(res, 400, { ok: false, error: "Invalid variable data." }); return; }
            handlePromise(res, pluginModule.submitApproval(user, {
                nodeid: body.nodeid,
                pluginaction: body.pluginaction,
                commandId: body.commandId,
                scriptPath: body.scriptPath,
                type: body.type,
                runAsUser: body.runAsUser,
                cmds: body.cmds,
                variableValues: values
            }, body.note), function (request) { return { ok: true, request: request }; });
            return;
        }
        if (asset === "direct") {
            var directBody = req && req.body || {}, directValues = {};
            try { directValues = JSON.parse(String(directBody.variableValues || "{}")); }
            catch (error) { sendJson(res, 400, { ok: false, error: "Invalid variable data." }); return; }
            handlePromise(res, pluginModule.executeDirect(user, { nodeid: directBody.nodeid, pluginaction: directBody.pluginaction, scriptPath: directBody.scriptPath, variableValues: directValues }), function (result) { return { ok: true, result: result }; });
            return;
        }
        sendJson(res, 400, { ok: false, error: "Unknown action." });
    };

    return obj;
};
