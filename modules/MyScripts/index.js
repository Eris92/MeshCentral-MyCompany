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

    function approvalLevels(payload) {
        var levels = Array.isArray(payload && payload.approvalLevels)
            ? payload.approvalLevels.map(Number).filter(function (level) {
                return level >= 1 && level <= 3;
            })
            : [];
        if (levels.length) return levels;
        var settings = context.settings.read();
        var provider = settings.modules && settings.modules.approvalcenter &&
            settings.modules.approvalcenter.providers &&
            settings.modules.approvalcenter.providers.myscripts || {};
        return provider.allowNoApproval === true ? [] : [1];
    }

    var provider = {
        type: "myscripts",
        moduleKey: "myscripts",
        title: "Scripts",
        tabTitle: "Scripts",
        description: "Approval workflow for My Scripts executions.",
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
            if (asset === "request") {
                return context.approval.submit("myscripts", user, value, value.note)
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