"use strict";

var shared = require("../../../core/shared.js");

module.exports.createModule = function (context) {
    var providerTypes = ["moverequests", "mycommands", "myscripts"];
    var policyGuardInstalled = false;

    function access(user) {
        return { allowed: !!user, siteAdmin: shared.isSiteAdmin(user) };
    }

    function query(req) { return req && req.query || {}; }
    function body(req) { return req && req.body || {}; }

    function normalizeProvider(provider) {
        provider = provider && typeof provider === "object" ? provider : {};
        return {
            enabled: provider.enabled !== false,
            showTab: provider.showTab !== false,
            showOverview: provider.showOverview !== false,
            allowNoApproval: provider.allowNoApproval === true,
            levels: provider.levels || {}
        };
    }

    function providerPolicy(type) {
        var current = context.settings.read();
        return current.modules && current.modules.approvalcenter &&
            current.modules.approvalcenter.providers &&
            current.modules.approvalcenter.providers[type] || {};
    }

    function installPolicyGuard() {
        if (policyGuardInstalled || context.approval.__explicitNoApprovalGuard) return;
        var originalSubmit = context.approval.submit;
        context.approval.submit = function (type, user, payload, note, submitOptions) {
            type = String(type || "").toLowerCase();
            payload = shared.copy(payload || {});
            var levels = Array.isArray(payload.approvalLevels)
                ? payload.approvalLevels.map(Number).filter(function (level, index, all) {
                    return level >= 1 && level <= 3 && all.indexOf(level) === index;
                })
                : [];
            var policy = providerPolicy(type);

            // The legacy key "myscripts" is retained for stored settings and requests.
            // An empty level list means direct execution and must stay empty.
            if (type !== "myscripts" && !levels.length && policy.allowNoApproval !== true) {
                levels = [1];
            }

            payload.approvalLevels = levels;
            return originalSubmit.call(context.approval, type, user, payload, note, submitOptions);
        };
        context.approval.__explicitNoApprovalGuard = true;
        policyGuardInstalled = true;
    }

    function persistNoApproval(type, enabled) {
        return context.settings.update(function (current) {
            var approval = current.modules.approvalcenter;
            approval.providers = approval.providers || {};
            approval.providers[type] = approval.providers[type] || {};
            approval.providers[type].allowNoApproval = enabled === true;
            return current;
        });
    }

    function normalizeProviderSettings() {
        return context.settings.update(function (current) {
            var approval = current.modules.approvalcenter;
            approval.providers = approval.providers || {};
            providerTypes.forEach(function (type) {
                approval.providers[type] = normalizeProvider(approval.providers[type]);
            });
            return current;
        });
    }

    function saveOneProvider(user, type, provider) {
        provider = normalizeProvider(provider);
        return context.approval.saveProviderSettings(user, type, provider)
            .then(function () { return persistNoApproval(type, provider.allowNoApproval); });
    }

    function saveSettings(user, value) {
        if (!shared.isSiteAdmin(user)) return Promise.reject(new Error("Permission denied."));
        value = value || {};
        var providers = value.providers && typeof value.providers === "object" ? value.providers : {};
        var retentionDays = Math.max(1, Math.min(3650, Number(value.retentionDays) || 365));

        return context.settings.update(function (current) {
            current.modules.approvalcenter.retentionDays = retentionDays;
            return current;
        }).then(function () {
            return Promise.all(providerTypes.map(function (type) {
                return saveOneProvider(user, type, providers[type]);
            }));
        }).then(function () {
            return { ok: true, settings: context.approval.getSettings(user) };
        });
    }

    return {
        key: "approvalcenter",
        clientConfig: function () {
            return {
                key: "approvalcenter",
                name: "Approvals",
                menuTitle: "Approvals",
                script: "approvalcenter.js",
                style: "main.css",
                layout: "provider-status-requests",
                toolbar: {
                    refresh: true,
                    clear: true,
                    favorites: false,
                    search: true,
                    manage: false,
                    settings: false
                }
            };
        },
        getAccess: access,
        initialize: function () {
            installPolicyGuard();
            return normalizeProviderSettings().then(function () { return context.approval.initialize(); });
        },
        apiGet: function (asset, req, user) {
            if (!user) throw new Error("Permission denied.");
            var q = query(req);
            if (asset === "providers") return { ok: true, providers: context.approval.listProviders() };
            if (asset === "overview") return context.approval.overview(user).then(function (cards) { return { ok: true, cards: cards }; });
            if (asset === "requests") return context.approval.list(user, q).then(function (value) { value.ok = true; return value; });
            if (asset === "request") return { ok: true, request: context.approval.getRequest(user, q.id) };
            if (asset === "settings") return { ok: true, settings: context.approval.getSettings(user) };
            throw new Error("Unknown Approvals action.");
        },
        apiPost: function (asset, req, user) {
            var value = body(req);
            if (asset === "decide") {
                return context.approval.decide(user, value.id, value.approved === true || value.approved === "true", value.note)
                    .then(function (request) { return { ok: true, request: request }; });
            }
            if (asset === "settings") return saveSettings(user, value);
            if (asset === "provider-settings") {
                return saveOneProvider(user, value.type, value).then(function () { return { ok: true }; });
            }
            if (asset === "create-token") return { ok: true, result: context.approval.createApiToken(user, value) };
            if (asset === "revoke-token") return { ok: true, revoked: context.approval.revokeApiToken(user, value.id) };
            throw new Error("Unknown Approvals action.");
        }
    };
};
