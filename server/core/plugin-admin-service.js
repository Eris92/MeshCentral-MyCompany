"use strict";

var shared = require("./shared.js");

module.exports.createPluginAdminService = function (options) {
    var pluginHandler = options.pluginHandler;
    var fs = options.fs;
    var path = options.path;
    var protectedShortName = String(options.protectedShortName || "SirkPlatform").toLowerCase();

    function requireAdmin(user) {
        if (!shared.isSiteAdmin(user)) throw new Error("Permission denied.");
    }

    function database() {
        return pluginHandler && pluginHandler.parent && pluginHandler.parent.db;
    }

    function pluginRoot() { return path.resolve(pluginHandler.pluginPath); }
    function backupRoot() { return path.join(path.dirname(pluginRoot()), "plugin-backups"); }
    function safeName(value) { return String(value || "").replace(/[^a-z0-9._-]/gi, "_"); }

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
            updateError: "",
            backupCount: 0
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
            new Promise(function (_, reject) { setTimeout(function () { reject(new Error("Update check timed out.")); }, 15000); })
        ]).then(function (remote) {
            if (!remote || typeof remote !== "object") throw new Error("Remote plugin configuration is invalid.");
            if (String(remote.shortName || "").toLowerCase() !== String(record.shortName || "").toLowerCase()) throw new Error("Remote plugin shortName does not match the installed plugin.");
            remote.downloadUrl = httpsUrl(remote.downloadUrl, "Plugin download URL");
            return remote;
        });
    }

    function backupDirectories(plugin) {
        var root = backupRoot();
        var prefix = safeName(plugin.shortName) + "-";
        if (!fs.existsSync(root)) return [];
        return fs.readdirSync(root, { withFileTypes: true }).filter(function (entry) {
            return entry.isDirectory() && entry.name.indexOf(prefix) === 0;
        }).map(function (entry) {
            var full = path.resolve(root, entry.name);
            if (full.indexOf(path.resolve(root) + path.sep) !== 0) return null;
            var configPath = path.join(full, "config.json");
            try {
                var config = JSON.parse(fs.readFileSync(configPath, "utf8").replace(/^\uFEFF/, ""));
                if (String(config.shortName || "").toLowerCase() !== String(plugin.shortName || "").toLowerCase()) return null;
                var stat = fs.statSync(full);
                return {
                    id: entry.name,
                    version: shared.cleanText(config.version || "unknown", 50),
                    createdAt: stat.mtime.toISOString(),
                    reason: entry.name.indexOf("before-update-") >= 0 ? "before-update" : entry.name.indexOf("before-rollback-") >= 0 ? "before-rollback" : entry.name.indexOf("removed-") >= 0 ? "removed" : "manual"
                };
            } catch (error) { return null; }
        }).filter(Boolean).sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); });
    }

    function enrich(record) {
        var value = clean(record);
        value.backupCount = backupDirectories(record).length;
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
        return records().then(function (values) { return Promise.all(values.map(enrich)); }).then(function (values) {
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
        var source = path.resolve(pluginRoot(), String(plugin.shortName || ""));
        var root = pluginRoot();
        if (source.toLowerCase().indexOf((root + path.sep).toLowerCase()) !== 0 || !fs.existsSync(source)) return null;
        var stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 17);
        var backups = backupRoot();
        var target = path.join(backups, safeName(plugin.shortName) + "-" + suffix + "-" + stamp);
        fs.mkdirSync(backups, { recursive: true });
        fs.cpSync(source, target, { recursive: true, errorOnExist: true });
        return target;
    }

    function updateDatabasePlugin(id, config, status) {
        return new Promise(function (resolve, reject) {
            var db = database();
            if (!db || typeof db.updatePlugin !== "function") return reject(new Error("MeshCentral plugin database update is unavailable."));
            var value = Object.assign({}, config, { status: Number(status) === 1 ? 1 : 0 });
            db.updatePlugin(id, value, function (error) { if (error) reject(error); else resolve(); });
        });
    }

    function listBackups(user, id) {
        requireAdmin(user);
        return record(id).then(function (plugin) {
            return { plugin: clean(plugin), backups: backupDirectories(plugin) };
        });
    }

    function restoreBackup(plugin, backupId) {
        backupId = String(backupId || "");
        if (!/^[a-z0-9._-]+$/i.test(backupId)) return Promise.reject(new Error("Invalid backup identifier."));
        var expectedPrefix = safeName(plugin.shortName) + "-";
        if (backupId.indexOf(expectedPrefix) !== 0) return Promise.reject(new Error("Backup does not belong to this plugin."));
        var backups = path.resolve(backupRoot());
        var source = path.resolve(backups, backupId);
        if (source.indexOf(backups + path.sep) !== 0 || !fs.existsSync(source)) return Promise.reject(new Error("Backup was not found."));
        var config;
        try {
            config = JSON.parse(fs.readFileSync(path.join(source, "config.json"), "utf8").replace(/^\uFEFF/, ""));
        } catch (error) { return Promise.reject(new Error("Backup config.json is invalid.")); }
        if (String(config.shortName || "").toLowerCase() !== String(plugin.shortName || "").toLowerCase()) return Promise.reject(new Error("Backup plugin identity does not match."));

        var root = pluginRoot();
        var target = path.resolve(root, String(plugin.shortName || ""));
        if (target.indexOf(root + path.sep) !== 0) return Promise.reject(new Error("Invalid plugin target path."));
        var safetyBackup = backupPlugin(plugin, "before-rollback-" + safeName(plugin.version || "unknown"));
        var token = Date.now() + "-" + Math.random().toString(16).slice(2);
        var stage = path.join(root, "_restore-" + safeName(plugin.shortName) + "-" + token);
        var old = path.join(root, "_previous-" + safeName(plugin.shortName) + "-" + token);
        try {
            fs.cpSync(source, stage, { recursive: true, errorOnExist: true });
            if (fs.existsSync(target)) fs.renameSync(target, old);
            fs.renameSync(stage, target);
            if (fs.existsSync(old)) fs.rmSync(old, { recursive: true, force: true });
        } catch (error) {
            try { if (fs.existsSync(stage)) fs.rmSync(stage, { recursive: true, force: true }); } catch (ignored) {}
            try { if (!fs.existsSync(target) && fs.existsSync(old)) fs.renameSync(old, target); } catch (ignored2) {}
            return Promise.reject(new Error("Rollback file swap failed: " + (error.message || error)));
        }
        return updateDatabasePlugin(plugin._id, config, plugin.status).then(function () {
            return { changed: true, restartRequired: true, version: config.version, backupPath: safetyBackup };
        });
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
                    var backupPath = backupPlugin(plugin, "before-update-" + safeName(plugin.version || "unknown"));
                    return callbackCall("installPlugin", [id, { name: remote.version, url: remote.downloadUrl }, null]).then(function () {
                        return { changed: true, restartRequired: false, version: remote.version, backupPath: backupPath };
                    });
                });
            }
            if (action === "rollback") return restoreBackup(plugin, payload.backupId);
            if (isProtected) throw new Error("SirkPlatform cannot disable or remove itself from its own administration panel.");
            if (action === "enable") return callbackCall("installPlugin", [id, false, null]).then(function () { return { changed: true, restartRequired: false }; });
            if (action === "disable") return callbackCall("disablePlugin", [id]).then(function () { return { changed: true, restartRequired: false }; });
            if (action === "remove") {
                var backupPath = backupPlugin(plugin, "removed");
                return callbackCall("removePlugin", [id]).then(function () { return { changed: true, restartRequired: false, backupPath: backupPath }; });
            }
            throw new Error("Unknown plugin operation.");
        });
    }

    return { list: list, listBackups: listBackups, operate: operate };
};