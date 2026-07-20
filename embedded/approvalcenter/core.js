"use strict";

var childProcess = require("child_process");

function readJson(fs, filePath, fallback) {
    try {
        var text = fs.readFileSync(filePath, "utf8");
        if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
        return JSON.parse(text);
    } catch (error) {
        return fallback;
    }
}

function writeJsonAtomic(fs, path, filePath, value) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    var temporary = filePath + "." + process.pid + ".tmp";
    fs.writeFileSync(temporary, JSON.stringify(value, null, 2), "utf8");
    try { fs.renameSync(temporary, filePath); }
    catch (error) { fs.copyFileSync(temporary, filePath); fs.unlinkSync(temporary); }
}

function ensureWritableDirectory(fs, path, directory) {
    fs.mkdirSync(directory, { recursive: true });
    var probe = path.join(directory, ".approvalcenter-write-test-" + process.pid);
    try {
        fs.writeFileSync(probe, "", "utf8");
        fs.unlinkSync(probe);
        return;
    } catch (error) {
        try { if (fs.existsSync(probe)) fs.unlinkSync(probe); } catch (ignore) { }
        if (process.platform !== "win32") throw error;
    }
    var identity = String(childProcess.execFileSync("whoami.exe", ["/user", "/fo", "csv", "/nh"], { encoding: "utf8", windowsHide: true })).trim();
    var match = identity.match(/,"([^"]+)"\s*$/);
    if (!match) throw new Error("Nie można ustalić SID konta usługi MeshCentral.");
    childProcess.execFileSync("icacls.exe", [directory, "/grant", "*" + match[1] + ":(OI)(CI)M", "/T", "/C"], { windowsHide: true, stdio: "ignore" });
    fs.writeFileSync(probe, "", "utf8");
    fs.unlinkSync(probe);
}

function isSiteAdmin(user) {
    if (!user) return false;
    var value = user.siteadmin;
    var text = String(value).trim().toLowerCase();
    return value === true || value === 0xFFFFFFFF || text === "true" || text === "4294967295" || text === "-1" || text === "0xffffffff";
}

function userName(user) {
    return String(user && (user.realname || user.realName || user.displayName || user.name || user._id) || "unknown");
}

function getWebServer(parent) {
    var candidates = [
        parent && parent.parent && parent.parent.webserver,
        parent && parent.parent,
        parent && parent.webServer,
        parent && parent.parent && parent.parent.parent && parent.parent.parent.webserver
    ];
    for (var index = 0; index < candidates.length; index++) {
        if (candidates[index] && (candidates[index].userGroups || candidates[index].users || candidates[index].meshes)) return candidates[index];
    }
    return null;
}

function getUserGroups(parent) {
    var webServer = getWebServer(parent);
    var groups = webServer && (webServer.userGroups || webServer.usergroups) || {};
    return Object.keys(groups).filter(function (id) {
        return groups[id] && groups[id].deleted == null;
    }).map(function (id) {
        return { id: String(groups[id]._id || id), name: String(groups[id].name || groups[id].displayName || id) };
    }).sort(function (left, right) { return left.name.localeCompare(right.name); });
}

function isUserInGroup(user, groupId) {
    groupId = String(groupId || "");
    if (!user || !groupId) return false;
    if (user.links && Object.prototype.hasOwnProperty.call(user.links, groupId)) return true;
    var collections = [user.groups, user.userGroups, user.usergroups];
    for (var index = 0; index < collections.length; index++) {
        if (Array.isArray(collections[index]) && collections[index].map(String).indexOf(groupId) >= 0) return true;
    }
    return false;
}

function dispatchEvent(parent, source, targets, event) {
    try {
        var webServer = getWebServer(parent);
        var candidates = [webServer, webServer && webServer.parent, parent && parent.parent, parent && parent.parent && parent.parent.parent];
        for (var index = 0; index < candidates.length; index++) {
            if (candidates[index] && typeof candidates[index].DispatchEvent === "function") {
                candidates[index].DispatchEvent(targets || ["*", "server-users"], source || parent, event);
                return true;
            }
        }
    } catch (error) { }
    return false;
}

function ensureApprovalBus(parent) {
    if (parent.__meshApprovalCenterBus) return parent.__meshApprovalCenterBus;
    var bus = {
        version: "1.1.0",
        providers: Object.create(null),
        service: null,
        registerProvider: function (provider) {
            if (!provider || !/^[a-z][a-z0-9_-]{1,63}$/i.test(String(provider.type || ""))) throw new Error("Invalid Approval Center provider type.");
            var type = String(provider.type).toLowerCase();
            var token = type + "-" + Date.now() + "-" + Math.random();
            bus.providers[type] = { token: token, descriptor: provider };
            if (bus.service && typeof bus.service.onProviderRegistered === "function") bus.service.onProviderRegistered(type);
            return function () { if (bus.providers[type] && bus.providers[type].token === token) delete bus.providers[type]; };
        },
        setService: function (service) {
            bus.service = service || null;
            if (service && typeof service.onProviderRegistered === "function") Object.keys(bus.providers).forEach(function (type) { service.onProviderRegistered(type); });
        },
        getProvider: function (type) {
            var entry = bus.providers[String(type || "").toLowerCase()];
            return entry && entry.descriptor || null;
        }
    };
    parent.__meshApprovalCenterBus = bus;
    return bus;
}

function createAuditLogger(parent, pluginName, source) {
    return function (user, target) {
        dispatchEvent(parent, source, ["*", "server-users"], {
            etype: "user",
            action: "pluginclick",
            userid: user && user._id,
            username: userName(user),
            msg: String(pluginName || "plugin") + " click: " + String(target || "unknown").slice(0, 160)
        });
    };
}

module.exports = {
    createAuditLogger: createAuditLogger,
    dispatchEvent: dispatchEvent,
    ensureApprovalBus: ensureApprovalBus,
    ensureWritableDirectory: ensureWritableDirectory,
    getUserGroups: getUserGroups,
    getWebServer: getWebServer,
    isSiteAdmin: isSiteAdmin,
    isUserInGroup: isUserInGroup,
    readJson: readJson,
    userName: userName,
    writeJsonAtomic: writeJsonAtomic
};

