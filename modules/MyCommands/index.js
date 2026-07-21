"use strict";

var shared = require("../../core/shared.js");
var libraryFactory = require("../../core/script-library.js");
var adminFactory = require("../../core/script-admin-service.js");

module.exports.createModule = function (context) {
    var root = context.path.join(context.pluginRoot, "seed", "MyCommands");
    var resultsPath = context.path.join(context.dataRoot, "mycommands", "results.json");
    var library = libraryFactory.createScriptLibrary({ fs: context.fs, path: context.path, root: root, readOnly: true, allowWrite: true });
    var admin = adminFactory.createScriptAdminService({ context: context, library: library, namespace: "script-secrets.mycommands" });
    var unregister = null;

    function allowed(user) {
        if (shared.isSiteAdmin(user)) return true;
        var groups = (context.settings.read().modules.mycommands || {}).accessGroupIds;
        groups = Array.isArray(groups) ? groups : [];
        return !groups.length || shared.isUserInAnyGroup(user, groups);
    }
    function requireAdmin(user) { if (!shared.isSiteAdmin(user)) throw new Error("Permission denied."); }
    function executionRows() { var v = shared.readJson(context.fs, resultsPath, { rows: [] }); return Array.isArray(v.rows) ? v.rows : []; }
    function writeRows(rows) { shared.writeJsonAtomic(context.fs, context.path, resultsPath, { schemaVersion: 1, rows: rows }); }
    function saveExecution(row) { var rows = executionRows(); rows.unshift(row); if (rows.length > 2000) rows.length = 2000; writeRows(rows); }

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
            var id = "mycompany-" + shared.randomId(10);
            return context.device.sendRunCommands(node, command, id, null).then(function (state) {
                var row = { id: id, nodeId: node.nodeId, nodeName: node.node && node.node.name || payload.nodeName || payload.nodeId, command: command.label, status: state.state, requester: request.requester, createdAt: Date.now(), output: "" };
                saveExecution(row); context.device.auditCommand(node, user, command); return row;
            });
        });
    }

    function approvalResults(user, q) {
        q = q || {};
        return context.approval.list(user, { type: "mycommands", status: q.status || "", q: q.q || "", page: Number(q.page) || 1, perPage: Math.min(200, Number(q.perPage) || 100) }).then(function (value) {
            var byId = Object.create(null); executionRows().forEach(function (row) { byId[String(row.id || "")] = row; });
            value.rows = (value.rows || []).map(function (request) { var id = request.result && request.result.id; if (id && byId[String(id)]) request.result = shared.copy(byId[String(id)]); return request; });
            value.ok = true; return value;
        });
    }

    function nodeIds(value) {
        var list = Array.isArray(value) ? value : String(value || "").split(/[\r\n,;]+/), seen = Object.create(null);
        return list.map(function (id) { return String(id || "").trim(); }).filter(function (id) { if (!id || seen[id]) return false; seen[id] = true; return true; });
    }

    function multiExecute(user, value) {
        value = value || {};
        var settings = context.settings.read().modules.mycommands || {};
        var maxMultiHostNodes = Math.max(1, Math.min(1000, Number(settings.maxMultiHostNodes) || 200));
        var multiHostConcurrency = Math.max(1, Math.min(64, Number(settings.multiHostConcurrency) || 8));
        var ids = nodeIds(value.nodeIds); if (!ids.length && value.nodeId) ids = [String(value.nodeId)];
        if (!ids.length) throw new Error("Select at least one device.");
        if (ids.length > maxMultiHostNodes) throw new Error("A maximum of " + maxMultiHostNodes + " devices can be selected.");
        var script = library.getScript(value.scriptPath, true); if (!script) throw new Error("Script not found.");
        var cursor = 0, rows = [];
        function worker() {
            if (cursor >= ids.length) return Promise.resolve();
            var id = ids[cursor++];
            return context.approval.submit("mycommands", user, { nodeId: id, scriptPath: script.path, label: script.label, description: script.description, approvalLevels: script.approvalLevels || [], multiHost: true }, value.note).then(function (request) { rows.push({ nodeId: id, ok: true, request: request }); }).catch(function (error) { rows.push({ nodeId: id, ok: false, error: String(error && error.message || error) }); }).then(worker);
        }
        var workers = []; for (var i = 0; i < Math.min(multiHostConcurrency, ids.length); i++) workers.push(worker());
        return Promise.all(workers).then(function () {
            var failed = rows.filter(function (row) { return !row.ok; }).length;
            var pending = rows.filter(function (row) { return row.ok && row.request && row.request.status === "pending"; }).length;
            return { ok: failed === 0, total: ids.length, submitted: rows.length - failed, pending: pending, failed: failed, rows: rows };
        });
    }

    var provider = {
        type: "mycommands", moduleKey: "mycommands", title: "My Commands", tabTitle: "Commands", description: "Direct and multi-device command execution.", columns: ["createdAt", "title", "requester", "status"],
        normalizePayload: function (payload) { return shared.copy(payload || {}); },
        getTitle: function (payload) { return payload.label || payload.scriptPath || "Command"; },
        getSummary: function (payload) { return "Device: " + (payload.nodeName || payload.nodeId || "unknown"); },
        getApprovalLevels: function (payload) { return payload.approvalLevels || []; },
        canSubmit: allowed, execute: execute
    };

    return {
        key: "mycommands",
        clientConfig: function () {
            var value = context.settings.read().modules.mycommands || {};
            return { key: "mycommands", name: "My Commands", menuTitle: "My Commands", script: "mycommands.js", style: "myscripts.css", showInMenu: false, showOnDevice: value.showOnDevice !== false, scriptsRoot: root, maxMultiHostNodes: Number(value.maxMultiHostNodes) || 200, multiHostConcurrency: Number(value.multiHostConcurrency) || 8, toolbar: { refresh: true, clear: false, favorites: true, search: true, manage: true, multiHost: true, settings: false } };
        },
        getAccess: function (user) { return { allowed: allowed(user), siteAdmin: shared.isSiteAdmin(user) }; },
        initialize: function () { library.ensure(); if (!unregister) unregister = context.approval.registerProvider(provider); return Promise.resolve(); },
        captureAgentData: function (command) {
            var id = command && (command.responseid || command.responseId); if (!id) return;
            var rows = executionRows(), row = rows.find(function (item) { return item.id === id; }); if (!row) return;
            row.status = command.status || "completed"; row.output = shared.cleanText(command.value || command.result || command.stdout || "", 1000000); row.updatedAt = Date.now(); writeRows(rows);
        },
        apiGet: function (asset, req, user) {
            if (!allowed(user)) throw new Error("Permission denied."); var q = req && req.query || {};
            if (asset === "scripts") return { ok: true, tree: library.getTree(), scriptsRoot: shared.isSiteAdmin(user) ? root : "" };
            if (asset === "script") { var script = library.getScript(q.path, true); if (!script) throw new Error("Script not found."); return { ok: true, script: script }; }
            if (asset === "source") { requireAdmin(user); var source = library.getSource(q.path); if (!source) throw new Error("Script not found."); return { ok: true, source: source }; }
            if (asset === "definition") return { ok: true, definition: admin.getDefinition(user, q.path) };
            if (asset === "script-secrets") return { ok: true, secrets: admin.getSecretState(user, q.path) };
            if (asset === "results") return approvalResults(user, q);
            if (asset === "settings") return { ok: true, settings: context.settings.read().modules.mycommands || {}, scriptsRoot: root };
            throw new Error("Unknown My Commands action.");
        },
        apiPost: function (asset, req, user) {
            if (!allowed(user)) throw new Error("Permission denied."); var value = req && req.body || {};
            if (asset === "execute") return context.approval.submit("mycommands", user, value, value.note).then(function (request) { return { ok: true, request: request }; });
            if (asset === "multi-execute") return multiExecute(user, value);
            if (asset === "refresh") { library.invalidate(); return { ok: true, tree: library.getTree() }; }
            if (asset === "source") { requireAdmin(user); return { ok: true, script: library.saveSource(value.path, value.text), tree: library.getTree() }; }
            if (asset === "definition") { var saved = admin.saveDefinition(user, value.path, value.definition); saved.ok = true; saved.tree = library.getTree(); return saved; }
            if (asset === "script-secrets") return { ok: true, secrets: admin.saveSecrets(user, value.path, value.values, value.clearNames) };
            if (asset === "settings") {
                requireAdmin(user);
                return context.settings.update(function (current) {
                    var config = current.modules.mycommands; config.showInMenu = false; config.showOnDevice = value.showOnDevice !== false;
                    config.accessGroupIds = Array.isArray(value.accessGroupIds) ? value.accessGroupIds.map(String) : [];
                    config.maxMultiHostNodes = Math.max(1, Math.min(1000, Number(value.maxMultiHostNodes) || 200));
                    config.multiHostConcurrency = Math.max(1, Math.min(64, Number(value.multiHostConcurrency) || 8)); return current;
                }).then(function () { return { ok: true }; });
            }
            throw new Error("Unknown My Commands action.");
        }
    };
};
