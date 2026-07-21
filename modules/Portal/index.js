"use strict";

var shared = require("../../core/shared.js");

module.exports.createModule = function (context) {
    function settings() {
        return context.settings.read().modules.portal || {};
    }

    function allowed(user) {
        return !!user;
    }

    function requireAdmin(user) {
        if (!shared.isSiteAdmin(user)) throw new Error("Permission denied.");
    }

    function standalonePortalActive() {
        var plugins = context.parent && context.parent.plugins || {};
        return Object.keys(plugins).some(function (key) {
            var normalized = String(key || "").replace(/[^a-z0-9]/gi, "").toLowerCase();
            return normalized === "sirkportal";
        });
    }

    return {
        key: "portal",
        clientConfig: function () {
            var value = settings();
            return {
                key: "portal",
                name: "SirK Portal",
                menuTitle: "SirK Portal",
                script: "portal.js",
                style: "portal.css",
                showInMenu: false,
                defaultView: String(value.defaultView || "overview"),
                showLauncher: value.showLauncher !== false,
                standaloneConflict: standalonePortalActive()
            };
        },
        getAccess: function (user) {
            return {
                allowed: allowed(user),
                siteAdmin: shared.isSiteAdmin(user)
            };
        },
        initialize: function () {
            return Promise.resolve();
        },
        apiGet: function (asset, req, user) {
            if (!allowed(user)) throw new Error("Permission denied.");
            if (asset === "status" || asset === "settings") {
                return {
                    ok: true,
                    module: settings(),
                    siteAdmin: shared.isSiteAdmin(user),
                    standaloneConflict: standalonePortalActive()
                };
            }
            throw new Error("Unknown Portal action.");
        },
        apiPost: function (asset, req, user) {
            requireAdmin(user);
            var value = req && req.body || {};
            if (asset !== "settings") throw new Error("Unknown Portal action.");
            if (value.enabled === true && standalonePortalActive()) {
                throw new Error("Disable or uninstall the standalone SirKPortal plugin before enabling the embedded MyCompany Portal.");
            }
            return context.settings.update(function (current) {
                current.modules.portal = current.modules.portal || {};
                if (typeof value.enabled === "boolean") current.modules.portal.enabled = value.enabled;
                current.modules.portal.defaultView = ["overview", "devices", "management", "approvals", "settings"].indexOf(String(value.defaultView || "")) >= 0
                    ? String(value.defaultView)
                    : "overview";
                current.modules.portal.showLauncher = value.showLauncher !== false;
                return current;
            }).then(function () {
                return { ok: true, module: settings(), reloadRequired: true };
            });
        }
    };
};
