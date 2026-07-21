"use strict";

var shared = require("../../core/shared.js");

module.exports.createModule = function (context) {
    var providerTypes = ["moverequests", "mycommands", "myscripts"];

    function access(user) {
        return {
            allowed: !!user,
            siteAdmin: shared.isSiteAdmin(user)
        };
    }

    function query(req) {
        return req && req.query || {};
    }

    function body(req) {
        return req && req.body || {};
    }

    function normalizeProvider(provider) {
        provider = provider && typeof provider === "object"
            ? provider
            : {};
        return {
            enabled: provider.enabled !== false,
            showTab: provider.showTab !== false,
            showOverview: provider.showOverview !== false,
            allowNoApproval: provider.allowNoApproval === true,
            levels: provider.levels || {}
        };
    }

    function normalizeProviderSettings() {
        return context.settings.update(function (current) {
            var approval = current.modules.approvalcenter;
            approval.providers = approval.providers || {};

            providerTypes.forEach(function (type) {
                approval.providers[type] = normalizeProvider(
                    approval.providers[type]
                );
            });

            return current;
        });
    }

    function saveSettings(user, value) {
        if (!shared.isSiteAdmin(user)) {
            return Promise.reject(new Error("Permission denied."));
        }

        value = value || {};
        var providers = value.providers && typeof value.providers === "object"
            ? value.providers
            : {};
        var retentionDays = Math.max(
            1,
            Math.min(3650, Number(value.retentionDays) || 365)
        );

        return context.settings.update(function (current) {
            current.modules.approvalcenter.retentionDays = retentionDays;
            return current;
        }).then(function () {
            return Promise.all(providerTypes.map(function (type) {
                return context.approval.saveProviderSettings(
                    user,
                    type,
                    normalizeProvider(providers[type])
                );
            }));
        }).then(function () {
            return {
                ok: true,
                settings: context.approval.getSettings(user)
            };
        });
    }

    return {
        key: "approvalcenter",
        clientConfig: function () {
            return {
                key: "approvalcenter",
                name: "Approval Center",
                menuTitle: "Approval Center",
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
            return normalizeProviderSettings().then(function () {
                return context.approval.initialize();
            });
        },
        apiGet: function (asset, req, user) {
            if (!user) throw new Error("Permission denied.");
            var q = query(req);

            if (asset === "providers") {
                return {
                    ok: true,
                    providers: context.approval.listProviders()
                };
            }
            if (asset === "overview") {
                return context.approval.overview(user).then(function (cards) {
                    return { ok: true, cards: cards };
                });
            }
            if (asset === "requests") {
                return context.approval.list(user, q).then(function (value) {
                    value.ok = true;
                    return value;
                });
            }
            if (asset === "request") {
                return {
                    ok: true,
                    request: context.approval.getRequest(user, q.id)
                };
            }
            if (asset === "settings") {
                return {
                    ok: true,
                    settings: context.approval.getSettings(user)
                };
            }
            throw new Error("Unknown Approval Center action.");
        },
        apiPost: function (asset, req, user) {
            var value = body(req);

            if (asset === "decide") {
                return context.approval.decide(
                    user,
                    value.id,
                    value.approved === true || value.approved === "true",
                    value.note
                ).then(function (request) {
                    return { ok: true, request: request };
                });
            }
            if (asset === "settings") {
                return saveSettings(user, value);
            }
            if (asset === "provider-settings") {
                return context.approval.saveProviderSettings(
                    user,
                    value.type,
                    normalizeProvider(value)
                ).then(function () {
                    return { ok: true };
                });
            }
            if (asset === "create-token") {
                return {
                    ok: true,
                    result: context.approval.createApiToken(user, value)
                };
            }
            if (asset === "revoke-token") {
                return {
                    ok: true,
                    revoked: context.approval.revokeApiToken(user, value.id)
                };
            }
            throw new Error("Unknown Approval Center action.");
        }
    };
};