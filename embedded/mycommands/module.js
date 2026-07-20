"use strict";

var childProcess = require("child_process");
var crypto = require("crypto");
var core = require("./core.js");

function isSiteAdmin(user) {
    return !!user && user.siteadmin === 0xFFFFFFFF;
}

function userName(user) {
    return String(user && (user.realname || user.realName || user.displayName || user.name || user._id) || "unknown");
}

function getUserGroups(parent) {
    var candidates = [parent && parent.parent && parent.parent.webserver, parent && parent.parent, parent && parent.webServer];
    var groups = null;
    for (var index = 0; index < candidates.length; index++) {
        if (candidates[index] && candidates[index].userGroups) { groups = candidates[index].userGroups; break; }
    }
    return Object.keys(groups || {}).filter(function (id) {
        return groups[id] && groups[id].deleted == null;
    }).map(function (id) {
        return { id: String(groups[id]._id || id), name: String(groups[id].name || groups[id]._id || id) };
    }).sort(function (left, right) { return left.name.localeCompare(right.name); });
}

function permissionData(groupIds) {
    var ids = Array.isArray(groupIds) ? groupIds.map(function (id) { return String(id || "").trim(); }).filter(Boolean) : (groupIds ? [String(groupIds)] : []);
    return {
        allowed: { users: [], userGroups: ids, meshes: [], nodes: [] },
        denied: { users: [], userGroups: [], meshes: [], nodes: [] },
        meshOverrides: {},
        nodeOverrides: {}
    };
}

function asBoolean(value, fallback) {
    if (value === true || value === false) return value;
    if (value === "true" || value === "1" || value === 1) return true;
    if (value === "false" || value === "0" || value === 0) return false;
    return fallback;
}

