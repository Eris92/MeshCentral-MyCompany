"use strict";

var crypto = require("crypto");
var fs = require("fs");
var path = require("path");
var core = require("./core.js");

function clean(value, limit) {
    return String(value == null ? "" : value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").slice(0, limit || 1000);
}

function clone(value) { return JSON.parse(JSON.stringify(value)); }

module.exports.extendModule = function (base, config, parent, source) {
    var root = path.join(parent.pluginPath, "mycommands");
    var scriptsRoot = path.join(root, "scripts");
    var dataRoot = path.join(root, "data");
    var directResultsPath = path.join(dataRoot, "direct-results.json");
    var maxNodes = Math.max(1, Math.min(500, Number(config.maxMultiHostNodes) || 200));
    var concurrency = Math.max(1, Math.min(32, Number(config.multiHostConcurrency) || 8));
    var timeoutMs = Math.max(30, Math.min(1800, Number(config.approvalExecutionTimeoutSeconds) || 300)) * 1000;
    var approvalBus = core.ensureApprovalBus(parent);

    function ensureData() { fs.mkdirSync(dataRoot, { recursive: true }); }
    function readJson(file, fallback) { try { return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "")); } catch (error) { return fallback; } }
    function writeJson(file, value) {
        ensureData();
        var temporary = file + "." + process.pid + ".tmp";
        fs.writeFileSync(temporary, JSON.stringify(value, null, 2), "utf8");
        try { fs.renameSync(temporary, file); } catch (error) { fs.copyFileSync(temporary, file); fs.unlinkSync(temporary); }
    }
    function siteAdmin(user) { return core.isSiteAdmin(user); }
    function normalizeScriptPath(relativePath) {
        relativePath = String(relativePath || "").replace(/\\/g, "/");
        if (!relativePath || relativePath.indexOf("\0") >= 0 || relativePath.charAt(0) === "/" || relativePath.split("/").indexOf("..") >= 0) return null;
        var resolvedRoot = path.resolve(scriptsRoot), target = path.resolve(resolvedRoot, relativePath.replace(/\//g, path.sep));
        var prefix = resolvedRoot.endsWith(path.sep) ? resolvedRoot : resolvedRoot + path.sep;
        return target.toLowerCase().indexOf(prefix.toLowerCase()) === 0 ? target : null;
    }
    function scriptMetadata(scriptPath) {
        var target = normalizeScriptPath(scriptPath);
        if (!target) return null;
        var text; try { text = fs.readFileSync(target, "utf8").replace(/^\uFEFF/, ""); } catch (error) { return null; }
        var lines = text.split(/\r?\n/), header = [], bodyIndex = 0, multiHost = false;
        for (; bodyIndex < lines.length; bodyIndex++) {
            var trimmed = String(lines[bodyIndex] || "").trim();
            if (!trimmed) { header.push(lines[bodyIndex]); continue; }
            if (trimmed.charAt(0) !== "#") break;
            header.push(lines[bodyIndex]);
            var match = trimmed.replace(/^\s*#\s*/, "").match(/^MultiHost\s*:\s*(true|false)$/i);
            if (match) multiHost = match[1].toLowerCase() === "true";
        }
        return { path: scriptPath, target: target, text: text, lines: lines, bodyIndex: bodyIndex, header: header, body: lines.slice(bodyIndex).join("\n"), multiHost: multiHost };
    }
    function getScriptDefinition(user, scriptPath) {
        if (!siteAdmin(user)) throw new Error("Only Site Admin can edit script definitions.");
        var meta = scriptMetadata(scriptPath); if (!meta) throw new Error("Script not found.");
        var definition = { label: path.basename(meta.target, path.extname(meta.target)), summary: "", runAsUser: 0, multiHost: meta.multiHost, approvalLevels: [], variables: [], rawHeader: meta.header.join("\n") };
        meta.header.forEach(function (line) {
            var value = String(line || "").trim().replace(/^\s*#\s*/, ""), match;
            if (!value) return;
            if ((match = value.match(/^runAsUser\s*:\s*([012])$/i))) definition.runAsUser = Number(match[1]);
            else if ((match = value.match(/^Approval(?:_([123]))?\s*:\s*(true|false)$/i)) && match[2].toLowerCase() === "true") definition.approvalLevels.push(Number(match[1] || 1));
            else if ((match = value.match(/^MultiHost\s*:\s*(true|false)$/i))) definition.multiHost = match[1].toLowerCase() === "true";
            else if ((match = value.match(/^(VariableSelectRequired|VariableSelect|VariableSwitchRequired|VariableSwitch|VariableRequired|Variable)\s*:\s*(.+)$/i))) {
                definition.variables.push({ directive: match[1], value: match[2] });
            } else if (!definition.summary) definition.summary = value;
        });
        definition.approvalLevels = definition.approvalLevels.filter(function (level, index, list) { return list.indexOf(level) === index; }).sort();
        return definition;
    }
    function saveScriptDefinition(user, scriptPath, definition) {
        if (!siteAdmin(user)) throw new Error("Only Site Admin can edit script definitions.");
        var meta = scriptMetadata(scriptPath); if (!meta) throw new Error("Script not found.");
        definition = definition && typeof definition === "object" ? definition : {};
        var header = [];
        var summary = clean(definition.summary || definition.label || path.basename(meta.target, path.extname(meta.target)), 500).trim();
        if (summary) header.push("# " + summary);
        header.push("# runAsUser: " + ([0, 1, 2].indexOf(Number(definition.runAsUser)) >= 0 ? Number(definition.runAsUser) : 0));
        header.push("# MultiHost: " + (definition.multiHost === true ? "true" : "false"));
        [1, 2, 3].forEach(function (level) { header.push("# Approval_" + level + ": " + ((definition.approvalLevels || []).map(Number).indexOf(level) >= 0 ? "true" : "false")); });
        (Array.isArray(definition.variables) ? definition.variables : []).slice(0, 100).forEach(function (item) {
            var directive = clean(item && item.directive, 60).trim();
            var value = clean(item && item.value, 4000).trim();
            if (/^(VariableSelectRequired|VariableSelect|VariableSwitchRequired|VariableSwitch|VariableRequired|Variable)$/i.test(directive) && value) header.push("# " + directive + ": " + value);
        });
        var next = header.join("\n") + "\n\n" + meta.body.replace(/^\s+/, "");
        var temporary = meta.target + "." + process.pid + ".tmp";
        fs.writeFileSync(temporary, next, "utf8");
        try { fs.renameSync(temporary, meta.target); } catch (error) { fs.copyFileSync(temporary, meta.target); fs.unlinkSync(temporary); }
        return getScriptDefinition(user, scriptPath);
    }
    function normalizeNodeIds(value) {
        var list = Array.isArray(value) ? value : String(value || "").split(/[\r\n,;]+/);
        var result = [], seen = Object.create(null);
        list.forEach(function (item) { var id = clean(item, 500).trim(); if (id && !seen[id]) { seen[id] = true; result.push(id); } });
        if (!result.length) throw new Error("Select at least one host.");
        if (result.length > maxNodes) throw new Error("A maximum of " + maxNodes + " hosts can be selected.");
        return result;
    }
    function waitForOutput(user, responseId) {
        return new Promise(function (resolve, reject) {
            var started = Date.now();
            function poll() {
                var output = base.getOutput(user, responseId);
                if (!output) { reject(new Error("Permission denied while reading command output.")); return; }
                if (output.ready) { resolve(String(output.output || "")); return; }
                if (Date.now() - started >= timeoutMs) { reject(new Error("Timed out while waiting for the command result.")); return; }
                setTimeout(poll, 250);
            }
            poll();
        });
    }
    function executeOne(user, request, nodeId) {
        return new Promise(function (resolve) {
            var responseId = "mycommands-direct2-" + Date.now().toString(36) + "-" + crypto.randomBytes(5).toString("hex");
            var command = Object.assign({}, request, { nodeid: nodeId, responseid: responseId });
            var webServer = core.getWebServer(parent);
            var domainId = String(user && user.domain || (user && user._id && String(user._id).split("/")[1]) || "");
            var myparent = { user: user, domain: domainId ? { id: domainId } : null, ws: { sessionId: null } };
            base.handleServerAction(command, myparent, webServer, function (error, sent) {
                if (error) { resolve({ nodeId: nodeId, status: "failed", error: clean(error, 4000), output: "" }); return; }
                waitForOutput(user, responseId).then(function (raw) { resolve({ nodeId: nodeId, status: "completed", error: "", output: raw, state: sent && sent.state || "sent" }); }).catch(function (failure) { resolve({ nodeId: nodeId, status: "failed", error: clean(failure.message || failure, 4000), output: "" }); });
            });
        });
    }
    async function mapLimit(items, limit, worker) {
        var results = new Array(items.length), cursor = 0;
        async function runner() { while (true) { var index = cursor++; if (index >= items.length) return; results[index] = await worker(items[index], index); } }
        var runners = []; for (var i = 0; i < Math.min(limit, items.length); i++) runners.push(runner());
        await Promise.all(runners); return results;
    }
    function appendDirectResult(user, request, result) {
        var data = readJson(directResultsPath, []); if (!Array.isArray(data)) data = [];
        data.unshift({ id: "direct-" + Date.now().toString(36) + "-" + crypto.randomBytes(4).toString("hex"), createdAt: new Date().toISOString(), requester: { id: user && user._id || "", name: core.userName(user) }, action: clean(request.pluginaction, 40), commandId: clean(request.commandId, 120), scriptPath: clean(request.scriptPath, 500), nodeIds: result.map(function (item) { return item.nodeId; }), status: result.every(function (item) { return item.status === "completed"; }) ? "completed" : (result.some(function (item) { return item.status === "completed"; }) ? "partial" : "failed"), result: result });
        writeJson(directResultsPath, data.slice(0, 1000));
    }
    async function executeMany(user, request) {
        var nodeIds = normalizeNodeIds(request.nodeids || request.nodeIds || request.nodeid);
        if (request.pluginaction === "runScript" && nodeIds.length > 1) {
            var metadata = scriptMetadata(request.scriptPath);
            if (!metadata || metadata.multiHost !== true) throw new Error("This script does not allow multi-host execution. Add # MultiHost: true to its definition.");
        }
        var result = await mapLimit(nodeIds, concurrency, function (nodeId) { return executeOne(user, request, nodeId); });
        appendDirectResult(user, request, result);
        return { total: result.length, completed: result.filter(function (item) { return item.status === "completed"; }).length, failed: result.filter(function (item) { return item.status !== "completed"; }).length, rows: result };
    }
    function directResults(user) {
        var access = base.getAccess(user); if (!access || !access.allowed) throw new Error("Permission denied.");
        var data = readJson(directResultsPath, []); if (!Array.isArray(data)) data = [];
        if (!siteAdmin(user)) data = data.filter(function (item) { return item.requester && item.requester.id === String(user && user._id || ""); });
        return data;
    }
    async function getResults(user) {
        var direct = directResults(user), approved = [];
        if (approvalBus.service && typeof approvalBus.service.list === "function") {
            try { var value = await approvalBus.service.list(user, { type: "mycommands", perPage: 500, page: 1 }); approved = value && value.rows || []; } catch (error) { approved = []; }
        }
        return { rows: direct.concat(approved).sort(function (a, b) { return String(b.createdAt || "").localeCompare(String(a.createdAt || "")); }) };
    }

    base.getScriptDefinition = getScriptDefinition;
    base.saveScriptDefinition = saveScriptDefinition;
    base.executeMany = executeMany;
    base.getExtendedResults = getResults;
    base.getScriptMetadata = function (user, scriptPath) {
        var access = base.getAccess(user); if (!access || !access.allowed) throw new Error("Permission denied.");
        var value = scriptMetadata(scriptPath); return value ? { multiHost: value.multiHost } : null;
    };
    return base;
};
