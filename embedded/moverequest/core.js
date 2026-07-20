"use strict";

function readJson(fs, filePath, fallback) {
    try {
        var text = fs.readFileSync(filePath, "utf8");
        if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
        return JSON.parse(text);
    } catch (error) { return fallback; }
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

function userName(user) {
    return String(user && (user.realname || user.realName || user.displayName || user.name || user._id) || "unknown").trim();
}

function isSiteAdmin(user) {
    return !!user && (user.siteadmin === 0xFFFFFFFF || user.siteadmin === true);
}

function getWebServer(parent) {
    var meshServer = parent && parent.parent;
    var candidates = [meshServer && meshServer.webserver, meshServer && meshServer.parent, meshServer, parent && parent.parent && parent.parent.webserver];
    for (var index = 0; index < candidates.length; index++) if (candidates[index] && typeof candidates[index].GetNodeWithRights === "function") return candidates[index];
    return null;
}

function dispatch(parent, source, targets, event) {
    try {
        var webServer = getWebServer(parent), meshServer = parent && parent.parent;
        var candidates = [meshServer, meshServer && meshServer.parent, webServer && webServer.parent, webServer];
        for (var index = 0; index < candidates.length; index++) {
            if (candidates[index] && typeof candidates[index].DispatchEvent === "function") {
                candidates[index].DispatchEvent(targets || ["*", "server-users", event && event.userid].filter(Boolean), source || parent, event);
                return;
            }
        }
    } catch (error) { }
}

function createAuditLogger(parent, pluginName, source) {
    return function (user, target) {
        dispatch(parent, source, ["*", "server-users", user && user._id].filter(Boolean), {
            etype: "user",
            action: "pluginclick",
            userid: user && user._id,
            username: userName(user),
            msg: pluginName + " click: " + String(target || "unknown").slice(0, 160)
        });
    };
}

module.exports = {
    createAuditLogger: createAuditLogger,
    dispatch: dispatch,
    ensureApprovalBus: ensureApprovalBus,
    getWebServer: getWebServer,
    isSiteAdmin: isSiteAdmin,
    readJson: readJson,
    userName: userName
};
