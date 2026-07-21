"use strict";
var crypto = require("crypto");
var shared = require("./shared.js");

module.exports.createSecretStore = function (options) {
    var fs = options.fs, path = options.path, dataPath = options.dataPath, keyPath = options.keyPath, cache = null;
    function key() {
        fs.mkdirSync(path.dirname(keyPath), { recursive: true });
        if (!fs.existsSync(keyPath)) fs.writeFileSync(keyPath, crypto.randomBytes(32), { mode: 0o600 });
        var value = fs.readFileSync(keyPath);
        if (value.length !== 32) throw new Error("Invalid MyCompany secret key.");
        return value;
    }
    function encrypt(value) {
        var iv = crypto.randomBytes(12), cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
        var data = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
        return { version: 1, iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), data: data.toString("base64") };
    }
    function decrypt(value) {
        if (!value || value.version !== 1) return {};
        var decipher = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(value.iv, "base64"));
        decipher.setAuthTag(Buffer.from(value.tag, "base64"));
        return JSON.parse(Buffer.concat([decipher.update(Buffer.from(value.data, "base64")), decipher.final()]).toString("utf8"));
    }
    function readAll() {
        if (cache) return shared.copy(cache);
        try { cache = decrypt(shared.readJson(fs, dataPath, {})); } catch (error) { cache = {}; }
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
