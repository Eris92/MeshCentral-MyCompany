"use strict";

var originalFactory = require("./index.js");

var CUSTOM_FILES_KEY = "mycompany-sirk-portal";

function isPortalEntry(entry) {
    if (!entry || typeof entry !== "object") return false;
    return entry.name === CUSTOM_FILES_KEY ||
        entry.myCompanyPortal === true ||
        entry.sirkPortal === true ||
        entry.name === "sirk-portal";
}

function removePortalEntries(current) {
    if (Array.isArray(current)) {
        return current.filter(function (entry) { return !isPortalEntry(entry); });
    }
    if (current && typeof current === "object") {
        var result = Object.assign({}, current);
        Object.keys(result).forEach(function (key) {
            if (key === CUSTOM_FILES_KEY || isPortalEntry(result[key])) delete result[key];
        });
        return result;
    }
    return {};
}

function disableEarlyOverlay(context) {
    var server = context && context.parent && context.parent.parent;
    var config = server && server.config;
    if (!config || !config.domains || typeof config.domains !== "object") return;

    Object.keys(config.domains).forEach(function (domainId) {
        var domain = config.domains[domainId];
        if (!domain || typeof domain !== "object") return;
        var current = domain.customFiles != null ? domain.customFiles : domain.customfiles;
        var cleaned = removePortalEntries(current);
        domain.customFiles = cleaned;
        domain.customfiles = cleaned;
    });
}

module.exports.createModule = function (context) {
    var module = originalFactory.createModule(context);
    var originalInitialize = module.initialize;
    var originalApiPost = module.apiPost;
    var originalClientConfig = module.clientConfig;

    module.initialize = function () {
        return Promise.resolve(originalInitialize.call(module)).then(function (value) {
            disableEarlyOverlay(context);
            return value;
        }, function (error) {
            // Always fail open: never leave the login page hidden because the Portal failed.
            disableEarlyOverlay(context);
            throw error;
        });
    };

    module.apiPost = function (asset, req, user) {
        return Promise.resolve(originalApiPost.call(module, asset, req, user)).then(function (value) {
            disableEarlyOverlay(context);
            if (value && value.vendor) value.vendor.earlyOverlay = false;
            return value;
        }, function (error) {
            disableEarlyOverlay(context);
            throw error;
        });
    };

    module.clientConfig = function () {
        var value = originalClientConfig.call(module);
        value.earlyOverlay = false;
        value.loginIntegration = false;
        return value;
    };

    return module;
};