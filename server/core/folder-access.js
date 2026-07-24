"use strict";

var shared = require("./shared.js");

function normalizeRules(value, allowedKeys, knownGroups) {
    value = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    allowedKeys = Array.isArray(allowedKeys) ? allowedKeys.map(String) : [];
    knownGroups = Array.isArray(knownGroups) ? knownGroups.map(String) : [];
    var result = {};
    allowedKeys.forEach(function (key) {
        var source = value[key] && typeof value[key] === "object" && !Array.isArray(value[key]) ? value[key] : {};
        result[key] = {
            enabled: source.enabled !== false,
            allowAll: source.allowAll === true,
            groupIds: (Array.isArray(source.groupIds) ? source.groupIds : []).map(String).filter(function (id, index, all) {
                return knownGroups.indexOf(id) >= 0 && all.indexOf(id) === index;
            })
        };
    });
    return result;
}

function migrateLegacyRules(value) {
    value = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    var changed = false;
    Object.keys(value).forEach(function (key) {
        var rule = value[key];
        if (!rule || typeof rule !== "object" || Array.isArray(rule) || Object.prototype.hasOwnProperty.call(rule, "allowAll")) return;
        rule.allowAll = !Array.isArray(rule.groupIds) || rule.groupIds.length === 0;
        changed = true;
    });
    return changed;
}

function canAccess(user, rules, key) {
    key = String(key || "");
    var rule = rules && rules[key];
    if (rule && rule.enabled === false) return false;
    if (shared.isSiteAdmin(user)) return true;
    var groups = rule && Array.isArray(rule.groupIds) ? rule.groupIds : [];
    return !!(rule && rule.allowAll === true) || (groups.length > 0 && shared.isUserInAnyGroup(user, groups));
}

function filterTree(tree, rules, user) {
    var result = shared.copy(tree || { type: "directory", path: "", children: [] });
    result.children = (result.children || []).filter(function (root) {
        return canAccess(user, rules, String(root.path || root.name || ""));
    });
    return result;
}

function rootKey(relativePath) {
    return String(relativePath || "").replace(/\\/g, "/").split("/")[0] || "";
}

function requirePath(user, rules, relativePath) {
    var key = rootKey(relativePath);
    if (!key || !canAccess(user, rules, key)) throw new Error("Folder access denied.");
    return key;
}

module.exports = {
    canAccess: canAccess,
    filterTree: filterTree,
    migrateLegacyRules: migrateLegacyRules,
    normalizeRules: normalizeRules,
    requirePath: requirePath,
    rootKey: rootKey
};
