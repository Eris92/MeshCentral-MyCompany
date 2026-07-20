"use strict";

var http = require("http");
var https = require("https");
var path = require("path");
var core = require("./core.js");
var extendOriginal = require("./extensions.js").extendModule;

function clean(value, limit) { return String(value == null ? "" : value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").slice(0, limit || 1000); }
function bool(value) { return value === true || /^(1|true|yes|tak)$/i.test(String(value || "")); }

module.exports.extendModule = function (base, config, parent, source) {
    base = extendOriginal(base, config, parent, source);
    var root = path.join(parent.pluginPath, "myscripts");
    var store = core.createProtectedJsonStore(parent.fs, parent.path, path.join(root, "data", "zabbix.json"));

    function siteAdmin(user) { return core.isSiteAdmin(user); }
    function publicSettings(user) {
        if (!siteAdmin(user)) throw new Error("Only Site Admin can manage Zabbix settings.");
        var value = store.read();
        return { url: String(value.url || ""), tokenConfigured: !!value.token, token: "", verifyTls: value.verifyTls !== false };
    }
    function saveSettings(user, payload) {
        if (!siteAdmin(user)) throw new Error("Only Site Admin can manage Zabbix settings.");
        payload = payload && typeof payload === "object" ? payload : {};
        var current = store.read(), next = {
            url: clean(Object.prototype.hasOwnProperty.call(payload, "url") ? payload.url : current.url, 1000).replace(/\/+$/, ""),
            token: clean(payload.token || current.token, 8000),
            verifyTls: Object.prototype.hasOwnProperty.call(payload, "verifyTls") ? bool(payload.verifyTls) : current.verifyTls !== false
        };
        if (!/^https?:\/\//i.test(next.url)) throw new Error("Enter a valid Zabbix URL.");
        if (!next.token) throw new Error("Zabbix API token is required.");
        store.save(next);
        return publicSettings(user);
    }
    function call(method, params, authenticationRequired) {
        var settings = store.read();
        if (!settings.url || (authenticationRequired !== false && !settings.token)) return Promise.reject(new Error("Configure Zabbix API settings first."));
        var endpoint = new URL(settings.url.replace(/\/+$/, "") + "/api_jsonrpc.php"), body = JSON.stringify({ jsonrpc: "2.0", method: method, params: params || {}, id: Date.now() });
        var transport = endpoint.protocol === "https:" ? https : http;
        var headers = { "Content-Type": "application/json-rpc", "Content-Length": Buffer.byteLength(body) };
        if (authenticationRequired !== false) headers.Authorization = "Bearer " + settings.token;
        return new Promise(function (resolve, reject) {
            var request = transport.request({ protocol: endpoint.protocol, hostname: endpoint.hostname, port: endpoint.port || undefined, path: endpoint.pathname + endpoint.search, method: "POST", rejectUnauthorized: settings.verifyTls !== false, headers: headers }, function (response) {
                var chunks = [];
                response.on("data", function (chunk) { chunks.push(chunk); });
                response.on("end", function () {
                    var text = Buffer.concat(chunks).toString("utf8"), value = null;
                    try { value = JSON.parse(text); } catch (error) { reject(new Error("Zabbix returned invalid JSON.")); return; }
                    if (response.statusCode < 200 || response.statusCode >= 300) { reject(new Error(value && value.error && (value.error.data || value.error.message) || text || ("Zabbix HTTP " + response.statusCode))); return; }
                    if (value.error) { reject(new Error(value.error.data || value.error.message || "Zabbix API error.")); return; }
                    resolve(value.result);
                });
            });
            request.setTimeout(30000, function () { request.destroy(new Error("Zabbix API timeout.")); });
            request.on("error", reject);
            request.end(body);
        });
    }
    function list(user) {
        if (!siteAdmin(user)) return Promise.reject(new Error("Only Site Admin can manage Zabbix maintenance."));
        return call("maintenance.get", { output: "extend", selectHosts: ["hostid", "host", "name"], selectTimeperiods: "extend", sortfield: "name" });
    }
    function create(user, payload) {
        if (!siteAdmin(user)) return Promise.reject(new Error("Only Site Admin can manage Zabbix maintenance."));
        payload = payload && typeof payload === "object" ? payload : {};
        var now = Math.floor(Date.now() / 1000), from = Number(payload.activeSince) || now, till = Number(payload.activeTill) || (from + 3600), hostids = Array.isArray(payload.hostids) ? payload.hostids.map(String).filter(Boolean) : [];
        if (!hostids.length) return Promise.reject(new Error("Select at least one Zabbix host."));
        if (till <= from) return Promise.reject(new Error("Maintenance end must be later than its start."));
        return call("maintenance.create", {
            name: clean(payload.name || "SirK Portal maintenance", 128),
            active_since: from,
            active_till: till,
            hosts: hostids.map(function (hostid) { return { hostid: hostid }; }),
            timeperiods: [{ timeperiod_type: 0, start_date: from, period: Math.max(60, till - from) }],
            maintenance_type: Number(payload.maintenanceType) === 1 ? 1 : 0,
            description: clean(payload.description || "Created by SirK Portal / My Scripts", 2048)
        });
    }
    function remove(user, ids) {
        if (!siteAdmin(user)) return Promise.reject(new Error("Only Site Admin can manage Zabbix maintenance."));
        ids = Array.isArray(ids) ? ids.map(String).filter(Boolean) : [String(ids || "")].filter(Boolean);
        if (!ids.length) return Promise.reject(new Error("Select maintenance entries to delete."));
        return call("maintenance.delete", ids);
    }
    function test(user) {
        if (!siteAdmin(user)) return Promise.reject(new Error("Only Site Admin can test Zabbix settings."));
        return call("apiinfo.version", {}, false).then(function (version) { return { version: String(version || "") }; });
    }

    base.getZabbixSettings = publicSettings;
    base.saveZabbixSettings = saveSettings;
    base.listZabbixMaintenances = list;
    base.createZabbixMaintenance = create;
    base.deleteZabbixMaintenance = remove;
    base.testZabbixConnection = test;
    return base;
};
