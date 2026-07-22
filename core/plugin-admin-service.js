"use strict";

var shared = require("./shared.js");

module.exports.createPluginAdminService = function (options) {
    var pluginHandler = options.pluginHandler;
    var fs = options.fs;
    var path = options.path;
    var protectedShortName = String(options.protectedShortName || "MyCompany").toLowerCase();

    function requireAdmin(user) {
        if (!shared.isSiteAdmin(user)) throw new Error("Permission denied.");
    }

    function database() {
        return pluginHandler && pluginHandler.parent && pluginHandler.parent.db;
    }

    function clean(record) {
        return {
            id: String(record && record._id || ""),
            name: shared.cleanText(record && record.name || record && record.shortName || "Plugin", 200),
            shortName: shared.cleanText(record && record.shortName || "", 100),
            version: shared.cleanText(record && record.version || "", 50),
            description: shared.cleanText(record && record.description || "", 500),
            status: Number(record && record.status) === 1 ? 1 : 0,
            protected: String(record && record.shortName || "").toLowerCase() === protectedShortName,
            availableVersion: "",
            updateAvailable: false,
            updateCompatible: true,
            updateStatus: record && record.configUrl ? "unchecked" : "unavailable",
            updateError: ""
        };
    }

    function records() {
        return new Promise(function (resolve, reject) {
            var db = database();
            if (!db || typeof db.getPlugins !== "function") return reject(new Error("MeshCentral plugin database is unavailable."));
            db.getPlugins(function (error, values) {
                if (error) return reject(new Error("Could not read the MeshCentral plugin list."));
                resolve(Array.isArray(values) ? values : []);
            });
        });
    }

    function versionGreater(left, right) {
        if (pluginHandler && typeof pluginHandler.versionGreater === "function") return pluginHandler.versionGreater(left, right);
        var a = String(left || "0").replace(/^v/i, "").split("-")[0].split(".").map(Number);
        var b = String(right || "0").replace(/^v/i, "").split("-")[0].split(".").map(Number);
        for (var i = 0; i < Math.max(a.length, b.length); i++) {
            var av = Number(a[i]) || 0, bv = Number(b[i]) || 0;
            if (av > bv) return true;
            if (av < bv) return false;
        }
        return false;
    }

    function compatible(remote) {
        if (!remote || !remote.meshCentralCompat) return true;
        if (!pluginHandler || typeof pluginHandler.versionCompare !== "function") return true;
        var current = pluginHandler.parent && pluginHandler.parent.currentVer;
        return !current || pluginHandler.versionCompare(current, remote.meshCentralCompat);
    }

    function httpsUrl(value, label) {
        var parsed;
        try { parsed = new URL(String(value || "")); }
        catch (error) { throw new Error(label + " is invalid."); }
        if (parsed.protocol !== "https:" || parsed.username || parsed.password) throw new Error(label + " must be an HTTPS URL without credentials.");
        return parsed.href;
    }

    function remoteConfig(record) {
        if (!record || !record.configUrl) return Promise.reject(new Error("Plugin does not define configUrl."));
        if (!pluginHandler || typeof pluginHandler.getPluginConfig !== "function") return Promise.reject(new Error("MeshCentral update discovery is unavailable."));
        var configUrl;
        try { configUrl = httpsUrl(record.configUrl, "Plugin config URL"); }
        catch (error) { return Promise.reject(error); }
        return Promise.race([
            Promise.resolve(pluginHandler.getPluginConfig(configUrl)),
            new Promise(function (_, reject) {
                setTimeout(function () { reject(new Error("Update check timed out.")); }, 15000);
            })
        ]).then(function (remote) {
            if (!remote || typeof remote !== "object") throw new Error("Remote plugin configuration is invalid.");
            if (String(remote.shortName || "").toLowerCase() !== String(record.shortName || "").toLowerCase()) throw new Error("Remote plugin shortName does not match the installed plugin.");
            remote.downloadUrl = httpsUrl(remote.downloadUrl, "Plugin download URL");
            return remote;
        });
    }

    function enrich(record) {
        var value = clean(record);
        if (!record || !record.configUrl) return Promise.resolve(value);
        return remoteConfig(record).then(function (remote) {
            value.availableVersion = shared.cleanText(remote.version || "", 50);
            value.updateAvailable = versionGreater(remote.version, record.version);
            value.updateCompatible = compatible(remote);
            value.updateStatus = value.updateAvailable ? (value.updateCompatible ? "available" : "incompatible") : "current";
            return value;
        }).catch(function (error) {
            value.updateStatus = "error";
            value.updateError = shared.cleanText(error && error.message || error, 300);
            return value;
        });
    }

    function list(user) {
        requireAdmin(user);
        return records().then(function (values) {
            return Promise.all(values.map(enrich));
        }).then(function (values) {
            return values.sort(function (a, b) { return a.name.localeCompare(b.name, "pl", { sensitivity: "base" }); });
        });
    }

    function record(id) {
        return new Promise(function (resolve, reject) {
            var db = database();
            if (!db || typeof db.getPlugin !== "function") return reject(new Error("MeshCentral plugin database is unavailable."));
            db.getPlugin(id, function (error, values) {
                if (error || !Array.isArray(values) || values.length !== 1) return reject(new Error("Plugin was not found."));
                resolve(values[0]);
            });
        });
    }

    function callbackCall(method, args) {
        return new Promise(function (resolve, reject) {
            if (!pluginHandler || typeof pluginHandler[method] !== "function") return reject(new Error("MeshCentral does not support this plugin operation."));
            pluginHandler[method].apply(pluginHandler, args.concat(function (error) {
                if (error) return reject(new Error(typeof error === "string" ? error : (error.message || "Plugin operation failed.")));
                resolve();
            }));
        });
    }

    function backupPlugin(plugin, suffix) {
        var source = path.resolve(pluginHandler.pluginPath, String(plugin.shortName || ""));
        var pluginRoot = path.resolve(pluginHandler.pluginPath);
        if (source.toLowerCase().indexOf((pluginRoot + path.sep).toLowerCase()) !== 0 || !fs.existsSync(source)) return null;
        var stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 17);
        var backupRoot = path.join(path.dirname(pluginRoot), "plugin-backups");
        var target = path.join(backupRoot, String(plugin.shortName).replace(/[^a-z0-9._-]/gi, "_") + "-" + suffix + "-" + stamp);
        fs.mkdirSync(backupRoot, { recursive: true });
        fs.cpSync(source, target, { recursive: true, errorOnExist: true });
        return target;
    }

    function operate(user, action, payload) {
        requireAdmin(user);
        action = String(action || "").toLowerCase();
        payload = payload || {};

        if (action === "add") {
            var configUrl = String(payload.configUrl || "").trim();
            if (configUrl.length > 2048) return Promise.reject(new Error("Plugin URL is too long."));
            try { configUrl = httpsUrl(configUrl, "Plugin config URL"); }
            catch (error) { return Promise.reject(error); }
            if (!pluginHandler || typeof pluginHandler.getPluginConfig !== "function" || typeof pluginHandler.addPlugin !== "function") return Promise.reject(new Error("MeshCentral plugin installation is unavailable."));
            return pluginHandler.getPluginConfig(configUrl).then(function (config) {
                if (!config || typeof config !== "object") throw new Error("Plugin configuration is invalid.");
                config.configUrl = configUrl;
                return pluginHandler.addPlugin(config);
            }).then(function () { return { changed: true, restartRequired: false }; });
        }

        var id = String(payload.id || "");
        if (!id || id.length > 250 || !/^[a-z0-9_./:-]+$/i.test(id)) return Promise.reject(new Error("Invalid plugin identifier."));
        return record(id).then(function (plugin) {
            var isProtected = String(plugin.shortName || "").toLowerCase() === protectedShortName;
            if (action === "update") {
                return remoteConfig(plugin).then(function (remote) {
                    if (!versionGreater(remote.version, plugin.version)) return { changed: false, restartRequired: false, version: plugin.version };
                    if (!compatible(remote)) throw new Error("The update is not compatible with the current MeshCentral version.");
                    var backupPath = backupPlugin(plugin, "before-update-" + String(plugin.version || "unknown").replace(/[^a-z0-9._-]/gi, "_"));
                    return callbackCall("installPlugin", [id, { name: remote.version, url: remote.downloadUrl }, null]).then(function () {
                        return { changed: true, restartRequired: false, version: remote.version, backupPath: backupPath };
                    });
                });
            }
            if (isProtected) throw new Error("MyCompany cannot disable or remove itself from its own administration panel.");
            if (action === "enable") return callbackCall("installPlugin", [id, false, null]).then(function () { return { changed: true, restartRequired: false }; });
            if (action === "disable") return callbackCall("disablePlugin", [id]).then(function () { return { changed: true, restartRequired: false }; });
            if (action === "remove") {
                var backupPath = backupPlugin(plugin, "removed");
                return callbackCall("removePlugin", [id]).then(function () { return { changed: true, restartRequired: false, backupPath: backupPath }; });
            }
            throw new Error("Unknown plugin operation.");
        });
    }

    return { list: list, operate: operate };
};
