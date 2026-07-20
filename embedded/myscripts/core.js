"use strict";

var childProcess = require("child_process");

function readJson(fs, filePath, fallback) {
    try {
        var text = fs.readFileSync(filePath, "utf8");
        if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
        return JSON.parse(text);
    } catch (error) { return fallback; }
}

function createCredentialStore(fs, path, filePath) {
    var cache = null;
    var powershell = process.env.SystemRoot ? path.join(process.env.SystemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe") : "powershell.exe";
    function protect(value) {
        if (!value) return "";
        var command = "$s=ConvertTo-SecureString -String ([Console]::In.ReadToEnd()) -AsPlainText -Force; ConvertFrom-SecureString $s";
        return String(childProcess.execFileSync(powershell, ["-NoProfile", "-NonInteractive", "-Command", command], { encoding: "utf8", input: String(value), windowsHide: true })).trim();
    }
    function unprotect(value) {
        if (!value) return "";
        var command = "$cipher=[Console]::In.ReadToEnd(); $s=ConvertTo-SecureString $cipher; $b=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($s); try {[Runtime.InteropServices.Marshal]::PtrToStringBSTR($b)} finally {[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b)}";
        return String(childProcess.execFileSync(powershell, ["-NoProfile", "-NonInteractive", "-Command", command], { encoding: "utf8", input: String(value), windowsHide: true })).trim();
    }
    function read() {
        if (cache) return { login: cache.login, password: cache.password };
        try { var value = JSON.parse(fs.readFileSync(filePath, "utf8")); cache = { login: unprotect(value.login || ""), password: unprotect(value.password || "") }; }
        catch (error) { cache = { login: "", password: "" }; }
        return { login: cache.login, password: cache.password };
    }
    return {
        configured: function () { var value = read(); return !!(value.login && value.password); },
        read: read,
        save: function (login, password) {
            var current = read();
            var next = { login: String(login || current.login), password: String(password || current.password) };
            if (!next.login || !next.password) throw new Error("Login and password are required.");
            fs.mkdirSync(path.dirname(filePath), { recursive: true });
            var temporary = filePath + "." + process.pid + ".tmp";
            fs.writeFileSync(temporary, JSON.stringify({ login: protect(next.login), password: protect(next.password) }, null, 2), "utf8");
            try { fs.renameSync(temporary, filePath); } catch (error) { fs.copyFileSync(temporary, filePath); fs.unlinkSync(temporary); }
            cache = next;
        }
    };
}

function createProtectedJsonStore(fs, path, filePath) {
    var cache = null;
    var powershell = process.env.SystemRoot ? path.join(process.env.SystemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe") : "powershell.exe";
    function protect(value) {
        if (!value) return "";
        var command = "$s=ConvertTo-SecureString -String ([Console]::In.ReadToEnd()) -AsPlainText -Force; ConvertFrom-SecureString $s";
        return String(childProcess.execFileSync(powershell, ["-NoProfile", "-NonInteractive", "-Command", command], { encoding: "utf8", input: String(value), windowsHide: true })).trim();
    }
    function unprotect(value) {
        if (!value) return "";
        var command = "$cipher=[Console]::In.ReadToEnd(); $s=ConvertTo-SecureString $cipher; $b=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($s); try {[Runtime.InteropServices.Marshal]::PtrToStringBSTR($b)} finally {[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b)}";
        return String(childProcess.execFileSync(powershell, ["-NoProfile", "-NonInteractive", "-Command", command], { encoding: "utf8", input: String(value), windowsHide: true })).trim();
    }
    function read() {
        if (cache) return JSON.parse(JSON.stringify(cache));
        try { var value = JSON.parse(fs.readFileSync(filePath, "utf8")); cache = JSON.parse(unprotect(value.data || "") || "{}"); }
        catch (error) { cache = {}; }
        return JSON.parse(JSON.stringify(cache));
    }
    return {
        read: read,
        save: function (value) {
            cache = value && typeof value === "object" ? JSON.parse(JSON.stringify(value)) : {};
            fs.mkdirSync(path.dirname(filePath), { recursive: true });
            var temporary = filePath + "." + process.pid + ".tmp";
            fs.writeFileSync(temporary, JSON.stringify({ data: protect(JSON.stringify(cache)) }, null, 2), "utf8");
            try { fs.renameSync(temporary, filePath); } catch (error) { fs.copyFileSync(temporary, filePath); fs.unlinkSync(temporary); }
        }
    };
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
        setService: function (service) { bus.service = service || null; if (service && typeof service.onProviderRegistered === "function") Object.keys(bus.providers).forEach(function (type) { service.onProviderRegistered(type); }); },
        getProvider: function (type) { var entry = bus.providers[String(type || "").toLowerCase()]; return entry && entry.descriptor || null; }
    };
    parent.__meshApprovalCenterBus = bus;
    return bus;
}

function userName(user) { return String(user && (user.realname || user.realName || user.displayName || user.name || user._id) || "unknown"); }
function isSiteAdmin(user) { if (!user) return false; var value = user.siteadmin, text = String(value).trim().toLowerCase(); return value === true || value === 0xFFFFFFFF || text === "true" || text === "4294967295" || text === "-1" || text === "0xffffffff"; }
function getWebServer(parent) { var candidates = [parent && parent.parent && parent.parent.webserver, parent && parent.parent, parent && parent.webServer]; for (var index = 0; index < candidates.length; index++) if (candidates[index] && (candidates[index].userGroups || candidates[index].users || candidates[index].meshes)) return candidates[index]; return null; }
function getUserGroups(parent) {
    var groups = Object.create(null);
    var candidates = [
        parent,
        parent && parent.parent,
        parent && parent.parent && parent.parent.parent,
        parent && parent.webServer,
        parent && parent.webserver,
        parent && parent.parent && parent.parent.webServer,
        parent && parent.parent && parent.parent.webserver,
        getWebServer(parent)
    ];

    function add(id, value) {
        if (!value || value.deleted != null) return;
        id = String(value._id || value.id || id || "");
        if (!id) return;
        var name = String(value.name || value.displayName || value.displayname || value.realname || id);
        if (!groups[id] || groups[id].name === groups[id].id) groups[id] = { id: id, name: name };
    }

    function addCollection(collection) {
        if (!collection || typeof collection !== "object") return;
        if (Array.isArray(collection)) {
            collection.forEach(function (value, index) { add(index, value); });
            return;
        }
        Object.keys(collection).forEach(function (id) { add(id, collection[id]); });
    }

    var seen = [];
    candidates.forEach(function (candidate) {
        if (!candidate || seen.indexOf(candidate) >= 0) return;
        seen.push(candidate);
        addCollection(candidate.userGroups);
        addCollection(candidate.usergroups);
    });

    return Object.keys(groups).map(function (id) { return groups[id]; }).sort(function (a, b) {
        return a.name.localeCompare(b.name, "pl", { sensitivity: "base" });
    });
}
function permissionData(groupId) { return { allowed: { users: [], userGroups: groupId ? [groupId] : [], meshes: [], nodes: [] }, denied: { users: [], userGroups: [], meshes: [], nodes: [] }, meshOverrides: {}, nodeOverrides: {} }; }
function dispatch(parent, source, event) { try { var webServer = getWebServer(parent), candidates = [webServer, webServer && webServer.parent, parent && parent.parent, parent && parent.parent && parent.parent.parent]; for (var index = 0; index < candidates.length; index++) if (candidates[index] && typeof candidates[index].DispatchEvent === "function") { candidates[index].DispatchEvent(["*", "server-users", event.userid].filter(Boolean), source || parent, event); return; } } catch (error) { } }
function createAuditLogger(parent, pluginName, source) { return function (user, target) { dispatch(parent, source, { etype: "user", action: "pluginclick", userid: user && user._id, username: userName(user), msg: pluginName + " click: " + String(target || "unknown").slice(0, 160) }); }; }

module.exports = { createAuditLogger: createAuditLogger, createCredentialStore: createCredentialStore, createProtectedJsonStore: createProtectedJsonStore, dispatch: dispatch, ensureApprovalBus: ensureApprovalBus, getUserGroups: getUserGroups, getWebServer: getWebServer, isSiteAdmin: isSiteAdmin, permissionData: permissionData, readJson: readJson, userName: userName };
