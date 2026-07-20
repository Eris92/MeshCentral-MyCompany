"use strict";

function readJson(fs, filePath, fallback) {
    try {
        var text = fs.readFileSync(filePath, "utf8");
        if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
        return JSON.parse(text);
    } catch (error) {
        return fallback;
    }
}

function createCredentialStore(fs, childProcess, pathModule, filePath) {
    var cache = null;
    var powershell = process.env.SystemRoot ? pathModule.join(process.env.SystemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe") : "powershell.exe";
    var protect = function (value) { if (!value) return ""; var command = "$s=ConvertTo-SecureString -String ([Console]::In.ReadToEnd()) -AsPlainText -Force; ConvertFrom-SecureString $s"; return String(childProcess.execFileSync(powershell, ["-NoProfile", "-NonInteractive", "-Command", command], { encoding: "utf8", input: String(value), windowsHide: true })).trim(); };
    var unprotect = function (value) { if (!value) return ""; var command = "$cipher=[Console]::In.ReadToEnd(); $s=ConvertTo-SecureString $cipher; $b=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($s); try {[Runtime.InteropServices.Marshal]::PtrToStringBSTR($b)} finally {[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b)}"; return String(childProcess.execFileSync(powershell, ["-NoProfile", "-NonInteractive", "-Command", command], { encoding: "utf8", input: String(value), windowsHide: true })).trim(); };
    var read = function () { if (cache) return { login: cache.login, password: cache.password }; try { var value = JSON.parse(fs.readFileSync(filePath, "utf8")); cache = { login: unprotect(value.login || ""), password: unprotect(value.password || "") }; } catch (error) { cache = { login: "", password: "" }; } return { login: cache.login, password: cache.password }; };
    return { read: read, configured: function () { var value = read(); return !!(value.login && value.password); }, save: function (login, password) { var current = read(); var next = { login: String(login || current.login), password: String(password || current.password) }; if (!next.login || !next.password) throw new Error("Login i hasło są wymagane."); fs.mkdirSync(pathModule.dirname(filePath), { recursive: true }); var temporaryPath = filePath + ".tmp"; fs.writeFileSync(temporaryPath, JSON.stringify({ login: protect(next.login), password: protect(next.password) }, null, 2), "utf8"); fs.renameSync(temporaryPath, filePath); cache = next; } };
}

function send(res, statusCode, contentType, body) {
    res.statusCode = statusCode;
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "no-store");
    res.end(body);
}

function createAssetHandler(fs, assets, getClientConfig) {
    return function (req, res) {
        var assetName = String(req && req.query && req.query.asset || "");

        if (assetName === "config") {
            send(
                res,
                200,
                "application/json; charset=utf-8",
                JSON.stringify(getClientConfig())
            );
            return;
        }

        var asset = assets[assetName];
        if (!asset) {
            send(res, 404, "text/plain; charset=utf-8", "Not found");
            return;
        }

        fs.readFile(asset.path, function (error, data) {
            if (error) {
                send(res, 404, "text/plain; charset=utf-8", "Not found");
                return;
            }
            send(res, 200, asset.type, data);
        });
    };
}

function createAuditLogger(parent, pluginName, source) {
    return function (user, target) {
        try {
            var candidates = [parent && parent.parent, parent && parent.parent && parent.parent.parent, parent && parent.parent && parent.parent.webserver];
            var username = String(user && (user.realname || user.name || user._id) || "unknown");
            var message = String(pluginName || "plugin") + " click: " + String(target || "unknown").slice(0, 160);
            for (var index = 0; index < candidates.length; index++) if (candidates[index] && typeof candidates[index].DispatchEvent === "function") { candidates[index].DispatchEvent(["*", "server-users"], source || parent, { etype: "user", action: "pluginclick", userid: user && user._id, username: username, msg: message }); return; }
        } catch (error) { }
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

module.exports = {
    createAssetHandler: createAssetHandler,
    readJson: readJson,
    createCredentialStore: createCredentialStore
    ,createAuditLogger: createAuditLogger,
    ensureApprovalBus: ensureApprovalBus
};
