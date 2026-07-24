"use strict";

var rollbackFactory = require("./plugin-admin-service-rollback.js");

module.exports.createPluginAdminService = function (options) {
    var base = rollbackFactory.createPluginAdminService(options);
    var fs = options.fs;
    var path = options.path;
    var pluginHandler = options.pluginHandler;

    function safeName(value) { return String(value || "").replace(/[^a-z0-9._-]/gi, "_"); }
    function pluginRoot() { return path.resolve(pluginHandler.pluginPath); }
    function primaryRoot() { return path.join(path.dirname(pluginRoot()), "plugin-backups"); }

    function candidateRoots() {
        var root = pluginRoot();
        var values = [
            primaryRoot(),
            path.join(root, "plugin-backups"),
            path.join(path.dirname(path.dirname(root)), "plugin-backups"),
            path.join(path.dirname(root), "plugins-backup"),
            path.join(path.dirname(root), "plugin-backup")
        ];
        var seen = Object.create(null);
        return values.map(function (value) { return path.resolve(value); }).filter(function (value) {
            var key = process.platform === "win32" ? value.toLowerCase() : value;
            if (seen[key]) return false;
            seen[key] = true;
            return true;
        });
    }

    function readConfig(directory, shortName) {
        var candidates = [
            directory,
            path.join(directory, String(shortName || "")),
            path.join(directory, safeName(shortName))
        ];
        try {
            fs.readdirSync(directory, { withFileTypes: true }).filter(function (entry) { return entry.isDirectory(); }).slice(0, 10).forEach(function (entry) {
                candidates.push(path.join(directory, entry.name));
            });
        } catch (ignored) {}

        for (var i = 0; i < candidates.length; i++) {
            var configPath = path.join(candidates[i], "config.json");
            if (!fs.existsSync(configPath)) continue;
            try {
                var config = JSON.parse(fs.readFileSync(configPath, "utf8").replace(/^\uFEFF/, ""));
                if (String(config.shortName || "").toLowerCase() === String(shortName || "").toLowerCase()) {
                    return { directory: candidates[i], config: config };
                }
            } catch (ignored2) {}
        }
        return null;
    }

    function discovered(plugin) {
        var prefix = (safeName(plugin.shortName) + "-").toLowerCase();
        var result = [];
        candidateRoots().forEach(function (root) {
            if (!fs.existsSync(root)) return;
            var entries;
            try { entries = fs.readdirSync(root, { withFileTypes: true }); }
            catch (error) { return; }
            entries.forEach(function (entry) {
                if (!entry.isDirectory() || entry.name.toLowerCase().indexOf(prefix) !== 0) return;
                var container = path.resolve(root, entry.name);
                if (container.indexOf(path.resolve(root) + path.sep) !== 0) return;
                var found = readConfig(container, plugin.shortName);
                if (!found) return;
                result.push({ id: entry.name, container: container, source: found.directory, config: found.config });
            });
        });
        return result;
    }

    function normalize(plugin) {
        var primary = path.resolve(primaryRoot());
        fs.mkdirSync(primary, { recursive: true });
        discovered(plugin).forEach(function (backup) {
            var alreadyDirect = path.resolve(backup.container) === path.resolve(backup.source);
            var alreadyPrimary = path.dirname(path.resolve(backup.container)) === primary;
            if (alreadyPrimary && alreadyDirect) return;

            var targetName = backup.id + (alreadyPrimary ? "-normalized" : "");
            var target = path.join(primary, targetName);
            if (fs.existsSync(target)) return;
            fs.cpSync(backup.source, target, { recursive: true, errorOnExist: true });
        });
    }

    function normalizeAll(user) {
        return base.list(user).then(function (plugins) {
            plugins.forEach(function (plugin) { normalize(plugin); });
            return plugins;
        });
    }

    return {
        list: function (user) {
            return normalizeAll(user).then(function () { return base.list(user); });
        },
        listBackups: function (user, id) {
            return base.list(user).then(function (plugins) {
                var plugin = plugins.find(function (value) { return String(value.id) === String(id); });
                if (plugin) normalize(plugin);
                return base.listBackups(user, id);
            });
        },
        operate: function (user, action, payload) {
            action = String(action || "").toLowerCase();
            payload = payload || {};
            if (action === "rollback" || action === "backups") {
                return base.list(user).then(function (plugins) {
                    var plugin = plugins.find(function (value) { return String(value.id) === String(payload.id || ""); });
                    if (plugin) normalize(plugin);
                    return base.operate(user, action, payload);
                });
            }
            return base.operate(user, action, payload);
        }
    };
};
