"use strict";

var assert = require("assert");
var fs = require("fs");
var http = require("http");
var os = require("os");
var path = require("path");
var httpClient = require("../server/core/http-client.js");
var secretStore = require("../server/core/secret-store.js");
var approvalService = require("../server/core/approval-service.js");
var sessionPersistence = require("../server/core/session-persistence.js");
var pluginAdminService = require("../server/core/plugin-admin-service.js");

function listen(server) {
    return new Promise(function (resolve, reject) {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", function () { resolve(server.address().port); });
    });
}

function close(server) {
    return new Promise(function (resolve) { server.close(resolve); });
}

async function validateRedirectHeaders() {
    var received = null;
    var target = http.createServer(function (req, res) {
        received = req.headers;
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end("{\"ok\":true}");
    });
    var targetPort = await listen(target);
    var source = http.createServer(function (req, res) {
        res.writeHead(302, { Location: "http://127.0.0.1:" + targetPort + "/target" });
        res.end();
    });
    var sourcePort = await listen(source);
    try {
        await httpClient.requestJson({
            url: "http://127.0.0.1:" + sourcePort + "/start",
            headers: { Authorization: "Bearer secret", Cookie: "sid=secret", "X-Test": "kept" }
        });
        assert.strictEqual(received.authorization, undefined);
        assert.strictEqual(received.cookie, undefined);
        assert.strictEqual(received["x-test"], "kept");
    } finally {
        await close(source);
        await close(target);
    }
}

function validateSecretCorruption() {
    var directory = fs.mkdtempSync(path.join(os.tmpdir(), "sirkPlatform-secrets-"));
    var dataPath = path.join(directory, "secrets.json");
    var keyPath = path.join(directory, ".secret.key");
    try {
        var store = secretStore.createSecretStore({ fs: fs, path: path, dataPath: dataPath, keyPath: keyPath });
        store.set("jira", { token: "secret" });
        var encrypted = JSON.parse(fs.readFileSync(dataPath, "utf8"));
        encrypted.tag = Buffer.alloc(16, 1).toString("base64");
        fs.writeFileSync(dataPath, JSON.stringify(encrypted));
        var reopened = secretStore.createSecretStore({ fs: fs, path: path, dataPath: dataPath, keyPath: keyPath });
        assert.throws(function () { reopened.readAll(); }, /Cannot read SirkPlatform secret store/);
        assert.strictEqual(JSON.parse(fs.readFileSync(dataPath, "utf8")).tag, encrypted.tag);
    } finally {
        fs.rmSync(directory, { recursive: true, force: true });
    }
}

async function validateApprovalApiSafety() {
    var directory = fs.mkdtempSync(path.join(os.tmpdir(), "sirkPlatform-approval-"));
    var admin = { _id: "user/domain/admin", name: "admin", siteadmin: 0xFFFFFFFF };
    var users = {}; users[admin._id] = admin;
    var current = { modules: { approvalcenter: { providers: { sample: { enabled: true, levels: { 1: [], 2: [], 3: [] } } } } } };
    var settings = {
        read: function () { return current; },
        isModuleEnabled: function () { return true; },
        update: function (work) { current = work(current); return Promise.resolve(current); }
    };
    var service = approvalService.createApprovalService({
        fs: fs,
        path: path,
        parent: { parent: { webserver: { users: users } } },
        settings: settings,
        databasePath: path.join(directory, "requests.json")
    });
    var executions = 0;
    service.registerProvider({
        type: "sample",
        title: "Sample",
        approvalLevels: [1],
        canSubmit: function () { return true; },
        getResources: function () { return { values: ["safe"] }; },
        execute: function () { executions++; return { message: "done" }; }
    });
    try {
        var created = service.createApiToken(admin, {
            name: "test",
            scopes: ["providers:read", "requests:read", "requests:write", "requests:decide"],
            providers: ["sample"]
        });
        var first = await service.submitExternal(created.token, "sample", { value: 1 }, "API", "same-submit-key");
        assert.deepStrictEqual(await service.getProviderResources("sample", admin, {}), { values: ["safe"] });
        var retry = await service.submitExternal(created.token, "sample", { value: 2 }, "API", "same-submit-key");
        assert.strictEqual(retry.id, first.id);
        assert.strictEqual(JSON.parse(fs.readFileSync(path.join(directory, "requests.json"), "utf8")).requests.length, 1);
        await service.decideExternal(created.token, first.id, "approve", "approved", "same-decision-key");
        await service.decideExternal(created.token, first.id, "approve", "approved", "same-decision-key");
        assert.strictEqual(executions, 1);
        await assert.rejects(async function () {
            return service.decideExternal(created.token, first.id, "invalid", "", "different-key");
        }, /Invalid decision/);
        delete users[admin._id];
        assert.throws(function () { service.externalContext(created.token, "requests:read"); }, /owner no longer exists/);
    } finally {
        fs.rmSync(directory, { recursive: true, force: true });
    }
}

