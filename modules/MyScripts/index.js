"use strict";

var shared = require("../../core/shared.js");
var libraryFactory = require("../../core/script-library.js");

module.exports.createModule = function (context) {
    var root = context.path.join(context.pluginRoot, "seed", "MyScripts");
    var library = libraryFactory.createScriptLibrary({
        fs: context.fs,
        path: context.path,
        root: root,
        readOnly: true
    });
    var unregister = null;

    function allowed(user) {
        if (shared.isSiteAdmin(user)) return true;
        var config = context.settings.read().modules.myscripts || {};
        var groups = Array.isArray(config.accessGroupIds) ? config.accessGroupIds : [];
        return !groups.length || shared.isUserInAnyGroup(user, groups);
    }

    var provider = {
        type: "myscripts",
        moduleKey: "myscripts",
        title: "Scripts",
        tabTitle: "Scripts",
        description: "Approval workflow for My Scripts executions.",
        columns: ["createdAt", "title", "requester", "status"],
        normalizePayload: function (payload) {
            return shared.copy(payload || {});
        },
        getTitle: function (payload) {
            return payload.label || payload.scriptPath || "Script";
        },
        getSummary: function (payload) {
            return payload.description || payload.scriptPath || "My Scripts request";
        },
        getApprovalLevels: function (payload) {
            return payload.approvalLevels || [1];
        },
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
                    clear: true,
                    favorites: true,
                    search: true,
                    manage: true,
                    settings: false
                }
            };
        },
        getAccess: function (user) {
            return {
                allowed: allowed(user),
                siteAdmin: shared.isSiteAdmin(user)
            };
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
                return {
                    ok: true,
                    tree: library.getTree(),
                    scriptsRoot: shared.isSiteAdmin(user) ? root : ""
                };
            }
            if (asset === "script") {
                var script = library.getScript(q.path, true);
                if (!script) throw new Error("Script not found.");
                return { ok: true, script: script };
            }
            if (asset === "results") {
                return context.approval.list(user, {
                    type: "myscripts",
                    status: q.status || "",
                    q: q.q || "",
                    page: Number(q.page) || 1,
                    perPage: Math.min(500, Number(q.perPage) || 100)
                }).then(function (value) {
                    value.ok = true;
                    return value;
                });
            }
            if (asset === "settings") {
                return {
                    ok: true,
                    settings: context.settings.read().modules.myscripts || {},
                    scriptsRoot: root
                };
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
            if (asset === "request") {
                return context.approval.submit("myscripts", user, value, value.note)
                    .then(function (request) {
                        return { ok: true, request: request };
                    });
            }
            if (asset === "settings") {
                if (!shared.isSiteAdmin(user)) throw new Error("Permission denied.");
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
