"use strict";

var shared = require("./shared.js");
var baseFactory = require("./runtime.js");
var portalFactory = require("../modules/Portal/index-safe.js");

var VERSION = "1.5.0";
var PORTAL_DEFAULTS = {
    enabled: false,
    defaultView: "overview",
    showLauncher: true
};

module.exports.createRuntime = function (options) {
    var runtime = baseFactory.createRuntime(options);
    var context = runtime.context;

    context.settings.defaults.modules = context.settings.defaults.modules || {};
    context.settings.defaults.modules.portal = shared.copy(PORTAL_DEFAULTS);

    runtime.modules.portal = portalFactory.createModule(context);

    var originalAdminSnapshot = runtime.adminSnapshot;
    runtime.adminSnapshot = function (user) {
        var value = originalAdminSnapshot(user);
        if (value && value.plugin) value.plugin.version = VERSION;
        return value;
    };

    runtime.bootstrap = function (user) {
        var result = {};
        Object.keys(runtime.modules).forEach(function (key) {
            var module = runtime.modules[key];
            result[key] = {
                enabled: context.settings.isModuleEnabled(key),
                ready: !module.__loadError,
                error: module.__loadError || null,
                config: module.clientConfig(),
                access: module.getAccess(user)
            };
        });
        return {
            ok: true,
            version: VERSION,
            modules: result
        };
    };

    var originalRequest = runtime.request;
    runtime.request = function (method, moduleName, asset, req, res, user) {
        if (moduleName === "_runtime" && method === "GET") {
            shared.sendJson(res, 200, runtime.bootstrap(user));
            return;
        }
        return originalRequest(method, moduleName, asset, req, res, user);
    };

    runtime.version = VERSION;
    return runtime;
};
