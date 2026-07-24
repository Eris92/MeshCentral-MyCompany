"use strict";

var shared = require("../../core/shared.js");
var http = require("../../core/http-client.js");

module.exports.createModule = function (context) {
    function allowed(user) {
        if (!user) return false;
        if (shared.isSiteAdmin(user)) return true;
        var groups = context.settings.read().modules.myjira.accessGroupIds || [];
        return shared.isUserInAnyGroup(user, groups);
    }

    function credentials() {
        var value = context.integrations.get("jira");
        if (!value.url || !value.email || !value.token) throw new Error("Jira integration is not configured.");
        return value;
    }

    function request(method, endpoint, body) {
        var value = credentials();
        return http.requestJson({
            method: method,
            url: value.url.replace(/\/+$/, "") + endpoint,
            headers: { Authorization: "Basic " + Buffer.from(value.email + ":" + value.token).toString("base64") },
            json: body,
            verifyTls: value.verifyTls !== false,
            errorPrefix: "Jira"
        });
    }

    return {
        key: "myjira",
        clientConfig: function () {
            return { key: "myjira", name: "My Jira", menuTitle: "Jira", script: "myjira.js", toolbar: { refresh: true, clear: true, favorites: false, search: true, manage: false, settings: true } };
        },
        getAccess: function (user) { return { allowed: allowed(user), siteAdmin: shared.isSiteAdmin(user) }; },
        initialize: function () { return Promise.resolve(); },
        apiGet: function (asset, req, user) {
            if (!allowed(user)) throw new Error("Permission denied.");
            var q = req && req.query || {};
            if (asset === "status") return { ok: true, configured: context.integrations.configured().jira };
            if (asset === "issues") {
                var jql = String(q.jql || "assignee = currentUser() ORDER BY updated DESC");
                return request("POST", "/rest/api/3/search", { jql: jql, maxResults: Math.min(100, Number(q.maxResults) || 50), fields: ["summary", "status", "assignee", "reporter", "updated", "issuetype"] })
                    .then(function (value) { return { ok: true, issues: value.issues || [], total: value.total || 0 }; });
            }
            if (asset === "issue") return request("GET", "/rest/api/3/issue/" + encodeURIComponent(q.key) + "?expand=renderedFields,names").then(function (issue) { return { ok: true, issue: issue }; });
            if (asset === "assets") {
                var value = credentials();
                if (!value.workspaceId) throw new Error("Jira Assets workspaceId is not configured.");
                return request("POST", "/jsm/assets/workspace/" + encodeURIComponent(value.workspaceId) + "/v1/object/aql", { qlQuery: String(q.aql || value.aql || "objectType = Computer"), page: 1, resultPerPage: Math.min(100, Number(q.maxResults) || 50) })
                    .then(function (result) { return { ok: true, assets: result.values || result.objectEntries || [], raw: result }; });
            }
            if (asset === "settings") return { ok: true, integration: context.integrations.publicSettings(user), module: context.settings.read().modules.myjira };
            throw new Error("Unknown My Jira action.");
        },
        apiPost: function (asset, req, user) {
            if (!allowed(user)) throw new Error("Permission denied.");
            var value = req && req.body || {};
            if (asset === "comment") return request("POST", "/rest/api/3/issue/" + encodeURIComponent(value.key) + "/comment", { body: { type: "doc", version: 1, content: [{ type: "paragraph", content: [{ type: "text", text: String(value.comment || "") }] }] } }).then(function (result) { return { ok: true, result: result }; });
            if (asset === "transition") return request("POST", "/rest/api/3/issue/" + encodeURIComponent(value.key) + "/transitions", { transition: { id: String(value.transitionId || "") } }).then(function () { return { ok: true }; });
            if (asset === "assign") return request("PUT", "/rest/api/3/issue/" + encodeURIComponent(value.key) + "/assignee", { accountId: value.accountId || null }).then(function () { return { ok: true }; });
            throw new Error("Unknown My Jira action.");
        }
    };
};