function cleanText(value, limit) {
    return String(value == null ? "" : value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").slice(0, limit || 1000);
}

function copy(value) {
    return JSON.parse(JSON.stringify(value));
}

module.exports.createModule = function (config, parent, source) {
    var fs = parent.fs;
    var path = parent.path;
    var pluginRoot = path.join(parent.pluginPath, "mycommands");
    var scriptsRoot = path.join(pluginRoot, "scripts");
    var dataRoot = path.join(pluginRoot, "data");
    var settingsPath = path.join(dataRoot, "settings.json");
    var folderPermissionsPath = path.join(dataRoot, "folder-permissions.json");
    var outputs = {};
    var pendingByNode = {};
    var scriptCache = Object.create(null);
    var scriptsTreeCache = { value: null, expiresAt: 0 };
    var executionTimeoutMs = Math.max(30, Math.min(900, Number(config.approvalExecutionTimeoutSeconds) || 300)) * 1000;
    var outputTtl = Math.max(5 * 60 * 1000, executionTimeoutMs + 60 * 1000);
    var approvalInstallUrl = "https://raw.githubusercontent.com/Eris92/MeshCentral-ApprovalCenter/main/config.json";
    var approvalBus = core.ensureApprovalBus(parent);
    var allowedExtensions = { ".ps1": 2, ".cmd": 1, ".bat": 1 };
    var clientConfig = {
        name: String(config.name || "My Commands"),
        shortName: "mycommands",
        version: String(config.version || "4.4.2"),
        viewMode: Number(config.viewmode) || 102,
        pageText: String(config.pageText || "My Commands"),
        leftMenuAsset: String(config.leftMenuIcon || "assets/LeftMenu.png").replace(/\\/g, "/").split("/").pop(),
        credentialsEnabled: false,
        defaultShowInMenu: config.showInMenu === true,
        defaultShowOnDevice: config.showOnDevice !== false,
        approvalCenterInstallUrl: approvalInstallUrl
    };

    var catalog = {
        network: {
            title: "Network",
            commands: [
                { id: "flushdns", label: "Flush DNS", description: "Clear the DNS client cache.", type: 1, runAsUser: 0, cmd: "ipconfig /flushdns" },
                { id: "dns", label: "Check DNS", description: "Resolve a DNS name.", type: 2, runAsUser: 0, variables: [{ name: "name", label: "DNS name", required: true, control: "text", defaultValue: "" }], cmd: "Resolve-DnsName -Name $name | Format-Table -AutoSize" },
                { id: "port", label: "Check port", description: "Test a TCP or UDP port.", type: 2, runAsUser: 0, variables: [{ name: "hostName", label: "Host name or IP", required: true, control: "text", defaultValue: "" }, { name: "port", label: "Port", required: true, control: "text", defaultValue: "443" }, { name: "protocol", label: "Protocol", required: true, control: "select", defaultValue: "TCP", options: ["TCP", "UDP"] }], cmd: "if ($protocol -eq 'UDP') { $client=New-Object Net.Sockets.UdpClient; try { $client.Connect($hostName,[int]$port); $bytes=[Text.Encoding]::UTF8.GetBytes('MyCommands UDP probe'); [void]$client.Send($bytes,$bytes.Length); 'UDP datagram sent to {0}:{1}' -f $hostName,$port } finally { $client.Dispose() } } else { Test-NetConnection -ComputerName $hostName -Port ([int]$port) -InformationLevel Detailed }" },
                { id: "netstat", label: "Open ports", description: "Show listening ports and active connections.", type: 1, runAsUser: 0, cmd: "netstat -ano" },
                { id: "netstat-port", label: "Filter by port", description: "Filter netstat output by port.", type: 1, runAsUser: 0, variables: [{ name: "port", label: "Port", required: true, control: "text", defaultValue: "443" }], cmd: "netstat -ano | findstr /R /C:\":%port%[ ]\"" }
            ]
        },
        system: {
            title: "System",
            commands: [
                { id: "powershell", label: "Open PowerShell", description: "Open a PowerShell window for the interactive user.", type: 1, runAsUser: 2, cmd: "start \"\" powershell.exe -NoExit" },
                { id: "cmd", label: "Open CMD", description: "Open Command Prompt for the interactive user.", type: 1, runAsUser: 2, cmd: "start \"\" cmd.exe" },
                { id: "regedit", label: "Registry Editor", description: "Open Registry Editor.", type: 1, runAsUser: 2, cmd: "start \"\" regedit.exe" },
                { id: "secpol", label: "Local Security Policy", description: "Open secpol.msc.", type: 1, runAsUser: 2, cmd: "start \"\" secpol.msc" },
                { id: "firewall", label: "Windows Firewall", description: "Open Windows Firewall management.", type: 1, runAsUser: 2, cmd: "start \"\" mmc.exe wf.msc" },
                { id: "mmc", label: "MMC", description: "Open Microsoft Management Console.", type: 1, runAsUser: 2, cmd: "start \"\" mmc.exe" },
                { id: "services", label: "Services", description: "Open Services management.", type: 1, runAsUser: 2, cmd: "start \"\" mmc.exe services.msc" },
                { id: "devices", label: "Device Manager", description: "Open Device Manager.", type: 1, runAsUser: 2, cmd: "start \"\" mmc.exe devmgmt.msc" },
                { id: "events", label: "Event Viewer", description: "Open Event Viewer.", type: 1, runAsUser: 2, cmd: "start \"\" mmc.exe eventvwr.msc" },
                { id: "taskmgr", label: "Task Manager", description: "Open Task Manager.", type: 1, runAsUser: 2, cmd: "start \"\" taskmgr.exe" }
            ]
        },
        other: {
            title: "Other",
            commands: [
                { id: "printers", label: "Printer Management", description: "Open printer management.", type: 1, runAsUser: 2, cmd: "start \"\" printmanagement.msc" },
                { id: "certlm", label: "Certificates (computer)", description: "Open local computer certificates.", type: 1, runAsUser: 2, cmd: "start \"\" certlm.msc" },
                { id: "certcu", label: "Certificates (user)", description: "Open current user certificates.", type: 1, runAsUser: 2, cmd: "start \"\" certmgr.msc" },
                { id: "indexing", label: "Indexing Options", description: "Open Indexing Options.", type: 1, runAsUser: 2, cmd: "start \"\" control.exe /name Microsoft.IndexingOptions" },
                { id: "cleanup", label: "Disk Cleanup", description: "Open Disk Cleanup.", type: 1, runAsUser: 2, cmd: "start \"\" cleanmgr.exe" }
            ]
        }
    };

    function ensureDirectories() {
        fs.mkdirSync(dataRoot, { recursive: true });
        fs.mkdirSync(scriptsRoot, { recursive: true });
    }

    function readJson(filePath, fallback) {
        try {
            var text = fs.readFileSync(filePath, "utf8");
            if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
            return JSON.parse(text);
        } catch (error) { return fallback; }
    }

    function writeJson(filePath, value) {
        ensureDirectories();
        var temporary = filePath + "." + process.pid + "." + crypto.randomBytes(4).toString("hex") + ".tmp";
        fs.writeFileSync(temporary, JSON.stringify(value, null, 2), "utf8");
        try { fs.renameSync(temporary, filePath); }
        catch (error) { fs.copyFileSync(temporary, filePath); fs.unlinkSync(temporary); }
    }

    function getUiSettings() {
        var settings = readJson(settingsPath, {});
        return {
            showInMenu: asBoolean(settings.showInMenu, clientConfig.defaultShowInMenu),
            showOnDevice: asBoolean(settings.showOnDevice, clientConfig.defaultShowOnDevice)
        };
    }

    function getFolderPermissions() {
        var value = readJson(folderPermissionsPath, {});
        return value && typeof value === "object" && !Array.isArray(value) ? value : {};
    }

    function saveFolderPermissions(value) { writeJson(folderPermissionsPath, value); }

    function getPermissions() {
        return parent && typeof parent.getPluginPermissions === "function" ? parent.getPluginPermissions(clientConfig.shortName) : null;
    }

    function getAccessGroups() {
        var permissions = getPermissions();
        var access = permissions && permissions.permissions && permissions.permissions.access;
        var groups = access && access.allowed && access.allowed.userGroups;
        return Array.isArray(groups) ? groups.map(function (id) { return String(id); }) : [];
    }

    function userInGroup(user, groupId) { return !!(user && user.links && user.links[String(groupId)] != null); }

    function rootFolderSettings() {
        var permissions = getFolderPermissions();
        return (readScriptsTree().children || []).filter(function (node) { return node.type === "directory"; }).map(function (node) {
            var groupIds = permissions[node.path];
            groupIds = Array.isArray(groupIds) ? groupIds.map(String).filter(Boolean) : (groupIds ? [String(groupIds)] : []);
            return { path: node.path, name: node.name, groupIds: groupIds };
        });
    }

    function folderAllowed(user, relative) {
        if (isSiteAdmin(user)) return true;
        var root = String(relative || "").replace(/\\/g, "/").split("/")[0];
        if (!root) return false;
        var groups = getFolderPermissions()[root];
        groups = Array.isArray(groups) ? groups : (groups ? [groups] : []);
        return groups.some(function (groupId) { return userInGroup(user, groupId); });
    }

    function pluginPermissionAllowed(user) {
        if (isSiteAdmin(user)) return true;
        return !!(user && parent && typeof parent.checkPluginPermission === "function" && parent.checkPluginPermission(user, clientConfig.shortName, "access", null, null) === true);
    }

    function getAccess(user) {
        var siteAdmin = isSiteAdmin(user);
        var pluginAllowed = pluginPermissionAllowed(user);
        var scriptsAllowed = siteAdmin || rootFolderSettings().some(function (folder) { return folder.groupIds.some(function (groupId) { return userInGroup(user, groupId); }); });
        return {
            allowed: pluginAllowed || scriptsAllowed,
            siteAdmin: siteAdmin,
            pluginAllowed: pluginAllowed,
            scriptsAllowed: scriptsAllowed,
            categories: { scripts: scriptsAllowed, network: pluginAllowed, system: pluginAllowed, other: pluginAllowed, settings: siteAdmin }
        };
    }

    function parseVariable(payload, required, control) {
        var parts = String(payload || "").split(",");
        var variable = String(parts.shift() || "").trim();
        var defaultValue = "";
        var match = variable.match(/^(.+?)\s*=\s*(.*)$/);
        if (match) { variable = match[1].trim(); defaultValue = match[2]; }
        var name = variable.replace(/^[\s$%]+/, "").trim();
        if (!name) return null;
        if (control === "switch" && parts.length && /^(true|false|1|0|yes|no|tak|nie)$/i.test(String(parts[0]).trim())) defaultValue = String(parts.shift()).trim();
        var label = parts.join(",").trim() || name;
        if (control === "switch") defaultValue = /^(true|1|yes|tak)$/i.test(defaultValue) ? "true" : "false";
        return { name: name, displayName: variable, label: label, required: required === true, control: control || "text", defaultValue: defaultValue };
    }

    function parseScript(text) {
        var lines = String(text || "").replace(/^\uFEFF/, "").split(/\r?\n/);
        var summary = "";
        var runAsUser = 0;
        var approvalFlags = {};
        var variables = [];
        var index = 0;
        while (index < lines.length) {
            var trimmed = String(lines[index] || "").trim();
            if (!trimmed) { index++; continue; }
            if (trimmed.charAt(0) !== "#") break;
            var header = trimmed.replace(/^\s*#\s*/, "");
            var runAs = header.match(/^runAsUser\s*:\s*([012])\s*$/i);
            var approvalDirective = header.match(/^Approval(?:_([123]))?\s*:\s*(true|false)$/i);
            var variable = header.match(/^(VariableSwitchRequired|VariableSwitch|VariableRequired|Variable)\s*:\s*(.+)$/i);
            if (runAs) runAsUser = Number(runAs[1]);
            else if (approvalDirective) approvalFlags[Number(approvalDirective[1] || 1)] = approvalDirective[2].toLowerCase() === "true";
            else if (variable) {
                var kind = variable[1].toLowerCase();
                var parsed = parseVariable(variable[2], kind.indexOf("required") >= 0, kind.indexOf("switch") >= 0 ? "switch" : "text");
                if (parsed) variables.push(parsed);
            } else if (!summary) summary = header;
            index++;
        }
        var approvalLevels = [1, 2, 3].filter(function (level) { return approvalFlags[level] === true; });
        return { summary: summary, runAsUser: runAsUser, variables: variables, approvalLevels: approvalLevels, approval: approvalLevels.length > 0, body: lines.slice(index).join("\n") };
    }

    function normalizeScriptPath(relativePath) {
        relativePath = String(relativePath || "").replace(/\\/g, "/");
        if (!relativePath || relativePath.indexOf("\0") >= 0 || relativePath.charAt(0) === "/" || relativePath.split("/").indexOf("..") >= 0) return null;
        var root = path.resolve(scriptsRoot);
        var target = path.resolve(root, relativePath.replace(/\//g, path.sep));
        var prefix = root.endsWith(path.sep) ? root : root + path.sep;
        if (target !== root && target.toLowerCase().indexOf(prefix.toLowerCase()) !== 0) return null;
        return target;
    }

    function readScript(relativePath, includeBody) {
        var target = normalizeScriptPath(relativePath);
        if (!target) return null;
        var extension = path.extname(target).toLowerCase();
        if (!allowedExtensions[extension]) return null;
        var stat;
        try { stat = fs.statSync(target); } catch (error) { return null; }
        if (!stat.isFile() || stat.size > 512 * 1024) return null;
        var cacheKey = target.toLowerCase(), cached = scriptCache[cacheKey];
        if (cached && cached.size === stat.size && cached.mtimeMs === stat.mtimeMs) {
            var cachedResult = copy(cached.value); if (!includeBody) delete cachedResult.body; return cachedResult;
        }
        var buffer = fs.readFileSync(target), parsed = parseScript(buffer.toString("utf8"));
        var result = { name: path.basename(target), path: String(relativePath).replace(/\\/g, "/"), type: allowedExtensions[extension], runAsUser: parsed.runAsUser, summary: parsed.summary, variables: parsed.variables, approvalLevels: parsed.approvalLevels, requiresApproval: parsed.approval === true, size: stat.size, mtimeMs: stat.mtimeMs, hash: crypto.createHash("sha256").update(buffer).digest("hex"), body: parsed.body };
        scriptCache[cacheKey] = { size: stat.size, mtimeMs: stat.mtimeMs, value: result };
        result = copy(result); if (!includeBody) delete result.body; return result;
    }

    function readScriptsTree() {
        if (scriptsTreeCache.value && scriptsTreeCache.expiresAt > Date.now()) return copy(scriptsTreeCache.value);
        ensureDirectories();
        function walk(directory, relative, depth) {
            var node = { type: "directory", name: relative ? path.basename(directory) : "scripts", path: relative, children: [] };
            if (depth > 12) return node;
            var entries = [];
            try { entries = fs.readdirSync(directory, { withFileTypes: true }); } catch (error) { node.error = error.message; return node; }
            entries.sort(function (left, right) { if (left.isDirectory() !== right.isDirectory()) return left.isDirectory() ? -1 : 1; return left.name.localeCompare(right.name); });
            entries.forEach(function (entry) {
                if (entry.name === ".git" || entry.name === ".gitkeep" || entry.name === "node_modules") return;
                var childRelative = relative ? relative + "/" + entry.name : entry.name;
                var childPath = path.join(directory, entry.name);
                if (entry.isDirectory()) node.children.push(walk(childPath, childRelative, depth + 1));
                else if (entry.isFile() && allowedExtensions[path.extname(entry.name).toLowerCase()]) {
                    var script = readScript(childRelative, false);
                    if (script) { script.type = "script"; node.children.push(script); }
                }
            });
            return node;
        }
        scriptsTreeCache = { value: walk(scriptsRoot, "", 0), expiresAt: Date.now() + 5000 };
        return copy(scriptsTreeCache.value);
    }

    function scriptsTreeForUser(user) {
        var tree = readScriptsTree();
        if (isSiteAdmin(user)) return tree;
        tree.children = (tree.children || []).filter(function (node) { return node.type === "directory" && folderAllowed(user, node.path); });
        return tree;
    }

    function publicCatalog() {
        var value = copy(catalog);
        Object.keys(value).forEach(function (category) { (value[category].commands || []).forEach(function (command) { delete command.cmd; }); });
        return value;
    }

    function getWebServer() {
        var candidates = [parent && parent.parent && parent.parent.webserver, parent && parent.parent, parent && parent.webServer];
        for (var index = 0; index < candidates.length; index++) if (candidates[index] && typeof candidates[index].GetNodeWithRights === "function") return candidates[index];
        return null;
    }

    function getDomain(user, fallback) {
        if (fallback) return fallback;
        var domainId = String(user && user.domain || "");
        if (!domainId && user && user._id) domainId = String(user._id).split("/")[1] || "";
        var meshServer = parent.parent;
        var configs = [meshServer && meshServer.config, meshServer && meshServer.parent && meshServer.parent.config, getWebServer() && getWebServer().parent && getWebServer().parent.config];
        for (var index = 0; index < configs.length; index++) if (configs[index] && configs[index].domains && configs[index].domains[domainId]) return configs[index].domains[domainId];
        return domainId ? { id: domainId } : null;
    }

    function cleanOutputs() {
        var now = Date.now();
        Object.keys(outputs).forEach(function (id) { if (now - outputs[id].updatedAt > outputTtl) delete outputs[id]; });
        Object.keys(pendingByNode).forEach(function (id) { if (now - pendingByNode[id].updatedAt > outputTtl) delete pendingByNode[id]; });
    }

    function prepareOutput(nodeId, responseId, user) {
        cleanOutputs();
        outputs[responseId] = { ready: false, output: "", userId: String(user && user._id || ""), updatedAt: Date.now() };
        pendingByNode[nodeId] = { responseId: responseId, buffer: "", updatedAt: Date.now() };
    }

    function storeOutput(responseId, output, ready) {
        if (typeof responseId !== "string" || responseId.indexOf("mycommands-") !== 0) return;
        cleanOutputs();
        var item = outputs[responseId] || { userId: "" };
        item.output = String(output == null ? "" : output).slice(0, 2 * 1024 * 1024);
        item.ready = ready === true;
        item.updatedAt = Date.now();
        outputs[responseId] = item;
    }

    function captureAgentData(command, agent) {
        if (!command || command.action !== "msg") return;
        if (command.type === "runcommands") { storeOutput(command.responseid, command.result, true); return; }
        if (command.type !== "console" || !agent || !agent.dbNodeKey || typeof command.value !== "string") return;
        var pending = pendingByNode[agent.dbNodeKey];
        if (!pending) return;
        pending.buffer = (pending.buffer + command.value).slice(-2 * 1024 * 1024);
        pending.updatedAt = Date.now();
        var busy = pending.buffer.indexOf("Run commands can't execute, already busy.") >= 0;
        var ended = pending.buffer.indexOf("__MYCOMMANDS_END__") >= 0;
        storeOutput(pending.responseId, busy ? "[error] Agent is already executing another command." : pending.buffer, busy || ended);
        if (busy || ended) delete pendingByNode[agent.dbNodeKey];
    }

    function escapePowerShell(value) { return String(value == null ? "" : value).replace(/'/g, "''"); }
    function escapeCmd(value) { return String(value == null ? "" : value).replace(/[\r\n]/g, " ").replace(/%/g, "%%").replace(/\^/g, "^^").replace(/!/g, "^^!"); }

    function applyVariables(script, values, includeCredentials) {
        values = values && typeof values === "object" ? values : {};
        var missing = [];
        var preamble = [];
        script.variables.forEach(function (variable) {
            var value = Object.prototype.hasOwnProperty.call(values, variable.name) ? String(values[variable.name]) : String(variable.defaultValue || "");
            if (variable.required && !value.trim()) missing.push(variable.label || variable.name);
            if (script.type === 2) {
                if (variable.control === "switch") preamble.push("$" + variable.name + " = $" + (/^(true|1|yes|tak)$/i.test(value) ? "true" : "false"));
                else preamble.push("$" + variable.name + " = '" + escapePowerShell(value) + "'");
            } else preamble.push("set \"" + variable.name + "=" + escapeCmd(value) + "\"");
        });
        if (missing.length) return { error: "Complete the required fields: " + missing.join(", ") };
        return { command: preamble.join(script.type === 2 ? "\n" : "\r\n") + (preamble.length ? (script.type === 2 ? "\n" : "\r\n") : "") + script.body };
    }

    function wrapCommand(command) {
        if (command.type === 2) return "$ErrorActionPreference='Continue';$ProgressPreference='SilentlyContinue';try { $e=New-Object System.Text.UTF8Encoding -ArgumentList $false; [Console]::OutputEncoding=$e; $OutputEncoding=$e } catch {};Write-Output '__MYCOMMANDS_BEGIN__';" + command.cmd + ";Write-Output '__MYCOMMANDS_END__';";
        return "@echo off\r\nchcp 65001 >nul\r\necho __MYCOMMANDS_BEGIN__\r\n" + command.cmd + "\r\necho __MYCOMMANDS_END__";
    }

    function findPreset(id) {
        var result = null;
        Object.keys(catalog).some(function (key) {
            result = catalog[key].commands.filter(function (command) { return command.id === id; })[0] || null;
            return !!result;
        });
        return result;
    }

    function auditExecution(webServer, node, nodeId, user, domain, command) {
        try {
            var dispatcherCandidates = [webServer, webServer && webServer.parent, parent.parent, parent.parent && parent.parent.parent];
            var dispatcher = dispatcherCandidates.filter(function (candidate) { return candidate && typeof candidate.DispatchEvent === "function"; })[0];
            if (!dispatcher) return;
            var targets = typeof webServer.CreateNodeDispatchTargets === "function" ? webServer.CreateNodeDispatchTargets(node.meshid, nodeId, ["server-users", user && user._id]) : ["*", "server-users", nodeId, user && user._id];
            dispatcher.DispatchEvent(targets, module.exports, { etype: "node", action: "runcommands", nodeid: nodeId, domain: String(domain && domain.id || ""), userid: user && user._id, username: userName(user), msg: 'My Commands: user "' + userName(user) + '" started "' + String(command.label || command.id || "command") + '".', cmdType: command.type, runAsUser: command.runAsUser, plugin: "mycommands", scriptPath: command.scriptPath || "" });
        } catch (error) { }
    }

    function sendToAgent(nodeId, command, user, domain, webServer, sessionId, responseId, callback) {
        var normalized = String(nodeId || "");
        if (normalized.indexOf("/") < 0) normalized = "node/" + domain.id + "/" + normalized;
        if (normalized.split("/").length !== 3 || normalized.split("/")[1] !== domain.id) { callback("Invalid device identifier."); return; }
        webServer.GetNodeWithRights(domain, user, normalized, function (node, rights, visible) {
            if (!node || rights === 0 || visible === false) { callback("You do not have access to this device."); return; }
            if (((rights & 24) !== 24) && ((rights & 0x00020000) === 0)) { callback("You do not have permission to run commands on this device."); return; }
            if (!node.agent || node.agent.id == null) { callback("Device agent information is unavailable."); return; }
            var type = command.type || 1;
            if ((node.agent.id > 0 && node.agent.id < 5) || (node.agent.id > 41 && node.agent.id < 44)) { if (type === 0) type = 1; }
            else if (type === 0) type = 3;
            var agentCommand = { action: "runcommands", type: type, cmds: wrapCommand(command), runAsUser: command.runAsUser || 0, sessionid: sessionId || null, reply: true, responseid: responseId };
            var agents = webServer.wsagents || (webServer.parent && webServer.parent.wsagents) || (parent.parent && parent.parent.wsagents) || {};
            var agent = agents[normalized];
            prepareOutput(normalized, responseId, user);
            auditExecution(webServer, node, normalized, user, domain, command);
            if (agent && agent.authenticated === 2 && agent.agentInfo) {
                try { agent.send(JSON.stringify(agentCommand)); callback(null, { state: "sent", nodeId: normalized }); }
                catch (error) { callback("Could not send the command: " + error.message); }
                return;
            }
            var multiServer = webServer.multiServer || (webServer.parent && webServer.parent.multiServer) || (parent.parent && parent.parent.multiServer);
            if (multiServer) {
                try { multiServer.DispatchMessage({ action: "agentCommand", nodeid: normalized, command: agentCommand }); callback(null, { state: "queued", nodeId: normalized }); }
                catch (error) { callback("Could not route the command: " + error.message); }
                return;
            }
            callback("Device agent is not connected.");
        });
    }

    function buildRequestedCommand(request, includeCredentials) {
        var action = String(request.pluginaction || "");
        if (action === "runPreset") {
            var preset = findPreset(String(request.commandId || ""));
            if (!preset) return { error: "Unknown command preset." };
            var presetScript = { type: preset.type, body: preset.cmd, variables: preset.variables || [] };
            var appliedPreset = applyVariables(presetScript, request.variableValues, includeCredentials);
            if (appliedPreset.error) return appliedPreset;
            return { command: { id: preset.id, label: preset.label, description: preset.description || "", type: preset.type, runAsUser: preset.runAsUser, cmd: appliedPreset.command, variables: preset.variables || [] }, approvalLevels: Array.isArray(preset.approvalLevels) && preset.approvalLevels.length ? preset.approvalLevels : [1], definitionHash: crypto.createHash("sha256").update(JSON.stringify({ id: preset.id, type: preset.type, runAsUser: preset.runAsUser, cmd: preset.cmd, variables: preset.variables || [] })).digest("hex") };
        }
        if (action === "runScript") {
            var script = readScript(String(request.scriptPath || ""), true);
            if (!script) return { error: "Script was not found or is not supported." };
            var applied = applyVariables(script, request.variableValues, includeCredentials);
            if (applied.error) return applied;
            return { command: { id: "script", label: script.name, description: script.summary || "", scriptPath: script.path, type: script.type, runAsUser: script.runAsUser, cmd: applied.command }, approvalLevels: script.approvalLevels, definitionHash: script.hash };
        }
        if (action === "runCustom") {
            var text = String(request.cmds || "");
            if (!text.trim()) return { error: "Command is empty." };
            var type = Number(request.type) === 1 ? 1 : 2;
            var custom = text.slice(0, 512 * 1024), runAsUser = Number(request.runAsUser) || 0;
            return { command: { id: "custom", label: "Custom command", description: type === 2 ? "Custom PowerShell command" : "Custom CMD command", type: type, runAsUser: runAsUser, cmd: custom }, approvalLevels: [1], definitionHash: crypto.createHash("sha256").update(JSON.stringify({ type: type, runAsUser: runAsUser, cmd: custom })).digest("hex") };
        }
        return { error: "Unknown plugin action." };
    }

    function findUser(userId) {
        userId = String(userId || "");
        var webServer = getWebServer(), users = webServer && webServer.users || parent.parent && parent.parent.users || {};
        if (users[userId]) return users[userId];
        var keys = Object.keys(users);
        for (var index = 0; index < keys.length; index++) if (String(users[keys[index]] && users[keys[index]]._id || keys[index]) === userId) return users[keys[index]];
        return null;
    }

    function normalizeValues(value) {
        value = value && typeof value === "object" && !Array.isArray(value) ? value : {};
        var result = {};
        Object.keys(value).slice(0, 100).forEach(function (key) {
            if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) result[key] = cleanText(value[key], 4000);
        });
        return result;
    }

    function normalizeApprovalSpec(payload) {
        payload = payload && typeof payload === "object" ? payload : {};
        return {
            nodeid: cleanText(payload.nodeid, 300),
            pluginaction: cleanText(payload.pluginaction, 40),
            commandId: cleanText(payload.commandId, 120),
            scriptPath: cleanText(payload.scriptPath, 500),
            type: Number(payload.type) === 1 ? 1 : 2,
            runAsUser: [0, 1, 2].indexOf(Number(payload.runAsUser)) >= 0 ? Number(payload.runAsUser) : 0,
            cmds: cleanText(payload.cmds, 512 * 1024),
            variableValues: normalizeValues(payload.variableValues)
        };
    }

    function authorizeSpec(user, spec) {
        var access = getAccess(user);
        if (spec.pluginaction === "runScript") {
            if (!access.scriptsAllowed || !folderAllowed(user, spec.scriptPath)) throw new Error("You do not have access to this script folder.");
            return true;
        }
        if (!access.pluginAllowed) throw new Error("You do not have access to command presets.");
        return true;
    }

    function resolveCommandNode(user, nodeId) {
        return new Promise(function (resolve, reject) {
            var domain = getDomain(user), webServer = getWebServer(), normalized = String(nodeId || "");
            if (!domain || !webServer) { reject(new Error("MeshCentral device API is unavailable.")); return; }
            if (normalized.indexOf("/") < 0) normalized = "node/" + domain.id + "/" + normalized;
            if (normalized.split("/").length !== 3 || normalized.split("/")[1] !== domain.id) { reject(new Error("Invalid device identifier.")); return; }
            webServer.GetNodeWithRights(domain, user, normalized, function (node, rights, visible) {
                if (!node || rights === 0 || visible === false) { reject(new Error("You do not have access to this device.")); return; }
                if (((rights & 24) !== 24) && ((rights & 0x00020000) === 0)) { reject(new Error("You do not have permission to run commands on this device.")); return; }
                if (!node.agent || node.agent.id == null) { reject(new Error("Device agent information is unavailable.")); return; }
                resolve({ domain: domain, webServer: webServer, nodeId: normalized, node: node });
            });
        });
    }

    function valuesSummary(values) {
        return Object.keys(values || {}).map(function (key) { return key + "=" + cleanText(values[key], 120); }).join(", ");
    }

    async function validateApproval(payload, user) {
        var spec = normalizeApprovalSpec(payload); authorizeSpec(user, spec);
        var built = buildRequestedCommand(spec, false);
        if (built.error) throw new Error(built.error);
        var context = await resolveCommandNode(user, spec.nodeid);
        spec.nodeid = context.nodeId;
        spec.definitionHash = built.definitionHash;
        return {
            payload: spec,
            approvalLevels: built.approvalLevels,
            summary: built.command.label + " on " + String(context.node.name || context.nodeId),
            fields: {
                device: cleanText(context.node.name || context.nodeId, 200),
                command: cleanText(built.command.label, 200),
                description: cleanText(built.command.description || "", 500),
                variables: valuesSummary(spec.variableValues)
            }
        };
    }

    function sanitizeTable(value) {
        var sourceRows = value && Array.isArray(value.rows) ? value.rows : (Array.isArray(value) ? value : (value == null ? [] : [value]));
        var columns = value && Array.isArray(value.columns) ? value.columns.map(function (item) { return cleanText(item, 120); }).slice(0, 50) : [];
        var rows = sourceRows.slice(0, 1000).map(function (row) {
            if (!row || typeof row !== "object" || Array.isArray(row)) row = { Value: row };
            var clean = {};
            Object.keys(row).slice(0, 50).forEach(function (key) {
                var value = row[key];
                clean[cleanText(key, 120)] = value == null || typeof value === "number" || typeof value === "boolean" ? value : cleanText(typeof value === "object" ? JSON.stringify(value) : value, 2000);
            });
            return clean;
        });
        if (!columns.length) rows.forEach(function (row) { Object.keys(row).forEach(function (key) { if (columns.indexOf(key) < 0 && columns.length < 50) columns.push(key); }); });
        return { columns: columns, rows: rows, truncated: sourceRows.length > rows.length };
    }

    function parseExecutionOutput(raw) {
        var text = String(raw || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n"), begin = text.indexOf("__MYCOMMANDS_BEGIN__"), end = text.indexOf("__MYCOMMANDS_END__");
        if (begin >= 0) text = text.slice(begin + "__MYCOMMANDS_BEGIN__".length);
        if (end >= 0) text = text.slice(0, text.indexOf("__MYCOMMANDS_END__"));
        var output = [], table = null, progress = "";
        text.split("\n").forEach(function (line) {
            var trimmed = line.trim(), progressMatch = trimmed.match(/^__(?:MYCOMMANDS|COMMANDTABS)_PROGRESS__\s+(.+)$/i), tableMatch = trimmed.match(/^__MYCOMMANDS_TABLE_B64__(.+)$/i);
            if (progressMatch) { progress = cleanText(progressMatch[1], 500); return; }
            if (tableMatch) {
                try { table = sanitizeTable(JSON.parse(Buffer.from(tableMatch[1], "base64").toString("utf8"))); }
                catch (error) { output.push("[error] Invalid table data."); }
                return;
            }
            if (!/^__MYCOMMANDS_(?:BEGIN|END)__$/.test(trimmed)) output.push(line);
        });
        var message = output.join("\n").trim();
        if (/^\[error\]/i.test(message)) throw new Error(message);
        if (!message) message = table ? "Table result: " + table.rows.length + " row(s)." : (progress || "Command completed without output.");
        return { message: cleanText(message, 8000), data: table ? { table: table } : {} };
    }

    function waitForOutput(responseId) {
        return new Promise(function (resolve, reject) {
            var started = Date.now();
            var poll = function () {
                cleanOutputs();
                var item = outputs[responseId];
                if (item && item.ready) {
                    delete outputs[responseId];
                    try { resolve(parseExecutionOutput(item.output)); } catch (error) { reject(error); }
                    return;
                }
                if (Date.now() - started >= executionTimeoutMs) { delete outputs[responseId]; reject(new Error("Timed out while waiting for the device command result.")); return; }
                setTimeout(poll, 250);
            };
            poll();
        });
    }

    async function executeApproval(payload, request, executionId) {
        var requester = findUser(request && request.requester && request.requester.id);
        if (!requester) throw new Error("The requesting MeshCentral user is no longer available.");
        var spec = normalizeApprovalSpec(payload), built = buildRequestedCommand(spec, true);
        if (built.error) throw new Error(built.error);
        if (built.definitionHash !== String(payload && payload.definitionHash || "")) throw new Error("The command or script changed after approval and was not executed.");
        var domain = getDomain(requester), webServer = getWebServer();
        if (!domain || !webServer) throw new Error("MeshCentral device API is unavailable.");
        var responseId = "mycommands-approval-" + cleanText(executionId, 80);
        await new Promise(function (resolve, reject) {
            sendToAgent(spec.nodeid, built.command, requester, domain, webServer, null, responseId, function (error) { if (error) reject(new Error(error)); else resolve(); });
        });
        return waitForOutput(responseId);
    }

    async function executeDirect(user, payload) {
        var spec = normalizeApprovalSpec(payload);
        if (spec.pluginaction !== "runScript") throw new Error("Only scripts can run directly.");
        authorizeSpec(user, spec);
        var script = readScript(spec.scriptPath, true);
        if (!script) throw new Error("Script was not found or is not supported.");
        if (script.requiresApproval === true) throw new Error("This script must be submitted for approval.");
        var built = buildRequestedCommand(spec, false);
        if (built.error) throw new Error(built.error);
        var context = await resolveCommandNode(user, spec.nodeid), responseId = "mycommands-direct-" + Date.now().toString(36);
        await new Promise(function (resolve, reject) { sendToAgent(context.nodeId, built.command, user, context.domain, context.webServer, null, responseId, function (error) { if (error) reject(new Error(error)); else resolve(); }); });
        return waitForOutput(responseId);
    }

    function formatApprovalRequest(request) {
        var fields = Object.assign({}, request.fields || {});
        if (request.result && request.result.data && request.result.data.table) fields.result = "Table: " + request.result.data.table.rows.length + " row(s)";
        else if (request.result && request.result.message) fields.result = cleanText(request.result.message, 500);
        return fields;
    }

    approvalBus.registerProvider({
        type: "mycommands",
        title: "Command requests",
        tabTitle: "Commands",
        settingsTitle: "My Commands approvers",
        description: "Commands and device-side scripts waiting for approval or already executed.",
        version: clientConfig.version,
        installUrl: approvalInstallUrl,
        columns: [
            { key: "device", label: "Device" },
            { key: "command", label: "Script / Command" },
            { key: "description", label: "Description" },
            { key: "variables", label: "Variables" },
            { key: "result", label: "Result" }
        ],
        api: {
            resourceDescription: "Returns command presets by default. Use kind=scripts or scriptPath to discover device-side scripts and their variables.",
            payloadSchema: {
                type: "object",
                required: ["nodeid", "pluginaction"],
                properties: {
                    nodeid: { type: "string", description: "MeshCentral node ID." },
                    pluginaction: { type: "string", enum: ["runPreset", "runScript", "runCustom"] },
                    commandId: { type: "string" },
                    scriptPath: { type: "string" },
                    type: { type: "integer", enum: [1, 2], description: "1=CMD, 2=PowerShell for runCustom." },
                    runAsUser: { type: "integer", enum: [0, 1, 2] },
                    cmds: { type: "string" },
                    variableValues: { type: "object", additionalProperties: { type: ["string", "number", "boolean"] } }
                }
            },
            resources: function (user, query) {
                var scriptPath = String(query && query.scriptPath || "").trim();
                if (scriptPath) { authorizeSpec(user, { pluginaction: "runScript", scriptPath: scriptPath }); var script = readScript(scriptPath, false); if (!script) throw new Error("Script was not found or is not supported."); return { script: script }; }
                if (String(query && query.kind || "").toLowerCase() === "scripts") { if (!getAccess(user).scriptsAllowed) throw new Error("You do not have access to script folders."); return { scripts: scriptsTreeForUser(user) }; }
                if (!getAccess(user).pluginAllowed) throw new Error("You do not have access to command presets.");
                return { catalog: publicCatalog() };
            }
        },
        canSubmit: function (user) { return getAccess(user).allowed; },
        validate: validateApproval,
        execute: executeApproval,
        formatRequest: formatApprovalRequest
    });

    return {
        ensureStorage: function () { try { ensureDirectories(); return null; } catch (error) { return error; } },
        getClientConfig: function () {
            var ui = getUiSettings();
            return { name: clientConfig.name, shortName: clientConfig.shortName, version: clientConfig.version, viewMode: clientConfig.viewMode, pageText: clientConfig.pageText, leftMenuAsset: clientConfig.leftMenuAsset, credentialsEnabled: clientConfig.credentialsEnabled, showInMenu: ui.showInMenu, showOnDevice: ui.showOnDevice, approvalAvailable: !!(approvalBus.service && typeof approvalBus.service.submit === "function"), approvalCenterInstallUrl: approvalInstallUrl };
        },
        getAccess: getAccess,
        getBootstrap: function (user) { return { access: getAccess(user), ui: getUiSettings(), approvalAvailable: !!(approvalBus.service && typeof approvalBus.service.submit === "function"), approvalCenterInstallUrl: approvalInstallUrl }; },
        getSettings: function (user) {
            if (!isSiteAdmin(user)) return null;
            var ui = getUiSettings();
            return { accessGroupIds: getAccessGroups(), groups: getUserGroups(parent), folders: rootFolderSettings(), credentialsEnabled: false, showInMenu: ui.showInMenu, showOnDevice: ui.showOnDevice };
        },
        saveSettings: function (user, values, callback) {
            if (!isSiteAdmin(user)) { callback("Only Site Admin can change settings."); return; }
            values = values || {};
            var groupIds = values.groupIds;
            if (typeof groupIds === "string") { try { groupIds = JSON.parse(groupIds); } catch (error) { groupIds = [groupIds]; } }
            groupIds = Array.isArray(groupIds) ? groupIds : (values.groupId ? [values.groupId] : []);
            groupIds = groupIds.map(function (id) { return String(id || "").trim(); }).filter(Boolean);
            var knownGroups = getUserGroups(parent).map(function (group) { return group.id; });
            if (groupIds.some(function (id) { return knownGroups.indexOf(id) < 0; })) { callback("The selected user group does not exist."); return; }
            var folderPermissions = values.folderPermissionsJson;
            if (typeof folderPermissions === "string") { try { folderPermissions = JSON.parse(folderPermissions); } catch (error) { callback("Invalid folder permission data."); return; } }
            folderPermissions = folderPermissions && typeof folderPermissions === "object" && !Array.isArray(folderPermissions) ? folderPermissions : {};
            var normalizedFolders = {};
            rootFolderSettings().forEach(function (folder) {
                var ids = folderPermissions[folder.path]; ids = Array.isArray(ids) ? ids : (ids ? [ids] : []);
                normalizedFolders[folder.path] = ids.map(String).filter(function (id, index, list) { return knownGroups.indexOf(id) >= 0 && list.indexOf(id) === index; });
            });
            try { writeJson(settingsPath, { showInMenu: asBoolean(values.showInMenu, clientConfig.defaultShowInMenu), showOnDevice: asBoolean(values.showOnDevice, clientConfig.defaultShowOnDevice) }); }
            catch (error) { callback("Could not save My Commands settings (" + String(error.code || error.message || error) + ")."); return; }
            try { saveFolderPermissions(normalizedFolders); }
            catch (error) { callback("Could not save folder permissions (" + String(error.code || error.message || error) + ")."); return; }
            if (!parent || typeof parent.setPluginPermissions !== "function") { callback("MeshCentral does not expose the plugin permission API."); return; }
            parent.setPluginPermissions(clientConfig.shortName, { defaults: { access: "denied" }, permissions: { access: permissionData(groupIds) } }, callback);
        },
        getCatalog: function (user) { return getAccess(user).pluginAllowed ? publicCatalog() : null; },
        getScripts: function (user) { return getAccess(user).scriptsAllowed ? scriptsTreeForUser(user) : null; },
        getOutput: function (user, responseId) {
            cleanOutputs();
            var item = outputs[String(responseId || "")];
            if (!item) return { ready: false, output: "" };
            if (!isSiteAdmin(user) && item.userId && item.userId !== String(user && user._id || "")) return null;
            return { ready: item.ready === true, output: item.output || "" };
        },
        executeDirect: executeDirect,
        captureAgentData: captureAgentData,
        submitApproval: function (user, request, note) {
            if (!approvalBus.service || typeof approvalBus.service.submit !== "function") return Promise.reject(new Error("Approval Center is not installed. Install it from: " + approvalInstallUrl));
            return approvalBus.service.submit("mycommands", user, normalizeApprovalSpec(request), note);
        },
        handleServerAction: function (request, myparent, grandparent, callback) {
            var user = myparent && myparent.user;
            var serverSpec = { pluginaction: request.pluginaction, commandId: request.commandId, scriptPath: request.scriptPath, type: request.type, runAsUser: request.runAsUser, cmds: request.cmds, variableValues: (function () { try { var value = JSON.parse(String(request.variableValues || "{}")); return value && typeof value === "object" ? value : {}; } catch (error) { return {}; } }()) };
            try { authorizeSpec(user, serverSpec); } catch (error) { callback(error.message); return; }
            var built = buildRequestedCommand(serverSpec);
            if (built.error) { callback(built.error); return; }
            var domain = getDomain(user, myparent && myparent.domain);
            var webServer = grandparent && typeof grandparent.GetNodeWithRights === "function" ? grandparent : getWebServer();
            if (!domain || !webServer) { callback("MeshCentral device API is unavailable."); return; }
            var responseId = String(request.responseid || "");
            if (responseId.indexOf("mycommands-") !== 0) { callback("Invalid response identifier."); return; }
            sendToAgent(request.nodeid, built.command, user, domain, webServer, myparent && myparent.ws && myparent.ws.sessionId, responseId, callback);
        }
    };
};
