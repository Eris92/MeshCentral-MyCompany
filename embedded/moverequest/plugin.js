"use strict";

var backendCore = require("./core.js");
var createModule = require("./module.js").createModule;

module.exports.moverequest = function (parent) {
    var obj = {};
    var root = parent.path.join(parent.pluginPath, "moverequest");
    var config = backendCore.readJson(parent.fs, parent.path.join(root, "config.json"), { name: "Move Request", shortName: "moverequest", version: "2.1.1" });
    var module = createModule(config, parent, obj);
    var auditClick = backendCore.createAuditLogger(parent, "moverequest", obj);
    var assets = {
        "core.js": { path: parent.path.join(root, "public", "core.js"), type: "text/javascript; charset=utf-8" },
        "main.js": { path: parent.path.join(root, "public", "main.js"), type: "text/javascript; charset=utf-8" }
    };
    obj.parent = parent;
    obj.meshServer = parent.parent;
    obj.exports = ["onWebUIStartupEnd", "onDeviceRefreshEnd"];

    function send(res, status, type, body) {
        res.statusCode = status;
        res.setHeader("Content-Type", type);
        res.setHeader("Cache-Control", "no-store");
        res.end(body);
    }
    function sendJson(res, status, value) { send(res, status, "application/json; charset=utf-8", JSON.stringify(value)); }
    function handlePromise(res, work, map) {
        Promise.resolve(work).then(function (value) { sendJson(res, 200, map ? map(value) : { ok: true, result: value }); }).catch(function (error) { sendJson(res, 400, { ok: false, error: String(error && error.message || error || "Request failed.") }); });
    }

    obj.onWebUIStartupEnd = function () {
        if (typeof window === "undefined" || typeof document === "undefined") return;
        window.MoveRequest = window.MoveRequest || {};
        if (window.MoveRequest.bootstrapPromise) return;
        var url = function (asset) {
            var endpoint = new URL("pluginadmin.ashx", window.location.href);
            endpoint.searchParams.set("pin", "mycompany"); endpoint.searchParams.set("module", "move");
            endpoint.searchParams.set("asset", asset);
            endpoint.searchParams.set("v", "2.1.1");
            return endpoint.href;
        };
        var load = function (id, source) {
            return new Promise(function (resolve, reject) {
                var existing = document.getElementById(id);
                if (existing) {
                    if (existing.getAttribute("data-loaded") === "1") resolve();
                    else { existing.addEventListener("load", resolve, { once: true }); existing.addEventListener("error", reject, { once: true }); }
                    return;
                }
                var script = document.createElement("script");
                script.id = id; script.src = source; script.async = false;
                script.onload = function () { script.setAttribute("data-loaded", "1"); resolve(); };
                script.onerror = reject;
                (document.head || document.documentElement).appendChild(script);
            });
        };
        window.MoveRequest.bootstrapPromise = load("moverequest-core-script", url("core.js"))
            .then(function () { return load("moverequest-main-script", url("main.js")); })
            .then(function () { return window.MoveRequest.initialize(); })
            .catch(function (error) { window.MoveRequest.bootstrapPromise = null; if (window.console) window.console.error("Move Request bootstrap error", error); });
    };
    obj.onDeviceRefreshEnd = function (nodeId) {
        if (typeof window === "undefined" || !window.MoveRequest) return;
        if (typeof window.MoveRequest.setHostNodeId === "function") window.MoveRequest.setHostNodeId(nodeId);
        if (typeof window.MoveRequest.scheduleHostButton === "function") window.MoveRequest.scheduleHostButton();
    };
    obj.handleAdminReq = function (req, res, user) {
        var asset = String(req && req.query && req.query.asset || "");
        if (asset === "config") { sendJson(res, 200, module.getClientConfig()); return; }
        if (asset === "groups") {
            handlePromise(res, module.getGroups(user, req && req.query && req.query.nodeId), function (value) {
                return { ok: true, groups: value.groups, currentMeshId: value.currentMeshId, currentMeshName: value.currentMeshName };
            });
            return;
        }
        var file = assets[asset];
        if (!file) { send(res, 404, "text/plain; charset=utf-8", "Not found"); return; }
        parent.fs.readFile(file.path, function (error, data) { if (error) send(res, 404, "text/plain; charset=utf-8", "Not found"); else send(res, 200, file.type, data); });
    };
    obj.handleAdminPostReq = function (req, res, user) {
        var asset = String(req && req.query && req.query.asset || ""), body = req && req.body || {};
        if (asset === "click") { auditClick(user, body.target); sendJson(res, 200, { ok: true }); return; }
        if (asset === "submit") {
            handlePromise(res, module.submit(user, body.nodeId, body.targetMeshId, body.note), function (request) { return { ok: true, request: request }; });
            return;
        }
        sendJson(res, 400, { ok: false, error: "Unknown action." });
    };
    return obj;
};
