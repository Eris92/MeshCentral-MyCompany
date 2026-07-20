"use strict";

var path = require("path");
var fs = require("fs");
var originalModule = require("./module.js");
var modulePath = require.resolve("./module.js");

function cleanText(value, limit) {
    return String(value == null ? "" : value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").slice(0, limit || 1000);
}

function readSettings(parent) {
    var settingsPath = path.join(parent.pluginPath, "approvalcenter", "data", "settings.json");
    try {
        var value = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
        return value && typeof value === "object" && !Array.isArray(value) ? value : {};
    } catch (error) {
        return {};
    }
}

function writeSettings(parent, settings) {
    var settingsPath = path.join(parent.pluginPath, "approvalcenter", "data", "settings.json");
    var temporary = settingsPath + ".noapproval-" + process.pid + ".tmp";
    fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
    fs.writeFileSync(temporary, JSON.stringify(settings, null, 2), "utf8");
    try { fs.renameSync(temporary, settingsPath); }
    catch (error) { fs.copyFileSync(temporary, settingsPath); fs.unlinkSync(temporary); }
}

function booleanValue(value) {
    if (value === true || value === 1) return true;
    return /^(1|true|on|yes)$/i.test(String(value || ""));
}

function normalizeLevels(value, allowEmpty) {
    value = Array.isArray(value) ? value : [];
    var levels = value.map(Number).filter(function (level, index, list) {
        return level >= 1 && level <= 3 && list.indexOf(level) === index;
    }).sort();
    return levels.length || allowEmpty ? levels : [1];
}

function configuredGroups(providerSettings, level) {
    var values = providerSettings && providerSettings.approverGroupIds || {};
    var selected = values[level] || values[String(level)] || (level === 1 ? providerSettings && providerSettings.approverGroupId : null);
    selected = Array.isArray(selected) ? selected : (selected ? [selected] : []);
    return selected.map(String).filter(Boolean);
}

function patchedCreateModule(config, parent, source) {
    var api = originalModule.createModule(config, parent, source);
    var bus = require("./core.js").ensureApprovalBus(parent);
    var originalSubmit = api.submit;
    var originalSave = api.saveProviderSettings;
    var originalGetSettings = api.getSettings;

    api.submit = async function (type, user, payload, requesterNote, options) {
        type = cleanText(type, 64).toLowerCase();
        var settings = readSettings(parent);
        var providerSettings = settings.providers && settings.providers[type] || {};
        if (providerSettings.allowNoApproval !== true) {
            var provider = bus.getProvider(type);
            if (!provider) throw new Error("Approval provider is unavailable. Install or reload the required plugin.");
            var validated = typeof provider.validate === "function" ? await Promise.resolve(provider.validate(payload, user)) : { payload: payload };
            if (!validated || validated.ok === false) throw new Error(validated && validated.error || "The provider rejected this request.");
            var levels = normalizeLevels(validated.approvalLevels, false);
            if (type === "moverequest") {
                var assignments = providerSettings.meshApproverGroupIds;
                var sanitizedPayload = validated.payload == null ? payload : validated.payload;
                var targetMeshId = sanitizedPayload && (sanitizedPayload.targetMeshId || sanitizedPayload.targetGroupId);
                if (assignments && targetMeshId && Object.prototype.hasOwnProperty.call(assignments, String(targetMeshId))) {
                    var assignedLevels = assignments[String(targetMeshId)];
                    if (!Array.isArray(assignedLevels)) assignedLevels = assignedLevels == null ? [] : [assignedLevels];
                    levels = normalizeLevels(assignedLevels.map(Number), true);
                }
            }
            var missing = levels.length === 0 || levels.some(function (level) { return configuredGroups(providerSettings, level).length === 0; });
            if (missing) throw new Error("No approval group is assigned for the required approval level. Assign a group or enable 'No approval required' in Approval Center settings.");
        }
        return originalSubmit.apply(api, arguments);
    };

    api.saveProviderSettings = function (user, type, groupIds, enabled, meshAssignments) {
        var allowNoApproval = parent.__approvalCenterAllowNoApproval && parent.__approvalCenterAllowNoApproval[String(type || "").toLowerCase()];
        return Promise.resolve(originalSave.apply(api, arguments)).then(function (result) {
            var settings = readSettings(parent);
            settings.providers = settings.providers && typeof settings.providers === "object" ? settings.providers : {};
            settings.providers[type] = settings.providers[type] && typeof settings.providers[type] === "object" ? settings.providers[type] : {};
            settings.providers[type].allowNoApproval = booleanValue(allowNoApproval);
            if (settings.providers[type].allowNoApproval) {
                settings.providers[type].approverGroupIds = { 1: [], 2: [], 3: [] };
                settings.providers[type].approverGroupId = "";
            }
            writeSettings(parent, settings);
            return result;
        });
    };

    api.getSettings = function (user) {
        var result = originalGetSettings.call(api, user);
        if (!result) return result;
        var settings = readSettings(parent);
        (result.providers || []).forEach(function (provider) {
            var providerSettings = settings.providers && settings.providers[provider.type] || {};
            provider.allowNoApproval = providerSettings.allowNoApproval === true;
        });
        return result;
    };

    bus.setService(api);
    return api;
}

require.cache[modulePath].exports = { createModule: patchedCreateModule };
var originalPlugin = require("./plugin.js");
require.cache[modulePath].exports = originalModule;

module.exports.approvalcenter = function (parent) {
    var obj = originalPlugin.approvalcenter(parent);
    var originalStartup = obj.onWebUIStartupEnd;
    var originalGet = obj.handleAdminReq;
    var originalPost = obj.handleAdminPostReq;

    obj.onWebUIStartupEnd = function () {
        var result = originalStartup && originalStartup.apply(obj, arguments);
        if (typeof window !== "undefined" && typeof document !== "undefined") {
            var loadOverride = function () {
                if (document.getElementById("approvalcenter-noapproval-script")) return;
                var endpoint = new URL("pluginadmin.ashx", window.location.href);
                endpoint.searchParams.set("pin", "mycompany"); endpoint.searchParams.set("module", "approvals");
                endpoint.searchParams.set("asset", "noapproval.js");
                endpoint.searchParams.set("v", "3.0.6");
                var script = document.createElement("script");
                script.id = "approvalcenter-noapproval-script";
                script.src = endpoint.href;
                script.async = false;
                (document.head || document.documentElement).appendChild(script);
            };
            if (window.ApprovalCenter && window.ApprovalCenter.bootstrapPromise) window.ApprovalCenter.bootstrapPromise.then(loadOverride);
            else window.setTimeout(loadOverride, 0);
        }
        return result;
    };

    obj.handleAdminReq = function (req, res, user) {
        var asset = String(req && req.query && req.query.asset || "");
        if (asset === "noapproval.js") {
            res.statusCode = 200;
            res.setHeader("Content-Type", "text/javascript; charset=utf-8");
            res.setHeader("Cache-Control", "no-store");
            fs.createReadStream(path.join(parent.pluginPath, "approvalcenter", "public", "noapproval.js")).pipe(res);
            return;
        }
        return originalGet.apply(obj, arguments);
    };

    obj.handleAdminPostReq = function (req, res, user) {
        var asset = String(req && req.query && req.query.asset || "");
        if (asset === "provider-settings") {
            var type = cleanText(req && req.body && req.body.type, 64).toLowerCase();
            parent.__approvalCenterAllowNoApproval = parent.__approvalCenterAllowNoApproval || Object.create(null);
            parent.__approvalCenterAllowNoApproval[type] = req && req.body && req.body.allowNoApproval;
            try { return originalPost.apply(obj, arguments); }
            finally { delete parent.__approvalCenterAllowNoApproval[type]; }
        }
        return originalPost.apply(obj, arguments);
    };

    return obj;
};
