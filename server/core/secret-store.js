"use strict";
var crypto = require("crypto");
var shared = require("./shared.js");

module.exports.createSecretStore = function (options) {
    var fs = options.fs, path = options.path, dataPath = options.dataPath, keyPath = options.keyPath, cache = null;
    function key() {
        fs.mkdirSync(path.dirname(keyPath), { recursive: true });
        if (!fs.existsSync(keyPath)) fs.writeFileSync(keyPath, crypto.randomBytes(32), { mode: 0o600 });
        var value = fs.readFileSync(keyPath);
        if (value.length !== 32) throw new Error("Invalid SirkPlatform secret key.");
        return value;
    }
    function encrypt(value) {
        var iv = crypto.randomBytes(12), cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
        var data = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
        return { version: 1, iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), data: data.toString("base64") };
    }
    function decrypt(value) {
        if (!value || value.version !== 1 || typeof value.iv !== "string" || typeof value.tag !== "string" || typeof value.data !== "string") {
            throw new Error("Invalid SirkPlatform encrypted secret store.");
        }
        var iv = Buffer.from(value.iv, "base64");
        var tag = Buffer.from(value.tag, "base64");
        var encrypted = Buffer.from(value.data, "base64");
        if (iv.length !== 12 || tag.length !== 16) throw new Error("Invalid SirkPlatform encrypted secret store.");
        var decipher = crypto.createDecipheriv("aes-256-gcm", key(), iv);
        decipher.setAuthTag(tag);
        var result = JSON.parse(Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8"));
        if (!result || typeof result !== "object" || Array.isArray(result)) throw new Error("Invalid SirkPlatform encrypted secret store.");
        return result;
    }
    function readAll() {
        if (cache) return shared.copy(cache);
        if (!fs.existsSync(dataPath)) cache = {};
        else {
            try {
                cache = decrypt(JSON.parse(fs.readFileSync(dataPath, "utf8").replace(/^\uFEFF/, "")));
            } catch (error) {
                throw new Error("Cannot read SirkPlatform secret store: " + String(error && error.message || error));
            }
        }
        return shared.copy(cache);
    }
    function writeAll(value) {
        cache = shared.copy(value || {});
        shared.writeJsonAtomic(fs, path, dataPath, encrypt(cache));
        return shared.copy(cache);
    }
    function get(namespace) {
        var value = readAll()[String(namespace || "")];
        return value && typeof value === "object" ? shared.copy(value) : {};
    }
    function set(namespace, value) {
        var all = readAll(); all[String(namespace || "")] = shared.copy(value || {}); writeAll(all); return get(namespace);
    }
    return { get: get, set: set, readAll: readAll, writeAll: writeAll };
};
