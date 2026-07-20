"use strict";

var childProcess = require("child_process");
var crypto = require("crypto");
var fs = require("fs");
var http = require("http");
var https = require("https");
var path = require("path");
var core = require("./core.js");

function clean(value, limit) { return String(value == null ? "" : value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").slice(0, limit || 1000); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function bool(value) { return value === true || /^(1|true|yes|tak)$/i.test(String(value || "")); }

module.exports.extendModule = function (base, config, parent, source) {
    var root = path.join(parent.pluginPath, "myscripts");
    var scriptsRoot = path.join(root, "scripts");
    var dataRoot = path.join(root, "data");
    var automationRoot = path.join(dataRoot, "automation");
    var automationStorePath = path.join(dataRoot, "automations.json");
    var zabbixStore = core.createProtectedJsonStore(fs, path, path.join(dataRoot, "zabbix.json"));
    var runnerPath = path.join(root, "automation-runner.ps1");

    function siteAdmin(user) { return core.isSiteAdmin(user); }
    function ensureData() { fs.mkdirSync(dataRoot, { recursive: true }); fs.mkdirSync(automationRoot, { recursive: true }); }
    function readJson(file, fallback) { try { return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "")); } catch (error) { return fallback; } }
    function writeJson(file, value) { ensureData(); var temporary = file + "." + process.pid + ".tmp"; fs.writeFileSync(temporary, JSON.stringify(value, null, 2), "utf8"); try { fs.renameSync(temporary, file); } catch (error) { fs.copyFileSync(temporary, file); fs.unlinkSync(temporary); } }
    function normalizeScriptPath(relativePath) {
        relativePath = String(relativePath || "").replace(/\\/g, "/");
        if (!relativePath || relativePath.indexOf("\0") >= 0 || relativePath.charAt(0) === "/" || relativePath.split("/").indexOf("..") >= 0) return null;
        var resolvedRoot = path.resolve(scriptsRoot), target = path.resolve(resolvedRoot, relativePath.replace(/\//g, path.sep));
        var prefix = resolvedRoot.endsWith(path.sep) ? resolvedRoot : resolvedRoot + path.sep;
        return target.toLowerCase().indexOf(prefix.toLowerCase()) === 0 ? target : null;
    }
    function readScriptText(scriptPath) {
        var target = normalizeScriptPath(scriptPath); if (!target) return null;
        var text; try { text = fs.readFileSync(target, "utf8").replace(/^\uFEFF/, ""); } catch (error) { return null; }
        var lines = text.split(/\r?\n/), header = [], bodyIndex = 0;
        for (; bodyIndex < lines.length; bodyIndex++) { var trimmed = String(lines[bodyIndex] || "").trim(); if (!trimmed) { header.push(lines[bodyIndex]); continue; } if (trimmed.charAt(0) !== "#") break; header.push(lines[bodyIndex]); }
        return { target: target, text: text, header: header, body: lines.slice(bodyIndex).join("\n") };
    }
    function parseDefinition(scriptPath) {
        var sourceData = readScriptText(scriptPath); if (!sourceData) return null;
        var definition = { label: path.basename(sourceData.target, path.extname(sourceData.target)), description: "", approvalLevels: [], variables: [], secretVariables: [], rawHeader: sourceData.header.join("\n") };
        sourceData.header.forEach(function (line) {
            var value = String(line || "").trim().replace(/^\s*#\s*/, ""), match;
            if (!value) return;
            if ((match = value.match(/^Approval(?:_([123]))?\s*:\s*(true|false)$/i))) { if (match[2].toLowerCase() === "true") definition.approvalLevels.push(Number(match[1] || 1)); return; }
            if ((match = value.match(/^(VariableSelectRequired|VariableSelect|VariableSwitchRequired|VariableSwitch|VariableUserRequired|VariableUser|VariableAssetRequired|VariableAsset|VariableRequired|Variable|SaveSecretRequired|SaveSecret)\s*:\s*(.+)$/i))) {
                var item = { directive: match[1], value: match[2] };
                if (/^SaveSecret/i.test(match[1])) definition.secretVariables.push(item); else definition.variables.push(item);
                return;
            }
            if (definition.label === path.basename(sourceData.target, path.extname(sourceData.target))) {
                var separator = value.indexOf("|");
                if (separator >= 0) { definition.label = value.slice(0, separator).trim() || definition.label; definition.description = value.slice(separator + 1).trim(); }
                else definition.label = value;
            }
        });
        definition.approvalLevels = definition.approvalLevels.filter(function (level, index, list) { return list.indexOf(level) === index; }).sort();
        return definition;
    }
    function getScriptDefinition(user, scriptPath) { if (!siteAdmin(user)) throw new Error("Only Site Admin can edit script definitions."); var value = parseDefinition(scriptPath); if (!value) throw new Error("Script not found."); return value; }
    function saveScriptDefinition(user, scriptPath, definition) {
        if (!siteAdmin(user)) throw new Error("Only Site Admin can edit script definitions.");
        var sourceData = readScriptText(scriptPath); if (!sourceData) throw new Error("Script not found.");
        definition = definition && typeof definition === "object" ? definition : {};
        var header = [], label = clean(definition.label || path.basename(sourceData.target, path.extname(sourceData.target)), 120).trim(), description = clean(definition.description, 500).trim();
        header.push("# " + label + (description ? " | " + description : ""));
        [1, 2, 3].forEach(function (level) { header.push("# Approval_" + level + ": " + ((definition.approvalLevels || []).map(Number).indexOf(level) >= 0 ? "true" : "false")); });
        function add(items, secret) { (Array.isArray(items) ? items : []).slice(0, 100).forEach(function (item) { var directive = clean(item && item.directive, 80).trim(), value = clean(item && item.value, 4000).trim(); var pattern = secret ? /^(SaveSecretRequired|SaveSecret)$/i : /^(VariableSelectRequired|VariableSelect|VariableSwitchRequired|VariableSwitch|VariableUserRequired|VariableUser|VariableAssetRequired|VariableAsset|VariableRequired|Variable)$/i; if (pattern.test(directive) && value) header.push("# " + directive + ": " + value); }); }
        add(definition.variables, false); add(definition.secretVariables, true);
        var next = header.join("\n") + "\n\n" + sourceData.body.replace(/^\s+/, ""), temporary = sourceData.target + "." + process.pid + ".tmp";
        fs.writeFileSync(temporary, next, "utf8"); try { fs.renameSync(temporary, sourceData.target); } catch (error) { fs.copyFileSync(temporary, sourceData.target); fs.unlinkSync(temporary); }
        return getScriptDefinition(user, scriptPath);
    }

    function findScript(node, scriptPath) { if (!node) return null; if (node.type === "script" && node.path === scriptPath) return node; var children = node.children || []; for (var i = 0; i < children.length; i++) { var found = findScript(children[i], scriptPath); if (found) return found; } return null; }
    function taskName(id) { return "\\SirK Portal\\MyScripts\\" + id; }
    function taskExecutable() { return process.env.SystemRoot ? path.join(process.env.SystemRoot, "System32", "schtasks.exe") : "schtasks.exe"; }
    function powershellPath() { return process.env.SystemRoot ? path.join(process.env.SystemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe") : "powershell.exe"; }
    function quoteTaskArgument(value) { return '"' + String(value || "").replace(/"/g, '\\"') + '"'; }
    function schedulerArgs(item, jobPath) {
        var args = ["/Create", "/F", "/TN", taskName(item.id), "/RU", "SYSTEM", "/RL", "HIGHEST"];
        var command = quoteTaskArgument(powershellPath()) + " -NoProfile -NonInteractive -ExecutionPolicy Bypass -File " + quoteTaskArgument(runnerPath) + " -JobPath " + quoteTaskArgument(jobPath);
        args.push("/TR", command);
        var kind = String(item.schedule && item.schedule.type || "DAILY").toUpperCase();
        if (["ONCE", "DAILY", "WEEKLY", "HOURLY"].indexOf(kind) < 0) kind = "DAILY";
        args.push("/SC", kind);
        if (kind === "HOURLY") args.push("/MO", String(Math.max(1, Math.min(23, Number(item.schedule.interval) || 1))));
        else {
            args.push("/ST", clean(item.schedule.time || "03:00", 5));
            if (kind === "ONCE") args.push("/SD", clean(item.schedule.date || new Date(Date.now() + 86400000).toLocaleDateString("en-GB").split("/").reverse().join("/"), 10));
            if (kind === "WEEKLY") args.push("/D", clean(item.schedule.days || "MON", 40));
        }
        return args;
    }
    function listAutomations(user) { if (!siteAdmin(user)) throw new Error("Only Site Admin can manage automations."); var data = readJson(automationStorePath, []); return Array.isArray(data) ? data : []; }
    function createAutomation(user, payload) {
        if (!siteAdmin(user)) throw new Error("Only Site Admin can manage automations.");
        if (process.platform !== "win32") throw new Error("Windows Task Scheduler automation is available only on Windows.");
        payload = payload && typeof payload === "object" ? payload : {};
        var tree = base.getTree(user), script = findScript(tree, String(payload.scriptPath || ""));
        if (!script) throw new Error("Script not found.");
        if (script.requiresApproval) throw new Error("Scheduled scripts cannot require interactive approval.");
        if (script.secretVariables && script.secretVariables.length) throw new Error("Scheduled scripts with saved secrets are not supported yet.");
        var id = clean(payload.id || ("job-" + Date.now().toString(36) + "-" + crypto.randomBytes(3).toString("hex")), 80).replace(/[^a-zA-Z0-9._-]/g, "-");
        var item = { id: id, name: clean(payload.name || script.label || script.name, 160), scriptPath: script.path, variables: payload.variables && typeof payload.variables === "object" ? clone(payload.variables) : {}, schedule: payload.schedule && typeof payload.schedule === "object" ? clone(payload.schedule) : { type: "DAILY", time: "03:00" }, enabled: payload.enabled !== false, createdAt: new Date().toISOString(), createdBy: core.userName(user), taskName: taskName(id) };
        ensureData(); var jobPath = path.join(automationRoot, id + ".json"); writeJson(jobPath, item);
        var result = childProcess.spawnSync(taskExecutable(), schedulerArgs(item, jobPath), { encoding: "utf8", windowsHide: true });
        if (result.status !== 0) throw new Error(clean(result.stderr || result.stdout || "Could not create the scheduled task.", 8000));
        var data = listAutomations(user).filter(function (entry) { return entry.id !== id; }); data.push(item); writeJson(automationStorePath, data); return item;
    }
    function deleteAutomation(user, id) {
        if (!siteAdmin(user)) throw new Error("Only Site Admin can manage automations.");
        id = clean(id, 80).replace(/[^a-zA-Z0-9._-]/g, "-");
        if (process.platform === "win32") childProcess.spawnSync(taskExecutable(), ["/Delete", "/F", "/TN", taskName(id)], { encoding: "utf8", windowsHide: true });
        var data = listAutomations(user).filter(function (entry) { return entry.id !== id; }); writeJson(automationStorePath, data);
        try { fs.unlinkSync(path.join(automationRoot, id + ".json")); } catch (error) { }
        return true;
    }

    function zabbixSettings(user) {
        if (!siteAdmin(user)) throw new Error("Only Site Admin can manage Zabbix settings.");
        var value = zabbixStore.read(); return { url: String(value.url || ""), tokenConfigured: !!value.token, token: "", verifyTls: value.verifyTls !== false };
    }
    function saveZabbixSettings(user, payload) {
        if (!siteAdmin(user)) throw new Error("Only Site Admin can manage Zabbix settings.");
        var current = zabbixStore.read(), next = { url: clean(payload && payload.url || current.url, 1000).replace(/\/+$/, ""), token: clean(payload && payload.token || current.token, 8000), verifyTls: payload && Object.prototype.hasOwnProperty.call(payload, "verifyTls") ? bool(payload.verifyTls) : current.verifyTls !== false };
        if (!next.url || !/^https?:\/\//i.test(next.url)) throw new Error("Enter a valid Zabbix URL.");
        if (!next.token) throw new Error("Zabbix API token is required.");
        zabbixStore.save(next); return zabbixSettings(user);
    }
    function zabbixCall(method, params) {
        var settings = zabbixStore.read(); if (!settings.url || !settings.token) return Promise.reject(new Error("Configure Zabbix API settings first."));
        var endpoint = new URL(settings.url.replace(/\/+$/, "") + "/api_jsonrpc.php"), body = JSON.stringify({ jsonrpc: "2.0", method: method, params: params || {}, id: Date.now(), auth: settings.token });
        var transport = endpoint.protocol === "https:" ? https : http;
        return new Promise(function (resolve, reject) {
            var request = transport.request({ protocol: endpoint.protocol, hostname: endpoint.hostname, port: endpoint.port || undefined, path: endpoint.pathname + endpoint.search, method: "POST", rejectUnauthorized: settings.verifyTls !== false, headers: { "Content-Type": "application/json-rpc", "Content-Length": Buffer.byteLength(body) } }, function (response) {
                var chunks = []; response.on("data", function (chunk) { chunks.push(chunk); }); response.on("end", function () { try { var value = JSON.parse(Buffer.concat(chunks).toString("utf8")); if (value.error) reject(new Error(value.error.data || value.error.message || "Zabbix API error.")); else resolve(value.result); } catch (error) { reject(error); } });
            });
            request.setTimeout(30000, function () { request.destroy(new Error("Zabbix API timeout.")); }); request.on("error", reject); request.end(body);
        });
    }
    function listMaintenances(user) { if (!siteAdmin(user)) return Promise.reject(new Error("Only Site Admin can manage Zabbix maintenance.")); return zabbixCall("maintenance.get", { output: "extend", selectHosts: ["hostid", "host", "name"], selectTimeperiods: "extend", sortfield: "name" }); }
    function createMaintenance(user, payload) {
        if (!siteAdmin(user)) return Promise.reject(new Error("Only Site Admin can manage Zabbix maintenance."));
        payload = payload && typeof payload === "object" ? payload : {};
        var now = Math.floor(Date.now() / 1000), from = Number(payload.activeSince) || now, till = Number(payload.activeTill) || (from + 3600), hostids = Array.isArray(payload.hostids) ? payload.hostids.map(String).filter(Boolean) : [];
        if (!hostids.length) return Promise.reject(new Error("Select at least one Zabbix host."));
        return zabbixCall("maintenance.create", { name: clean(payload.name || "SirK Portal maintenance", 128), active_since: from, active_till: till, hosts: hostids.map(function (hostid) { return { hostid: hostid }; }), timeperiods: [{ timeperiod_type: 0, start_date: from, period: Math.max(60, till - from) }], maintenance_type: Number(payload.maintenanceType) === 1 ? 1 : 0, description: clean(payload.description || "Created by SirK Portal / My Scripts", 2048) });
    }
    function deleteMaintenance(user, ids) { if (!siteAdmin(user)) return Promise.reject(new Error("Only Site Admin can manage Zabbix maintenance.")); ids = Array.isArray(ids) ? ids.map(String).filter(Boolean) : [String(ids || "")].filter(Boolean); if (!ids.length) return Promise.reject(new Error("Select maintenance entries to delete.")); return zabbixCall("maintenance.delete", ids); }

    function progressFor(item) {
        var levels = item && (item.approvalLevels || item.requiredApprovalLevels || item.levels || (item.payload && item.payload.approvalLevels)) || [];
        if (!Array.isArray(levels)) levels = Object.keys(levels || {}).filter(function (key) { return levels[key]; }).map(Number);
        var approvals = item && (item.approvedLevels || item.approvals || item.approvalHistory) || [];
        var approved = Array.isArray(approvals) ? approvals.filter(function (entry) { return entry && entry.status ? /approved|accepted/i.test(entry.status) : true; }).length : Number(item && item.approvedCount) || 0;
        var total = levels.length || Number(item && item.approvalCount) || Number(item && item.requiredApprovals) || 0;
        if (item && item.status === "completed" && total && approved < total) approved = total;
        return { approved: approved, total: total, text: approved + "/" + total };
    }
    var originalGetResults = base.getResults;
    base.getResults = function (user) { return Promise.resolve(originalGetResults(user)).then(function (value) { (value.rows || []).forEach(function (item) { item.approvalProgress = progressFor(item); }); return value; }); };
    base.getScriptDefinition = getScriptDefinition;
    base.saveScriptDefinition = saveScriptDefinition;
    base.listAutomations = listAutomations;
    base.createAutomation = createAutomation;
    base.deleteAutomation = deleteAutomation;
    base.getZabbixSettings = zabbixSettings;
    base.saveZabbixSettings = saveZabbixSettings;
    base.listZabbixMaintenances = listMaintenances;
    base.createZabbixMaintenance = createMaintenance;
    base.deleteZabbixMaintenance = deleteMaintenance;
    return base;
};
