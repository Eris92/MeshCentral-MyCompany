"use strict";

var shared = require("../../core/shared.js");
var http = require("../../core/http-client.js");

module.exports.createModule = function (context) {
    var tokenCache = { token: "", expiresAt: 0 };

    function settings() { return context.integrations.get("defender"); }
    function tabAllowed(user, tab) {
        if (shared.isSiteAdmin(user)) return true;
        var permissions = settings().permissions || {};
        return shared.isUserInAnyGroup(user, permissions[tab] || []);
    }
    function token() {
        if (tokenCache.token && tokenCache.expiresAt > Date.now() + 60000) return Promise.resolve(tokenCache.token);
        var value = settings();
        if (!value.tenantId || !value.clientId || !value.clientSecret) throw new Error("Defender integration is not configured.");
        return http.requestJson({ method: "POST", url: "https://login.microsoftonline.com/" + encodeURIComponent(value.tenantId) + "/oauth2/v2.0/token", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "client_id=" + encodeURIComponent(value.clientId) + "&client_secret=" + encodeURIComponent(value.clientSecret) + "&scope=" + encodeURIComponent("https://graph.microsoft.com/.default") + "&grant_type=client_credentials", errorPrefix: "Microsoft identity" }).then(function (result) {
            tokenCache.token = result.access_token;
            tokenCache.expiresAt = Date.now() + Math.max(300, Number(result.expires_in) || 3600) * 1000;
            return tokenCache.token;
        });
    }
    function graph(method, endpoint, body) {
        return token().then(function (accessToken) {
            return http.requestJson({ method: method, url: "https://graph.microsoft.com/v1.0" + endpoint, headers: { Authorization: "Bearer " + accessToken }, json: body, errorPrefix: "Microsoft Graph" });
        });
    }

    return {
        key: "defendertools",
        clientConfig: function () {
            return { key: "defendertools", name: "Defender XDR", menuTitle: "Defender", script: "defendertools.js", tabs: ["incidents", "email", "trusted", "hunting"], toolbar: { refresh: true, clear: true, favorites: false, search: true, manage: false, settings: true } };
        },
        getAccess: function (user) { return { allowed: !!user && ["incidents", "email", "trusted", "hunting"].some(function (tab) { return tabAllowed(user, tab); }), siteAdmin: shared.isSiteAdmin(user) }; },
        initialize: function () { return Promise.resolve(); },
        apiGet: function (asset, req, user) {
            var q = req && req.query || {};
            if (asset === "status") return { ok: true, configured: context.integrations.configured().defender, tabs: { incidents: tabAllowed(user, "incidents"), email: tabAllowed(user, "email"), trusted: tabAllowed(user, "trusted"), hunting: tabAllowed(user, "hunting") } };
            if (asset === "incidents") {
                if (!tabAllowed(user, "incidents")) throw new Error("Permission denied.");
                var filter = settings().incidentMode === "active" ? "?$filter=status ne 'resolved'&$top=100" : "?$top=100";
                return graph("GET", "/security/incidents" + filter).then(function (value) { return { ok: true, incidents: value.value || [] }; });
            }
            if (asset === "settings") {
                if (!shared.isSiteAdmin(user)) throw new Error("Permission denied.");
                return { ok: true, integration: context.integrations.publicSettings(user) };
            }
            if (["email", "trusted", "hunting"].indexOf(asset) >= 0) {
                if (!tabAllowed(user, asset)) throw new Error("Permission denied.");
                return { ok: true, rows: [], message: asset + " workflow is available through the embedded Defender scripts." };
            }
            throw new Error("Unknown Defender action.");
        },
        apiPost: function (asset, req, user) {
            var value = req && req.body || {};
            if (asset === "hunt") {
                if (!tabAllowed(user, "hunting")) throw new Error("Permission denied.");
                return token().then(function (accessToken) {
                    return http.requestJson({ method: "POST", url: "https://api.security.microsoft.com/api/advancedhunting/run", headers: { Authorization: "Bearer " + accessToken }, json: { Query: String(value.query || "") }, errorPrefix: "Advanced Hunting" });
                }).then(function (result) { return { ok: true, result: result }; });
            }
            throw new Error("Unknown Defender action.");
        }
    };
};
