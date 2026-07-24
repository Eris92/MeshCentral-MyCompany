"use strict";

var crypto = require("crypto");

function keyValue(settings) {
    if (!settings || typeof settings !== "object") return null;
    if (settings.SessionKey != null) return settings.SessionKey;
    if (settings.sessionKey != null) return settings.sessionKey;
    if (settings.sessionkey != null) return settings.sessionkey;
    return null;
}

function validKey(value) {
    if (typeof value === "string") return value.length >= 32;
    return Array.isArray(value) && value.length > 0 && value.every(function (item) {
        return typeof item === "string" && item.length >= 32;
    });
}

function keyHash(value) {
    return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function timestamp() {
    return new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 17);
}

module.exports.createManager = function (context) {
    var fs = context.fs;
    var path = context.nativePath;
    var meshServer = context.parent && context.parent.parent;
    var dataPath = meshServer && meshServer.datapath;
    var configPath = dataPath && path.join(dataPath, "config.json");

    function readConfig() {
        if (!configPath || !fs.existsSync(configPath)) throw new Error("MeshCentral config.json was not found.");
        var value = JSON.parse(fs.readFileSync(configPath, "utf8").replace(/^\uFEFF/, ""));
        value.settings = value.settings && typeof value.settings === "object" ? value.settings : {};
        return value;
    }

    function status(portal) {
        var config = readConfig();
        var value = keyValue(config.settings);
        var managed = portal && portal.sessionKeyManaged === true &&
            typeof portal.sessionKeyHash === "string" && portal.sessionKeyHash === keyHash(value);
        return {
            enabled: validKey(value),
            managedBySirkPlatform: managed,
            managedExternally: validKey(value) && !managed,
            restartRequired: false
        };
    }

    function nextBackupPath(backupRoot) {
        var baseName = "config-before-session-persistence-" + timestamp();
        var candidate = path.join(backupRoot, baseName + ".json");
        var suffix = 0;
        while (fs.existsSync(candidate)) {
            suffix += 1;
            candidate = path.join(backupRoot, baseName + "-" + suffix + ".json");
        }
        return candidate;
    }

    function writeConfig(config) {
        var backupRoot = path.join(dataPath, "config-backups");
        if (!fs.existsSync(backupRoot)) fs.mkdirSync(backupRoot, { recursive: true });
        var backupPath = nextBackupPath(backupRoot);
        var temporaryPath = configPath + ".sirk-platform-session-" + process.pid + "-" +
            crypto.randomBytes(6).toString("hex") + ".tmp";
        fs.copyFileSync(configPath, backupPath, fs.constants.COPYFILE_EXCL);
        fs.writeFileSync(temporaryPath, JSON.stringify(config, null, 2), { encoding: "utf8", flag: "wx" });
        try {
            fs.renameSync(temporaryPath, configPath);
        } catch (error) {
            try { if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath); } catch (ignored) {}
            throw error;
        }
        return backupPath;
    }

    function configure(enabled, portal) {
        var config = readConfig();
        var current = keyValue(config.settings);
        var currentValid = validKey(current);
        var currentHash = keyHash(current);
        var owned = portal && portal.sessionKeyManaged === true && portal.sessionKeyHash === currentHash;
        var changed = false;
        var backupPath = "";

        if (enabled === true && !currentValid) {
            current = crypto.randomBytes(64).toString("hex");
            delete config.settings.sessionKey;
            delete config.settings.sessionkey;
            config.settings.SessionKey = current;
            backupPath = writeConfig(config);
            changed = true;
            owned = true;
        } else if (enabled !== true && currentValid && owned) {
            delete config.settings.SessionKey;
            delete config.settings.sessionKey;
            delete config.settings.sessionkey;
            backupPath = writeConfig(config);
            changed = true;
            current = null;
            owned = false;
        }

        return {
            enabled: validKey(current),
            managedBySirkPlatform: validKey(current) && owned,
            managedExternally: validKey(current) && !owned,
            changed: changed,
            restartRequired: changed,
            backupCreated: !!backupPath,
            sessionKeyHash: validKey(current) && owned ? keyHash(current) : ""
        };
    }

    return { status: status, configure: configure };
};
