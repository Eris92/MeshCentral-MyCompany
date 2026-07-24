"use strict";

var fs = require("fs");
var path = require("path");
var originalFactory = require("./index.js");

function portalSettings(context) {
    var current = context.settings.read();
    return current && current.modules && current.modules.portal || {};
}

function safeUrl(value) {
    value = String(value || "").trim();
    if (!value) return "";
    try {
        var parsed = new URL(value);
        return /^https?:$/i.test(parsed.protocol) ? parsed.href : "";
    } catch (error) { return ""; }
}

function writeBranding(context, settings) {
    try {
        var root = context && context.pluginRoot || path.resolve(__dirname, "../..");
        var target = path.join(root, "public", "portal-branding.json");
        var payload = {
            siteName: String(settings.siteName || "SirK Portal").trim().slice(0, 80) || "SirK Portal",
            siteIconUrl: safeUrl(settings.siteIconUrl),
            showPasswordReset: settings.showPasswordReset !== false,
            passwordResetUrl: safeUrl(settings.passwordResetUrl) || "https://passwordreset.microsoftonline.com/"
        };
        fs.writeFileSync(target, JSON.stringify(payload, null, 2), "utf8");
    } catch (error) {}
}

module.exports.createModule = function (context) {
    var module = originalFactory.createModule(context);
    var originalInitialize = module.initialize;
    var originalApiGet = module.apiGet;
    var originalApiPost = module.apiPost;
    var originalClientConfig = module.clientConfig;

    module.initialize = function () {
        return Promise.resolve(originalInitialize.call(module)).then(function (value) {
            writeBranding(context, portalSettings(context));
            return value;
        });
    };

    module.apiGet = function (asset, req, user) {
        if (asset === "devices") {
            if (!user) return Promise.reject(new Error("Permission denied."));
            if (typeof module.canAccessView === "function" && !module.canAccessView(user, "devices")) return Promise.reject(new Error("Portal view access denied."));
            return Promise.resolve(context.device.visibleNodes(user)).then(function (value) {
                return { ok: true, nodes: value && value.nodes || [], meshes: value && value.meshes || [] };
            });
        }
        return Promise.resolve(originalApiGet.call(module, asset, req, user)).then(function (value) {
            if (value && value.vendor) value.vendor.earlyOverlay = false;
            return value;
        });
    };

    module.apiPost = function (asset, req, user) {
        var body = req && req.body || {};
        return Promise.resolve(originalApiPost.call(module, asset, req, user)).then(function (value) {
            return context.settings.update(function (current) {
                current.modules.portal = current.modules.portal || {};
                if (typeof body.showNativeLink === "boolean") current.modules.portal.showNativeLink = body.showNativeLink;
                if (typeof body.showPasswordReset === "boolean") current.modules.portal.showPasswordReset = body.showPasswordReset;
                if (body.passwordResetUrl != null) current.modules.portal.passwordResetUrl = safeUrl(body.passwordResetUrl) || "https://passwordreset.microsoftonline.com/";
                if (body.siteName != null) current.modules.portal.siteName = String(body.siteName || "SirK Portal").trim().slice(0, 80) || "SirK Portal";
                if (body.siteIconUrl != null) current.modules.portal.siteIconUrl = safeUrl(body.siteIconUrl);
                delete current.modules.portal.loginPanel;
                return current;
            }).then(function () {
                var settings = portalSettings(context);
                writeBranding(context, settings);
                if (value && typeof value === "object") value.module = settings;
                return value;
            });
        });
    };

    module.clientConfig = function (user) {
        var value = originalClientConfig.call(module, user);
        var settings = portalSettings(context);
        value.showLauncher = settings.showLauncher === true;
        value.showNativeLink = settings.showNativeLink !== false;
        value.forceNewLogin = settings.forceNewLogin === true;
        value.forcePortalInterface = settings.forcePortalInterface === true;
        value.keepSessionsAfterRestart = settings.keepSessionsAfterRestart === true;
        value.showPasswordReset = settings.showPasswordReset !== false;
        value.passwordResetUrl = safeUrl(settings.passwordResetUrl) || "https://passwordreset.microsoftonline.com/";
        value.siteName = String(settings.siteName || "SirK Portal").trim().slice(0, 80) || "SirK Portal";
        value.siteIconUrl = safeUrl(settings.siteIconUrl);
        value.earlyOverlay = false;
        value.loginIntegration = false;
        return value;
    };

    return module;
};