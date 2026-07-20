"use strict";

var backendCore = require("./core.js");
var createModule = require("./module.js").createModule;

module.exports.myscripts = function (parent) {
    var obj = {};
    var root = parent.path.join(parent.pluginPath, "myscripts");
    var config = backendCore.readJson(parent.fs, parent.path.join(root, "config.json"), { name: "My Scripts", shortName: "myscripts", version: "1.9.7", viewmode: 101, pageText: "My Scripts", leftMenuIcon: "assets/LeftMenu.svg", credentialsEnabled: true, runTimeoutSeconds: 600 });
    var module = createModule(config, parent, obj);
    var auditClick = backendCore.createAuditLogger(parent, "myscripts", obj);
    var assets = {
        "core.js": { path: parent.path.join(root, "public", "core.js"), type: "text/javascript; charset=utf-8" },
        "main.js": { path: parent.path.join(root, "public", "main.js"), type: "text/javascript; charset=utf-8" },
        "plugin.css": { path: parent.path.join(root, "public", "plugin.css"), type: "text/css; charset=utf-8" },
        "LeftMenu.svg": { path: parent.path.join(root, "assets", "LeftMenu.svg"), type: "image/svg+xml; charset=utf-8" }
    };
    obj.parent = parent; obj.meshServer = parent.parent; obj.exports = ["onWebUIStartupEnd", "goPageStart", "goPageEnd"];
    obj.server_startup = function () { var error = module.ensureStorage(); if (error) console.log("My Scripts storage initialization failed:", error); };
    // Dostęp wynika z uprawnień do katalogów skryptów; nie rejestrujemy
    // dodatkowej permission, aby Site Admin zawsze miał dostęp po restarcie.

    function send(res, status, type, body) { res.statusCode = status; res.setHeader("Content-Type", type); res.setHeader("Cache-Control", "no-store"); res.end(body); }
    function sendJson(res, status, value) { send(res, status, "application/json; charset=utf-8", JSON.stringify(value)); }
    function promise(res, work, map) { Promise.resolve(work).then(function (value) { sendJson(res, 200, map ? map(value) : { ok: true, result: value }); }).catch(function (error) { sendJson(res, 400, { ok: false, error: String(error && error.message || error || "Request failed.") }); }); }

    obj.onWebUIStartupEnd = function () {
        if (typeof window === "undefined" || typeof document === "undefined") return;
        window.MyScripts = window.MyScripts || {};
        if (window.MyScripts.bootstrapPromise) return;
        var url = function (asset) { var endpoint = new URL("pluginadmin.ashx", window.location.href); endpoint.searchParams.set("pin", "mycompany"); endpoint.searchParams.set("module", "scripts"); endpoint.searchParams.set("asset", asset); endpoint.searchParams.set("v", "1.9.6"); return endpoint.href; };
        var load = function (id, source) { return new Promise(function (resolve, reject) { var existing = document.getElementById(id); if (existing) { if (existing.getAttribute("data-loaded") === "1") resolve(); else { existing.addEventListener("load", resolve, { once: true }); existing.addEventListener("error", reject, { once: true }); } return; } var script = document.createElement("script"); script.id = id; script.src = source; script.async = false; script.onload = function () { script.setAttribute("data-loaded", "1"); resolve(); }; script.onerror = reject; (document.head || document.documentElement).appendChild(script); }); };
        var style = document.getElementById("myscripts-style"); if (!style) { style = document.createElement("link"); style.id = "myscripts-style"; style.rel = "stylesheet"; style.href = url("plugin.css"); (document.head || document.documentElement).appendChild(style); }
        window.MyScripts.bootstrapPromise = load("myscripts-core-script", url("core.js")).then(function () { return load("myscripts-main-script", url("main.js")); }).then(function () { return window.MyScripts.initialize(); }).catch(function (error) { window.MyScripts.bootstrapPromise = null; if (window.console) window.console.error("My Scripts bootstrap error", error); });
    };
    obj.goPageStart = function (view) { if (typeof window !== "undefined" && window.MyScripts && typeof window.MyScripts.onNativePageStart === "function") window.MyScripts.onNativePageStart(view); };
    obj.goPageEnd = function (view) { if (typeof window !== "undefined" && window.MyScripts && typeof window.MyScripts.onNativePageEnd === "function") window.MyScripts.onNativePageEnd(view); };

    obj.handleAdminReq = function (req, res, user) {
        var asset = String(req && req.query && req.query.asset || "");
        if (asset === "access") { var bootstrap = module.getBootstrap(user); bootstrap.config = module.getClientConfig(); sendJson(res, 200, { ok: true, bootstrap: bootstrap }); return; }
        if (asset === "config") { sendJson(res, 200, module.getClientConfig()); return; }
        if (asset === "scripts") { var tree = module.getTree(user); if (!tree) { sendJson(res, 403, { ok: false, error: "Permission denied." }); return; } sendJson(res, 200, { ok: true, tree: tree }); return; }
        if (asset === "user-choices") { try { var users = module.getUserChoices(user, req && req.query && req.query.q, 100); sendJson(res, 200, { ok: true, choices: users.choices || [], generatedAt: users.generatedAt || "", total: users.total || 0 }); } catch (error) { sendJson(res, 400, { ok: false, error: String(error && error.message || error) }); } return; }
        if (asset === "mesh-users") { promise(res, module.getMeshUsers(user), function (result) { return { ok: true, choices: result.choices || [], current: result.current || "" }; }); return; }
        if (asset === "jira-assets") { promise(res, module.getJiraAssets(user, req && req.query && req.query.user), function (result) { return { ok: true, assets: result.assets || [], user: result.user || "" }; }); return; }
        if (asset === "results") { promise(res, module.getResults(user), function (result) { return { ok: true, rows: result.rows || [], total: result.total || 0, page: result.page || 1, pageCount: result.pageCount || 1, perPage: result.perPage || 100 }; }); return; }
        if (asset === "settings") { var settings = module.getSettings(user); if (!settings) { sendJson(res, 403, { ok: false, error: "Permission denied." }); return; } sendJson(res, 200, { ok: true, settings: settings }); return; }
        if (asset === "folder-icon") { var icon = module.getIcon(String(req && req.query && req.query.path || "")); if (!icon) { send(res, 404, "text/plain; charset=utf-8", "Not found"); return; } parent.fs.readFile(icon.path, function (error, data) { if (error) send(res, 404, "text/plain; charset=utf-8", "Not found"); else send(res, 200, icon.type, data); }); return; }
        var file = assets[asset]; if (!file) { send(res, 404, "text/plain; charset=utf-8", "Not found"); return; }
        parent.fs.readFile(file.path, function (error, data) { if (error) send(res, 404, "text/plain; charset=utf-8", "Not found"); else send(res, 200, file.type, data); });
    };
    obj.handleAdminPostReq = function (req, res, user) {
        var asset = String(req && req.query && req.query.asset || ""), body = req && req.body || {};
        if (asset === "click") { auditClick(user, body.target); sendJson(res, 200, { ok: true }); return; }
        if (asset === "submit") { var values = {}; try { values = JSON.parse(String(body.variableValues || "{}")); } catch (error) { sendJson(res, 400, { ok: false, error: "Invalid variable data." }); return; } promise(res, module.submit(user, { scriptPath: body.scriptPath, variableValues: values }, body.note), function (request) { return { ok: true, request: request }; }); return; }
        if (asset === "direct") { var directValues = {}; try { directValues = JSON.parse(String(body.variableValues || "{}")); } catch (error) { sendJson(res, 400, { ok: false, error: "Invalid variable data." }); return; } promise(res, module.executeDirect(user, { scriptPath: body.scriptPath, variableValues: directValues }), function (result) { return { ok: true, result: result }; }); return; }
        if (asset === "settings") { var credentials = {}, folderPermissions = {}; try { credentials = JSON.parse(String(body.credentialsJson || "{}")); folderPermissions = JSON.parse(String(body.folderPermissionsJson || "{}")); } catch (error) { sendJson(res, 400, { ok: false, error: "Invalid settings data." }); return; } promise(res, module.saveSettings(user, credentials, folderPermissions), function () { return { ok: true }; }); return; }
        if (asset === "credentials") { promise(res, module.saveSettings(user, JSON.parse(String(body.credentialsJson || "{}")), {}), function () { return { ok: true }; }); return; }
        if (asset === "script-secrets") { var values = {}; try { values = JSON.parse(String(body.valuesJson || "{}")); } catch (error) { sendJson(res, 400, { ok: false, error: "Invalid credential data." }); return; } promise(res, module.saveScriptSecrets(user, body.scriptPath, values), function () { return { ok: true }; }); return; }
        sendJson(res, 400, { ok: false, error: "Unknown action." });
    };
    return obj;
};

