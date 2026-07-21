"use strict";

var shared = require("../../core/shared.js");
var libraryFactory = require("../../core/script-library.js");

module.exports.createModule = function (context) {
    var root = context.path.join(context.dataRoot, "scripts", "MyCommands");
    var resultsPath = context.path.join(context.dataRoot, "mycommands", "results.json");
    var library = libraryFactory.createScriptLibrary({ fs: context.fs, path: context.path, root: root });
    var unregister = null;

    function allowed(user) {
        if (shared.isSiteAdmin(user)) return true;
        var config = context.settings.read().modules.mycommands || {};
        var groups = Array.isArray(config.accessGroupIds) ? config.accessGroupIds : [];
        return !groups.length || shared.isUserInAnyGroup(user, groups);
    }

    function results() {
        var value = shared.readJson(context.fs, resultsPath, { rows: [] });
        return Array.isArray(value.rows) ? value.rows : [];
    }

    function saveResult(row) {
        var rows = results();
        rows.unshift(row);
        if (rows.length > 2000) rows.length = 2000;
        shared.writeJsonAtomic(context.fs, context.path, resultsPath, { schemaVersion: 1, rows: rows });
    }

    function execute(payload, request) {
        var user = shared.findUser(context.parent, request.requester && request.requester.id) || { _id: request.requester && request.requester.id, name: request.requester && request.requester.name };
        var script = payload.scriptPath ? library.getScript(payload.scriptPath, true) : null;
        var command = {
            label: script && script.label || payload.label || "Custom command",
            cmd: script ? script.body : String(payload.command || ""),
            type: script && script.shell === "cmd" ? 1 : Number(payload.type) || 2,
            runAsUser: script ? script.runAsUser : Number(payload.runAsUser) || 0
        };
        if (!command.cmd) return Promise.reject(new Error("Command is empty."));
        return context.device.resolveNode(user, payload.nodeId, { requireCommandRights: true }).then(function (node) {
            var responseId = "mycompany-" + shared.randomId(10);
            return context.device.sendRunCommands(node, command, responseId, null).then(function (state) {
                var row = {
                    id: responseId,
                    nodeId: node.nodeId,
                    nodeName: node.node && node.node.name || payload.nodeId,
                    command: command.label,
                    status: state.state,
                    requester: request.requester,
                    createdAt: Date.now(),
                    output: ""
                };
                saveResult(row);
                context.device.auditCommand(node, user, command);
                return row;
            });
        });
    }

    var provider = {
        type: "mycommands",
        moduleKey: "mycommands",
        title: "My Commands",
        tabTitle: "Commands",
        description: "Direct and multi-device command execution.",
        columns: ["createdAt", "title", "requester", "status"],
        normalizePayload: function (payload) { return shared.copy(payload || {}); },
        getTitle: function (payload) { return payload.label || payload.scriptPath || "Command"; },
        getSummary: function (payload) { return "Device: " + (payload.nodeName || payload.nodeId || "unknown"); },
        getApprovalLevels: function (payload) { return payload.approvalLevels || []; },
        canSubmit: allowed,
        execute: execute
    };

    return {
        key: "mycommands",
        clientConfig: function () {
            var value = context.settings.read().modules.mycommands || {};
            return {
                key: "mycommands",
                name: "My Commands",
                menuTitle: "My Commands",
                script: "mycommands.js",
                style: "myscripts.css",
                showInMenu: value.showInMenu !== false,
                showOnDevice: value.showOnDevice !== false,
                toolbar: {
                    refresh: true,
                    clear: true,
                    favorites: true,
                    search: true,
                    manage: true,
                    settings: true,
                    rightActions: ["custom", "multiHost", "refresh"]
                }
            };
        },
        getAccess: function (user) { return { allowed: allowed(user), siteAdmin: shared.isSiteAdmin(user) }; },
        initialize: function () {
            library.ensure();
            if (!unregister) unregister = context.approval.registerProvider(provider);
            return Promise.resolve();
        },
        captureAgentData: function (command) {
            var id = command && (command.responseid || command.responseId);
            if (!id) return;
            var rows = results();
            var row = rows.find(function (item) { return item.id === id; });
            if (!row) return;
            row.status = command.status || "completed";
            row.output = shared.cleanText(command.value || command.result || command.stdout || "", 1000000);
            row.updatedAt = Date.now();
            shared.writeJsonAtomic(context.fs, context.path, resultsPath, { schemaVersion: 1, rows: rows });
        },
        apiGet: function (asset, req, user) {
            if (!allowed(user)) throw new Error("Permission denied.");
            var q = req && req.query || {};
            if (asset === "scripts") return { ok: true, tree: library.getTree(), scriptsRoot: shared.isSiteAdmin(user) ? root : "" };
            if (asset === "script") {
                var script = library.getScript(q.path, true);
                if (!script) throw new Error("Script not found.");
                return { ok: true, script: script };
            }
            if (asset === "results") {
                var rows = results();
                var search = String(q.q || "").toLowerCase();
                if (search) rows = rows.filter(function (row) { return JSON.stringify(row).toLowerCase().indexOf(search) >= 0; });
                return { ok: true, rows: rows.slice(0, Math.min(500, Number(q.limit) || 100)) };
            }
            if (asset === "settings") return { ok: true, settings: context.settings.read().modules.mycommands || {}, scriptsRoot: root };
            throw new Error("Unknown My Commands action.");
        },
        apiPost: function (asset, req, user) {
            if (!allowed(user)) throw new Error("Permission denied.");
            var value = req && req.body || {};
            if (asset === "execute") return context.approval.submit("mycommands", user, value, value.note)
                .then(function (request) { return { ok: true, request: request }; });
            if (asset === "refresh") { library.invalidate(); return { ok: true, tree: library.getTree() }; }
            if (asset === "settings") {
                if (!shared.isSiteAdmin(user)) throw new Error("Permission denied.");
                return context.settings.update(function (current) {
                    var config = current.modules.mycommands;
                    config.showInMenu = value.showInMenu !== false;
                    config.showOnDevice = value.showOnDevice !== false;
                    config.accessGroupIds = Array.isArray(value.accessGroupIds) ? value.accessGroupIds.map(String) : [];
                    return current;
                }).then(function () { return { ok: true }; });
            }
            throw new Error("Unknown My Commands action.");
        }
    };
};