function validateSessionPersistence() {
    var directory = fs.mkdtempSync(path.join(os.tmpdir(), "sirkPlatform-session-"));
    var configPath = path.join(directory, "config.json");
    fs.writeFileSync(configPath, JSON.stringify({ settings: {}, domains: { "": {} } }), "utf8");
    var manager = sessionPersistence.createManager({
        fs: fs,
        nativePath: path,
        parent: { parent: { datapath: directory } }
    });
    try {
        var enabled = manager.configure(true, {});
        var stored = JSON.parse(fs.readFileSync(configPath, "utf8"));
        assert.strictEqual(enabled.enabled, true);
        assert.strictEqual(enabled.managedBySirkPlatform, true);
        assert.strictEqual(enabled.restartRequired, true);
        assert.match(stored.settings.SessionKey, /^[0-9a-f]{128}$/);
        assert.strictEqual(JSON.stringify(enabled).indexOf(stored.settings.SessionKey), -1);
        var portal = { sessionKeyManaged: true, sessionKeyHash: enabled.sessionKeyHash };
        assert.strictEqual(manager.status(portal).managedBySirkPlatform, true);
        var disabled = manager.configure(false, portal);
        assert.strictEqual(disabled.enabled, false);
        assert.strictEqual(Object.prototype.hasOwnProperty.call(JSON.parse(fs.readFileSync(configPath, "utf8")).settings, "SessionKey"), false);
        assert.ok(fs.readdirSync(path.join(directory, "config-backups")).length >= 2);
    } finally {
        fs.rmSync(directory, { recursive: true, force: true });
    }
}

async function validatePluginAdministrationSafety() {
    var directory = fs.mkdtempSync(path.join(os.tmpdir(), "sirkPlatform-plugin-admin-"));
    var pluginRoot = path.join(directory, "plugins");
    var externalRoot = path.join(pluginRoot, "External");
    fs.mkdirSync(externalRoot, { recursive: true });
    fs.writeFileSync(path.join(externalRoot, "config.json"), "{}", "utf8");
    var records = {
        "plugin/sirkPlatform": { _id: "plugin/sirkPlatform", shortName: "SirkPlatform", name: "SirkPlatform", status: 1 },
        "plugin/external": { _id: "plugin/external", shortName: "External", name: "External", status: 1 }
    };
    var removed = false;
    var handler = {
        pluginPath: pluginRoot,
        parent: {
            db: {
                getPlugins: function (callback) { callback(null, Object.keys(records).map(function (id) { return records[id]; })); },
                getPlugin: function (id, callback) { callback(null, records[id] ? [records[id]] : []); }
            }
        },
        disablePlugin: function (id, callback) { records[id].status = 0; callback(null); },
        removePlugin: function (id, callback) { removed = true; delete records[id]; callback(null); }
    };
    var service = pluginAdminService.createPluginAdminService({
        pluginHandler: handler,
        fs: fs,
        path: path,
        protectedShortName: "SirkPlatform"
    });
    var admin = { siteadmin: 0xFFFFFFFF };
    try {
        await assert.rejects(function () {
            return service.operate(admin, "disable", { id: "plugin/sirkPlatform" });
        }, /cannot disable or remove itself/);
        await assert.rejects(function () {
            return service.operate(admin, "add", { configUrl: "http://example.test/config.json" });
        }, /HTTPS URL without credentials/);
        var result = await service.operate(admin, "remove", { id: "plugin/external" });
        assert.strictEqual(removed, true);
        assert.ok(result.backupPath);
        assert.strictEqual(fs.existsSync(path.join(result.backupPath, "config.json")), true);
        assert.throws(function () { service.list({ siteadmin: 0 }); }, /Permission denied/);
    } finally {
        fs.rmSync(directory, { recursive: true, force: true });
    }
}

Promise.resolve()
    .then(validateRedirectHeaders)
    .then(validateSecretCorruption)
    .then(validateApprovalApiSafety)
    .then(validateSessionPersistence)
    .then(validatePluginAdministrationSafety)
    .then(function () { console.log("Security regression tests: OK"); })
    .catch(function (error) {
        console.error(error && error.stack || error);
        process.exit(1);
    });
