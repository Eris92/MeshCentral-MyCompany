"use strict";

var crypto = require("crypto");

function cleanText(value, limit) {
    return String(value == null ? "" : value)
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
        .slice(0, limit || 1000);
}

function copy(value) {
    return JSON.parse(JSON.stringify(value == null ? null : value));
}

function readJson(fs, filePath, fallback) {
    try {
        return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
    } catch (error) {
        return copy(fallback);
    }
}

function writeJsonAtomic(fs, path, filePath, value) {
    var directory = path.dirname(filePath);
    var text = JSON.stringify(value, null, 2);

    if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, { recursive: true });
    }

    try {
        if (fs.existsSync(filePath)) fs.chmodSync(filePath, 0o666);
    } catch (error) {}

    fs.writeFileSync(filePath, text, {
        encoding: "utf8",
        flag: "w"
    });
}

function isSiteAdmin(user) {
    if (!user) return false;
    var value = user.siteadmin, text = String(value).trim().toLowerCase();
    return value === true || value === 0xFFFFFFFF || (Number(value) | 0) === -1 ||
        text === "true" || text === "4294967295" || text === "-1" || text === "0xffffffff";
}

function userName(user) {
    return cleanText(user && (user.realname || user.realName || user.displayName ||
        user.displayname || user.name || user._id) || "unknown", 300);
}

function getWebServer(parent) {
    var candidates = [
        parent && parent.parent && parent.parent.webserver,
        parent && parent.parent,
        parent && parent.webServer,
        parent && parent.webserver,
        parent && parent.parent && parent.parent.parent && parent.parent.parent.webserver
    ];
    for (var i = 0; i < candidates.length; i++) {
        var candidate = candidates[i];
        if (candidate && (candidate.users || candidate.userGroups || candidate.meshes ||
            typeof candidate.GetNodeWithRights === "function")) return candidate;
    }
    return null;
}

function getUserGroups(parent) {
    var web = getWebServer(parent), result = Object.create(null);
    [web && web.userGroups, web && web.usergroups, parent && parent.userGroups].forEach(function (groups) {
        if (!groups || typeof groups !== "object") return;
        Object.keys(groups).forEach(function (id) {
            var group = groups[id];
            if (!group || group.deleted != null) return;
            var key = String(group._id || group.id || id);
            result[key] = { id: key, name: cleanText(group.name || group.displayName || key, 300) };
        });
    });
    return Object.keys(result).map(function (id) { return result[id]; }).sort(function (a, b) {
        return a.name.localeCompare(b.name, "pl", { sensitivity: "base" });
    });
}

function isUserInGroup(user, groupId) {
    groupId = String(groupId || "");
    if (!user || !groupId) return false;
    if (user.links && Object.prototype.hasOwnProperty.call(user.links, groupId)) return true;
    var collections = [user.groups, user.userGroups, user.usergroups];
    for (var i = 0; i < collections.length; i++) {
        if (Array.isArray(collections[i]) && collections[i].map(String).indexOf(groupId) >= 0) return true;
    }
    return false;
}

function isUserInAnyGroup(user, groupIds) {
    return (Array.isArray(groupIds) ? groupIds : []).some(function (id) {
        return isUserInGroup(user, id);
    });
}

function getDomain(parent, user, fallback) {
    if (fallback) return fallback;
    var id = String(user && user.domain || "");
    if (!id && user && user._id) id = String(user._id).split("/")[1] || "";
    var web = getWebServer(parent), mesh = parent && parent.parent;
    var configs = [
        mesh && mesh.config,
        mesh && mesh.parent && mesh.parent.config,
        web && web.parent && web.parent.config
    ];
    for (var i = 0; i < configs.length; i++) {
        if (configs[i] && configs[i].domains && configs[i].domains[id]) return configs[i].domains[id];
    }
    return id ? { id: id } : null;
}

function findUser(parent, userId) {
    userId = String(userId || "");
    var web = getWebServer(parent), users = web && web.users || {};
    if (users[userId]) return users[userId];
    var ids = Object.keys(users);
    for (var i = 0; i < ids.length; i++) {
        if (String(users[ids[i]] && users[ids[i]]._id || ids[i]) === userId) return users[ids[i]];
    }
    return null;
}

function dispatch(parent, source, targets, event) {
    try {
        var web = getWebServer(parent);
        var candidates = [web, web && web.parent, parent && parent.parent,
            parent && parent.parent && parent.parent.parent];
        for (var i = 0; i < candidates.length; i++) {
            if (candidates[i] && typeof candidates[i].DispatchEvent === "function") {
                candidates[i].DispatchEvent(targets || ["*", "server-users"], source || parent, event);
                return true;
            }
        }
    } catch (error) {}
    return false;
}

function normalizeRelativePath(path, root, relativePath) {
    relativePath = String(relativePath || "").replace(/\\/g, "/");
    if (!relativePath || relativePath.indexOf("\0") >= 0 || relativePath.charAt(0) === "/" ||
        relativePath.split("/").indexOf("..") >= 0) return null;
    var resolvedRoot = path.resolve(root);
    var target = path.resolve(resolvedRoot, relativePath.replace(/\//g, path.sep));
    var prefix = resolvedRoot.endsWith(path.sep) ? resolvedRoot : resolvedRoot + path.sep;
    return target.toLowerCase().indexOf(prefix.toLowerCase()) === 0 ? target : null;
}

function parseJsonObject(value, fallback) {
    if (value && typeof value === "object" && !Array.isArray(value)) return value;
    try {
        value = JSON.parse(String(value || ""));
        return value && typeof value === "object" && !Array.isArray(value) ? value : copy(fallback || {});
    } catch (error) { return copy(fallback || {}); }
}

function parseJsonArray(value, fallback) {
    if (Array.isArray(value)) return value;
    try { value = JSON.parse(String(value || "")); return Array.isArray(value) ? value : copy(fallback || []); }
    catch (error) { return copy(fallback || []); }
}

function send(res, status, type, body) {
    res.statusCode = status;
    if (typeof res.set === "function") {
        res.set("Content-Type", type); res.set("Cache-Control", "no-store");
        res.set("X-Content-Type-Options", "nosniff");
    } else if (typeof res.setHeader === "function") {
        res.setHeader("Content-Type", type); res.setHeader("Cache-Control", "no-store");
        res.setHeader("X-Content-Type-Options", "nosniff");
    }
    if (typeof res.send === "function") res.send(body); else res.end(body);
}
function sendJson(res, status, value) {
    send(res, status, "application/json; charset=utf-8", JSON.stringify(value));
}
function randomId(bytes) { return crypto.randomBytes(bytes || 16).toString("hex"); }

module.exports = {
    cleanText: cleanText, copy: copy, dispatch: dispatch, findUser: findUser,
    getDomain: getDomain, getUserGroups: getUserGroups, getWebServer: getWebServer,
    isSiteAdmin: isSiteAdmin, isUserInAnyGroup: isUserInAnyGroup,
    isUserInGroup: isUserInGroup, normalizeRelativePath: normalizeRelativePath,
    parseJsonArray: parseJsonArray, parseJsonObject: parseJsonObject,
    randomId: randomId, readJson: readJson, send: send, sendJson: sendJson,
    userName: userName, writeJsonAtomic: writeJsonAtomic
};
