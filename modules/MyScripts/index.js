"use strict";

var shared = require("../../core/shared.js");
var libraryFactory = require("../../core/script-library.js");
var adminFactory = require("../../core/script-admin-service.js");

module.exports.createModule = function (context) {
    var root = context.path.join(context.pluginRoot, "seed", "MyScripts");
    var library = libraryFactory.createScriptLibrary({
        fs: context.fs,
        path: context.path,
        root: root,
        readOnly: true,
        allowWrite: true
    });
    var admin = adminFactory.createScriptAdminService({
        context: context,
        library: library,
        namespace: "script-secrets.myscripts"
    });
    var unregister = null;

    function allowed(user) {
        if (shared.isSiteAdmin(user)) return true;
        var config = context.settings.read().modules.myscripts || {};
        var groups = Array.isArray(config.accessGroupIds) ? config.accessGroupIds : [];
        return !groups.length || shared.isUserInAnyGroup(user, groups);
    }

    function requireAdmin(user) {
        if (!shared.isSiteAdmin(user)) throw new Error("Permission denied.");
    }

    function normalizeApprovalLevels(value) {
        return Array.isArray(value)
            ? value.map(Number).filter(function (level, index, all) {
                return level >= 1 && level <= 3 && all.indexOf(level) === index;
            }).sort()
            : [];
    }

    function approvalLevels(payload) {
        return normalizeApprovalLevels(payload && payload.approvalLevels);
    }

    function allowNoApproval() {
        var current = context.settings.read();
        var provider = current.modules && current.modules.approvalcenter &&
            current.modules.approvalcenter.providers &&
            current.modules.approvalcenter.providers.myscripts || {};
        return provider.allowNoApproval === true;
    }

    function directResult(script, user) {
        var now = Date.now();
        return {
            id: shared.randomId(12),
            type: "myscripts",
            providerTitle: "My Scripts",
            title: script.label || script.name || script.path,
            summary: script.description || script.path || "My Scripts execution",
            status: "completed",
            requester: {
                id: user && user._id || "",
                name: shared.userName(user)
            },
            requesterNote: "",
            requiredApprovalLevels: [],
            approvalDecisions: [],
            createdAt: now,
            updatedAt: now,
            result: {
                message: "Script does not require approval.",
                scriptPath: script.path,
                label: script.label || script.name || "Script"
            }
        };
    }

    var provider = {
        type: "myscripts",
        moduleKey: "myscripts",
        title: "My Scripts",
        tabTitle: "My Scripts",
        settingsTitle: "My Scripts approvers",
        description: "Approval workflow for My Scripts executions. Approval levels are defined per script.",
        columns: ["createdAt", "title", "requester", "status"],
        normalizePayload: function (payload) { return shared.copy(payload || {}); },
        getTitle: function (payload) { return payload.label || payload.scriptPath || "Script"; },
        getSummary: function (payload) { return payload.description || payload.scriptPath || "My Scripts request"; },
        getApprovalLevels: approvalLevels,
        canSubmit: allowed,
        execute: function (payload) {
            return Promise.resolve({
                message: "Script request approved.",
                scriptPath: payload.scriptPath || "",
                label: payload.label || "Script"
            });
        }
    };

    return {
        key: "myscripts",
        clientConfig: function () {
            return {
                key: "myscripts",
                name: "My Scripts",
                menuTitle: "My Scripts",
                script: "myscripts.js",
                style: "myscripts.css",
                scriptsRoot: root,
                toolbar: {
                    refresh: true,
                    clear: false,
                    favorites: true,
                    search: true,
                    manage: true,
                    settings: false
                }
            };
        },
        getAccess: function (user) {
            return { allowed: allowed(user), siteAdmin: shared.isSiteAdmin(user) };
        },
        initialize: function () {
            library.ensure();
            if (!unregister) unregister = context.approval.registerProvider(provider);
            return Promise.resolve();
        },
        serveIcon: function (req, res) {
            shared.send(res, 404, "text/plain; charset=utf-8", "Icons are embedded in the script tree.");
        },
        apiGet: function (asset, req, user) {
            if (!allowed(user)) throw new Error("Permission denied.");
            var q = req && req.query || {};
            if (asset === "tree" || asset === "scripts") {
                return { ok: true, tree: library.getTree(), scriptsRoot: shared.isSiteAdmin(user) ? root : "" };
            }
            if (asset === "script") {
                var script = library.getScript(q.path, true);
                if (!script) throw new Error("Script not found.");
                return { ok: true, script: script };
            }
            if (asset === "source") {
                requireAdmin(user);
                var source = library.getSource(q.path);
                if (!source) throw new Error("Script not found.");
                return { ok: true, source: source };
            }
            if (asset === "definition") return { ok: true, definition: admin.getDefinition(user, q.path) };
            if (asset === "script-secrets") return { ok: true, secrets: admin.getSecretState(user, q.path) };
            if (asset === "system-credentials") return { ok: true, systemCredentials: admin.getSystemCredentials(user, q.path) };
            if (asset === "results") {
                return context.approval.list(user, {
                    type: "myscripts",
                    status: q.status || "",
                    q: q.q || "",
                    page: Number(q.page) || 1,
                    perPage: Math.min(500, Number(q.perPage) || 100)
                }).then(function (value) { value.ok = true; return value; });
            }
            if (asset === "settings") {
                return { ok: true, settings: context.settings.read().modules.myscripts || {}, scriptsRoot: root };
            }
            throw new Error("Unknown My Scripts action.");
        },
        apiPost: function (asset, req, user) {
            if (!allowed(user)) throw new Error("Permission denied.");
            var value = req && req.body || {};
            if (asset === "refresh") {
                library.invalidate();
                return { ok: true, tree: library.getTree() };
            }
            if (asset === "source") {
                requireAdmin(user);
                return { ok: true, script: library.saveSource(value.path, value.text), tree: library.getTree() };
            }
            if (asset === "definition") {
                var saved = admin.saveDefinition(user, value.path, value.definition);
                saved.ok = true;
                saved.tree = library.getTree();
                return saved;
            }
            if (asset === "script-secrets") {
                return { ok: true, secrets: admin.saveSecrets(user, value.path, value.values, value.clearNames) };
            }
            if (asset === "system-credentials") {
                return { ok: true, systemCredentials: admin.saveSystemCredentials(user, value.path, value.selected) };
            }
            if (asset === "request") {
                var requestedScript = library.getScript(value.scriptPath, false);
                if (!requestedScript) throw new Error("Script not found.");
                var levels = normalizeApprovalLevels(requestedScript.approvalLevels);
                var payload = shared.copy(value || {});
                payload.scriptPath = requestedScript.path;
                payload.label = requestedScript.label || requestedScript.name;
                payload.description = requestedScript.description || "";
                payload.approvalLevels = levels;

                if (!levels.length && allowNoApproval()) {
                    return { ok: true, request: directResult(requestedScript, user) };
                }
                if (!levels.length) payload.approvalLevels = [1];

                return context.approval.submit("myscripts", user, payload, value.note)
                    .then(function (request) { return { ok: true, request: request }; });
            }
            if (asset === "settings") {
                requireAdmin(user);
                return context.settings.update(function (current) {
                    current.modules.myscripts.accessGroupIds = Array.isArray(value.accessGroupIds)
                        ? value.accessGroupIds.map(String)
                        : [];
                    return current;
                }).then(function () { return { ok: true }; });
            }
            throw new Error("Unknown My Scripts action.");
        }
    };
};