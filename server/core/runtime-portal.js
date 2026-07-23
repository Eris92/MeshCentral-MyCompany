"use strict";

var shared = require("./shared.js");
var baseFactory = require("./runtime.js");
var portalFactory = require("../modules/portal/safe.js");
var VERSION = require("../../config.json").version;

var VIEW_DEFAULTS = {
    overview: { enabled: true, personalized: false, label: "", accent: "#4d6bd8" },
    devices: { enabled: true, personalized: false, label: "", accent: "#55b8ff" },
    approvals: { enabled: true, personalized: false, label: "", accent: "#35d7a4" },
    automation: { enabled: true, personalized: false, label: "", accent: "#ffae00" },
    monitoring: { enabled: true, personalized: false, label: "", accent: "#34d1e7" },
    assets: { enabled: true, personalized: false, label: "", accent: "#9a7cff" },
    management: { enabled: true, personalized: false, label: "", accent: "#ff5f7d" },
    reports: { enabled: true, personalized: false, label: "", accent: "#7f85ff" },
    security: { enabled: true, personalized: false, label: "", accent: "#ff385d" },
    settings: { enabled: true, personalized: false, label: "", accent: "#94a3b8" }
};

var PORTAL_DEFAULTS = {
    enabled: true,
    defaultView: "overview",
    showLauncher: true,
    showNativeLink: true,
    forceNewLogin: false,
    forcePortalInterface: false,
    keepSessionsAfterRestart: false,
    showPasswordReset: true,
    passwordResetUrl: "https://passwordreset.microsoftonline.com/",
    siteName: "SIRK Platform",
    siteIconUrl: "",
    views: VIEW_DEFAULTS
};

module.exports.createRuntime = function (options) {
    var runtime = baseFactory.createRuntime(options);
    var context = runtime.context;

    context.settings.defaults.modules = context.settings.defaults.modules || {};
    context.settings.defaults.modules.portal = shared.copy(PORTAL_DEFAULTS);
    runtime.modules.portal = portalFactory.createModule(context);

    var baseSnapshot = runtime.adminSnapshot;
    runtime.adminSnapshot = function (user) {
        var value = baseSnapshot(user);
        if (value && value.plugin) {
            value.plugin.name = "SIRK Management Platform";
            value.plugin.shortName = "SIRK-Portal";
            value.plugin.version = VERSION;
        }
        return value;
    };

    runtime.bootstrap = function (user) {
        var result = {};
        Object.keys(runtime.modules).forEach(function (key) {
            var module = runtime.modules[key];
            result[key] = {
                enabled: context.settings.isModuleEnabled(key),
                ready: !module.__loadError,
                error: module.__loadError
                    ? (shared.isSiteAdmin(user) ? module.__loadError : "Module failed to load.")
                    : null,
                config: module.clientConfig(user),
                access: module.getAccess(user)
            };
        });
        return {
            ok: true,
            version: VERSION,
            user: {
                name: shared.userName(user),
                hasImage: !!(user && user.flags && (user.flags & 1)),
                imageRnd: user && user.accountImageRnd != null ? String(user.accountImageRnd) : ""
            },
            modules: result
        };
    };

    var baseRequest = runtime.request;
    runtime.request = function (method, moduleName, asset, req, res, user) {
        if (moduleName === "_runtime" && method === "GET") {
            shared.sendJson(res, 200, runtime.bootstrap(user));
            return;
        }
        return baseRequest(method, moduleName, asset, req, res, user);
    };

    runtime.version = VERSION;
    return runtime;
};
