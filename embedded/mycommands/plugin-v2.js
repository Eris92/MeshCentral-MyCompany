"use strict";

var backendCore = require("./core.js");
var createModule = require("./module.js").createModule;
var extendModule = require("./extensions.js").extendModule;

module.exports.mycommands = function (parent) {
    var obj = {};
    var pluginRoot = parent.path.join(parent.pluginPath, "mycommands");
    var config = backendCore.readJson(parent.fs, parent.path.join(pluginRoot, "config.json"), {
        name: "My Commands", shortName: "mycommands", version: "4.5.2", viewmode: 102,
        pageText: "My Commands", leftMenuIcon: "assets/LeftMenu.png", credentialsEnabled: false,
        showInMenu: false, showOnDevice: true, maxMultiHostNodes: 200, multiHostConcurrency: 8
    });
    var pluginModule = extendModule(createModule(config, parent, obj), config, parent, obj);
    var auditLogger = backendCore.createAuditLogger(parent, "mycommands", obj);
    var assets = {
        "core.js": { path: parent.path.join(pluginRoot, "public", "core.js"), type: "text/javascript; charset=utf-8" },
        "main.js": { path: parent.path.join(pluginRoot, "public", "main.js"), type: "text/javascript; charset=utf-8" },
        "enhancements.js": { path: parent.path.join(pluginRoot, "public", "enhancements.js"), type: "text/javascript; charset=utf-8" },
        "fixes.js": { path: parent.path.join(pluginRoot, "public", "fixes.js"), type: "text/javascript; charset=utf-8" },
        "ui-fixes.js": { path: parent.path.join(pluginRoot, "public", "ui-fixes.js"), type: "text/javascript; charset=utf-8" },
        "plugin.css": { path: parent.path.join(pluginRoot, "public", "plugin.css"), type: "text/css; charset=utf-8" },
        "enhancements.css": { path: parent.path.join(pluginRoot, "public", "enhancements.css"), type: "text/css; charset=utf-8" },
        "ui-fixes.css": { path: parent.path.join(pluginRoot, "public", "ui-fixes.css"), type: "text/css; charset=utf-8" },
        "LeftMenu.png": { path: parent.path.join(pluginRoot, "assets", "LeftMenu.png"), type: "image/png" }
    };

    obj.parent = parent;
    obj.meshServer = parent.parent;
    obj.exports = ["onWebUIStartupEnd", "onDeviceRefreshEnd", "goPageStart", "goPageEnd", "commandResult"];

    if (typeof parent.registerPermissions === "function") {
        parent.registerPermissions("mycommands", {
            access: { title: "My Commands access", desc: "Allows the user to run configured commands and scripts on devices.", default: "denied" }
        });
    }

    function send(res, code, type, body) { res.statusCode = code; res.setHeader("Content-Type", type); res.setHeader("Cache-Control", "no-store"); res.end(body); }
    function sendJson(res, code, value) { send(res, code, "application/json; charset=utf-8", JSON.stringify(value)); }
    function handlePromise(res, work, map) { Promise.resolve(work).then(function (value) { sendJson(res, 200, map ? map(value) : { ok: true, result: value }); }).catch(function (error) { sendJson(res, 400, { ok: false, error: String(error && error.message || error || "Request failed.") }); }); }

    obj.server_startup = function () { var error = pluginModule.ensureStorage(); if (error) console.log("My Commands storage initialization failed:", error); };

    obj.onWebUIStartupEnd = function () {
        if (typeof window === "undefined" || typeof document === "undefined") return;
        window.MyCommands = window.MyCommands || {};
        if (window.MyCommands.bootstrapPromise) return;
        var assetUrl = function (asset) { var endpoint = new URL("pluginadmin.ashx", window.location.href); endpoint.searchParams.set("pin", "mycompany"); endpoint.searchParams.set("module", "commands"); endpoint.searchParams.set("asset", asset); endpoint.searchParams.set("v", "4.5.2"); return endpoint.href; };
        var load = function (id, source) { return new Promise(function (resolve, reject) { var existing = document.getElementById(id); if (existing) { if (existing.getAttribute("data-loaded") === "1") resolve(); else { existing.addEventListener("load", resolve, { once: true }); existing.addEventListener("error", reject, { once: true }); } return; } var script = document.createElement("script"); script.id = id; script.src = source; script.async = false; script.onload = function () { script.setAttribute("data-loaded", "1"); resolve(); }; script.onerror = reject; (document.head || document.documentElement).appendChild(script); }); };
        ["plugin.css", "enhancements.css", "ui-fixes.css"].forEach(function (file) { var id = "mycommands-452-" + file.replace(/\W/g, "-"); if (!document.getElementById(id)) { var style = document.createElement("link"); style.id = id; style.rel = "stylesheet"; style.href = assetUrl(file); (document.head || document.documentElement).appendChild(style); } });
        window.MyCommands.bootstrapPromise = load("mycommands-core-script-452", assetUrl("core.js"))
            .then(function () { return load("mycommands-main-script-452", assetUrl("main.js")); })
            .then(function () { return load("mycommands-enhancements-script-452", assetUrl("enhancements.js")); })
            .then(function () { return load("mycommands-fixes-script-452", assetUrl("fixes.js")); })
            .then(function () { return load("mycommands-ui-fixes-script-452", assetUrl("ui-fixes.js")); })
            .then(function () { return window.MyCommands.initialize(); })
            .catch(function (error) { window.MyCommands.bootstrapPromise = null; if (window.console) console.error("My Commands bootstrap error", error); });
    };

    obj.onDeviceRefreshEnd = function (nodeId) { if (typeof window === "undefined" || !window.MyCommands) return; window.MyCommands.pendingNodeId = nodeId; if (typeof window.MyCommands.onDeviceRefreshEnd === "function") window.MyCommands.onDeviceRefreshEnd(nodeId); };
    obj.goPageStart = function (view) { if (typeof window !== "undefined" && window.MyCommands && typeof window.MyCommands.onNativePageStart === "function") window.MyCommands.onNativePageStart(view); };
    obj.goPageEnd = function (view) { if (typeof window !== "undefined" && window.MyCommands && typeof window.MyCommands.onNativePageEnd === "function") window.MyCommands.onNativePageEnd(view); };
    obj.commandResult = function (server, message) { if (typeof window !== "undefined" && window.MyCommands && typeof window.MyCommands.commandResult === "function") window.MyCommands.commandResult(message); };
    obj.hook_processAgentData = function (command, agent) { pluginModule.captureAgentData(command, agent); };
    obj.serveraction = function (command, myparent, grandparent) { pluginModule.handleServerAction(command, myparent, grandparent, function (error, result) { try { myparent.ws.send(JSON.stringify({ action: "plugin", plugin: "mycommands", method: "commandResult", responseid: command.responseid, ok: !error, error: error || null, result: result || null })); } catch (sendError) { } }); };

    obj.handleAdminReq = function (req, res, user) {
        var asset = String(req && req.query && req.query.asset || "");
        if (asset === "access") { var bootstrap = pluginModule.getBootstrap(user); bootstrap.ui.showInMenu = false; sendJson(res, 200, { ok: true, access: bootstrap.access, ui: bootstrap.ui, config: pluginModule.getClientConfig() }); return; }
        if (asset === "config") { var clientConfig = pluginModule.getClientConfig(); clientConfig.showInMenu = false; sendJson(res, 200, clientConfig); return; }
        if (asset === "settings") { var settings = pluginModule.getSettings(user); if (!settings) { sendJson(res, 403, { ok: false, error: "Permission denied." }); return; } settings.showInMenu = false; sendJson(res, 200, { ok: true, settings: settings }); return; }
        if (asset === "catalog") { var catalog = pluginModule.getCatalog(user); if (!catalog) { sendJson(res, 403, { ok: false, error: "Permission denied." }); return; } sendJson(res, 200, { ok: true, catalog: catalog }); return; }
        if (asset === "scripts") { var scripts = pluginModule.getScripts(user); if (!scripts) { sendJson(res, 403, { ok: false, error: "Permission denied." }); return; } sendJson(res, 200, { ok: true, tree: scripts, ts: Date.now() }); return; }
        if (asset === "output") { var output = pluginModule.getOutput(user, req && req.query && req.query.responseid); if (!output) { sendJson(res, 403, { ok: false, error: "Permission denied." }); return; } sendJson(res, 200, { ok: true, ready: output.ready, output: output.output }); return; }
        if (asset === "results") { handlePromise(res, pluginModule.getExtendedResults(user), function (value) { return { ok: true, rows: value.rows || [] }; }); return; }
        if (asset === "definition") { try { sendJson(res, 200, { ok: true, definition: pluginModule.getScriptDefinition(user, req && req.query && req.query.scriptPath) }); } catch (error) { sendJson(res, 403, { ok: false, error: error.message }); } return; }
        if (asset === "script-metadata") { try { sendJson(res, 200, { ok: true, metadata: pluginModule.getScriptMetadata(user, req && req.query && req.query.scriptPath) }); } catch (error) { sendJson(res, 400, { ok: false, error: error.message }); } return; }
        var file = assets[asset]; if (!file) { send(res, 404, "text/plain; charset=utf-8", "Not found"); return; }
        parent.fs.readFile(file.path, function (error, data) { if (error) send(res, 404, "text/plain; charset=utf-8", "Not found"); else send(res, 200, file.type, data); });
    };

    obj.handleAdminPostReq = function (req, res, user) {
        var asset = String(req && req.query && req.query.asset || ""), body = req && req.body || {};
        if (asset === "click") { auditLogger(user, body.target); sendJson(res, 200, { ok: true }); return; }
        if (asset === "settings") { body.showInMenu = false; pluginModule.saveSettings(user, body, function (error) { if (error) sendJson(res, 400, { ok: false, error: error }); else { var clientConfig = pluginModule.getClientConfig(); clientConfig.showInMenu = false; sendJson(res, 200, { ok: true, config: clientConfig }); } }); return; }
        if (asset === "submit") { var values = {}; try { values = JSON.parse(String(body.variableValues || "{}")); } catch (error) { sendJson(res, 400, { ok: false, error: "Invalid variable data." }); return; } handlePromise(res, pluginModule.submitApproval(user, { nodeid: body.nodeid, pluginaction: body.pluginaction, commandId: body.commandId, scriptPath: body.scriptPath, type: body.type, runAsUser: body.runAsUser, cmds: body.cmds, variableValues: values }, body.note), function (request) { return { ok: true, request: request }; }); return; }
        if (asset === "direct") { var directValues = {}; try { directValues = JSON.parse(String(body.variableValues || "{}")); } catch (error) { sendJson(res, 400, { ok: false, error: "Invalid variable data." }); return; } handlePromise(res, pluginModule.executeDirect(user, { nodeid: body.nodeid, pluginaction: body.pluginaction, scriptPath: body.scriptPath, variableValues: directValues }), function (result) { return { ok: true, result: result }; }); return; }
        if (asset === "execute-many") { var request, nodeids; try { request = JSON.parse(String(body.request || "{}")); nodeids = JSON.parse(String(body.nodeids || "[]")); } catch (error) { sendJson(res, 400, { ok: false, error: "Invalid execution data." }); return; } request.nodeids = nodeids; handlePromise(res, pluginModule.executeMany(user, request), function (result) { return { ok: true, result: result }; }); return; }
        if (asset === "definition") { var definition; try { definition = JSON.parse(String(body.definition || "{}")); } catch (error) { sendJson(res, 400, { ok: false, error: "Invalid definition data." }); return; } try { sendJson(res, 200, { ok: true, definition: pluginModule.saveScriptDefinition(user, body.scriptPath, definition) }); } catch (error) { sendJson(res, 403, { ok: false, error: error.message }); } return; }
        sendJson(res, 400, { ok: false, error: "Unknown action." });
    };

    return obj;
};
