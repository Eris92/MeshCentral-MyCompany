"use strict";

var shared = require("../../core/shared.js");
var libraryFactory = require("../../core/script-confirmation-library.js");
var adminFactory = require("../../core/script-admin-service.js");
var folderAccess = require("../../core/folder-access.js");

module.exports.createModule = function (context) {
    var root = context.path.join(context.pluginRoot, "seed", "MyCommands");
    var resultsPath = context.path.join(context.dataRoot, "mycommands", "results.json");
    var library = libraryFactory.createScriptLibrary({ fs: context.fs, path: context.path, root: root, readOnly: true, allowWrite: true });
    var admin = adminFactory.createScriptAdminService({ context: context, library: library, namespace: "script-secrets.mycommands" });
    var unregister = null;

    var catalog = {
        network: {
            key: "network", title: "Network", icon: "🌐", commands: [
                { id: "flushdns", label: "Flush DNS", description: "Clear the DNS client cache.", type: 1, runAsUser: 0, cmd: "ipconfig /flushdns" },
                { id: "dns", label: "Check DNS", description: "Resolve a DNS name.", type: 2, runAsUser: 0, variables: [{ name: "name", label: "DNS name", required: true, control: "text", defaultValue: "" }], cmd: "Resolve-DnsName -Name $name | Format-Table -AutoSize" },
                { id: "port", label: "Check port", description: "Test a TCP or UDP port.", type: 2, runAsUser: 0, variables: [{ name: "hostName", label: "Host name or IP", required: true, control: "text", defaultValue: "" }, { name: "port", label: "Port", required: true, control: "text", defaultValue: "443" }, { name: "protocol", label: "Protocol", required: true, control: "select", defaultValue: "TCP", options: [{ value: "TCP", label: "TCP" }, { value: "UDP", label: "UDP" }] }], cmd: "if ($protocol -eq 'UDP') { $client=New-Object Net.Sockets.UdpClient; try { $client.Connect($hostName,[int]$port); $bytes=[Text.Encoding]::UTF8.GetBytes('MyCommands UDP probe'); [void]$client.Send($bytes,$bytes.Length); 'UDP datagram sent to {0}:{1}' -f $hostName,$port } finally { $client.Dispose() } } else { Test-NetConnection -ComputerName $hostName -Port ([int]$port) -InformationLevel Detailed }" },
                { id: "netstat", label: "Open ports", description: "Show listening ports and active connections.", type: 1, runAsUser: 0, cmd: "netstat -ano" },
                { id: "netstat-port", label: "Filter by port", description: "Filter netstat output by port.", type: 1, runAsUser: 0, variables: [{ name: "port", label: "Port", required: true, control: "text", defaultValue: "443" }], cmd: "netstat -ano | findstr /R /C:\":%port%[ ]\"" }
            ]
        },
        system: {
            key: "system", title: "System", icon: "⚙", commands: [
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
            key: "other", title: "Other", icon: "◆", commands: [
                { id: "printers", label: "Printer Management", description: "Open printer management.", type: 1, runAsUser: 2, cmd: "start \"\" printmanagement.msc" },
                { id: "certlm", label: "Certificates (computer)", description: "Open local computer certificates.", type: 1, runAsUser: 2, cmd: "start \"\" certlm.msc" },
                { id: "certcu", label: "Certificates (user)", description: "Open current user certificates.", type: 1, runAsUser: 2, cmd: "start \"\" certmgr.msc" },
                { id: "indexing", label: "Indexing Options", description: "Open Indexing Options.", type: 1, runAsUser: 2, cmd: "start \"\" control.exe /name Microsoft.IndexingOptions" },
                { id: "cleanup", label: "Disk Cleanup", description: "Open Disk Cleanup.", type: 1, runAsUser: 2, cmd: "start \"\" cleanmgr.exe" }
            ]
        }
    };

    function allowed(user) {
        if (!user) return false;
        if (shared.isSiteAdmin(user)) return true;
        var groups = (context.settings.read().modules.mycommands || {}).accessGroupIds;
        groups = Array.isArray(groups) ? groups : [];
        return !groups.length || shared.isUserInAnyGroup(user, groups);
    }
    function folderRules() { return (context.settings.read().modules.mycommands || {}).folderPermissions || {}; }
    function folderKeys() { return ["@menu/scripts"].concat(Object.keys(catalog).map(function (key) { return "@menu/" + key; })); }
    function canUseScripts(user) { return folderAccess.canAccess(user, folderRules(), "@menu/scripts"); }
    function requireScriptAccess(user) { if (!canUseScripts(user)) throw new Error("Folder access denied."); }
    function requireCommandAccess(user, commandId) {
        var found = findCatalogCommand(commandId);
        if (!found || !folderAccess.canAccess(user, folderRules(), "@menu/" + found.category.key)) throw new Error("Folder access denied.");
        return found;
    }
    function visibleTree(user) {
        var value = library.getTree();
        if (!canUseScripts(user)) value.children = [];
        return value;
    }
    function visibleCatalog(user) {
        return publicCatalog().filter(function (category) { return folderAccess.canAccess(user, folderRules(), "@menu/" + category.key); });
    }
    function folderSettings() {
        var rules = folderRules();
        return [{ key: "@menu/scripts", label: "Scripts", locales: { pl: { label: "Skrypty" }, en: { label: "Scripts" } } }].concat(Object.keys(catalog).map(function (key) {
            return { key: "@menu/" + key, label: catalog[key].title, locales: catalog[key].locales || {} };
        })).map(function (item) {
            var rule = rules[item.key];
            item.enabled = !rule || rule.enabled !== false;
            item.allowAll = !!(rule && rule.allowAll === true);
            item.groupIds = rule && Array.isArray(rule.groupIds) ? rule.groupIds : [];
            return item;
        });
    }
    function requireAdmin(user) { if (!shared.isSiteAdmin(user)) throw new Error("Permission denied."); }
    function allowNoApproval() {
        var current = context.settings.read();
        var provider = current.modules && current.modules.approvalcenter && current.modules.approvalcenter.providers && current.modules.approvalcenter.providers.mycommands || {};
        return provider.allowNoApproval === true;
    }
    function approvalLevels(levels) {
        levels = Array.isArray(levels) ? levels.map(Number) : [];
        levels = [1, 2, 3].filter(function (level) { return levels.indexOf(level) >= 0; });
        if (!levels.length && !allowNoApproval()) levels = [1];
        return levels;
    }
    function executionRows() { var value = shared.readJson(context.fs, resultsPath, { rows: [] }); return Array.isArray(value.rows) ? value.rows : []; }
    function writeRows(rows) { shared.writeJsonAtomic(context.fs, context.path, resultsPath, { schemaVersion: 1, rows: rows }); }
    function saveExecution(row) { var rows = executionRows(); rows.unshift(row); if (rows.length > 2000) rows.length = 2000; writeRows(rows); }

    function findCatalogCommand(commandId) {
        commandId = String(commandId || "");
        var keys = Object.keys(catalog);
        for (var index = 0; index < keys.length; index++) {
            var category = catalog[keys[index]];
            var command = (category.commands || []).find(function (item) { return item.id === commandId; });
            if (command) return { category: category, command: command };
        }
        return null;
    }

    function publicVariables(variables) {
        return (variables || []).map(function (variable) {
            return {
                name: variable.name,
                label: variable.label,
                required: variable.required === true,
                control: variable.control || "text",
                defaultValue: variable.defaultValue == null ? "" : String(variable.defaultValue),
                options: (variable.options || []).map(function (option) {
                    return typeof option === "string" ? { value: option, label: option } : { value: String(option.value), label: String(option.label || option.value) };
                })
            };
        });
    }

    function publicCatalog() {
        return Object.keys(catalog).map(function (key) {
            var category = catalog[key];
            return {
                key: category.key,
                title: category.title,
                icon: category.icon,
                commands: category.commands.map(function (command) {
                    var levels = approvalLevels([]);
                    return { id: command.id, label: command.label, description: command.description, variables: publicVariables(command.variables), approvalLevels: levels, requiresApproval: levels.length > 0, runAsUser: command.runAsUser };
                })
            };
        });
    }

    function cleanValue(value, limit) { return shared.cleanText(value == null ? "" : value, limit || 4000); }
    function validateVariables(definitions, supplied) {
        supplied = supplied && typeof supplied === "object" && !Array.isArray(supplied) ? supplied : {};
        var result = {};
        (definitions || []).forEach(function (definition) {
            var value = Object.prototype.hasOwnProperty.call(supplied, definition.name) ? supplied[definition.name] : definition.defaultValue;
            if (definition.control === "switch") value = /^(1|true|yes|tak|on)$/i.test(String(value || "")) ? "true" : "false";
            else value = cleanValue(value, 4000);
            if (definition.control === "select") {
                var options = (definition.options || []).map(function (option) { return String(option.value == null ? option : option.value); });
                if (options.length && options.indexOf(String(value)) < 0) throw new Error("Invalid value for " + (definition.label || definition.name) + ".");
            }
            if (definition.required && !String(value).trim()) throw new Error((definition.label || definition.name) + " is required.");
            result[definition.name] = value;
        });
        return result;
    }
    function psQuote(value) { return String(value == null ? "" : value).replace(/'/g, "''"); }
    function cmdQuote(value) { return String(value == null ? "" : value).replace(/[\r\n]/g, " ").replace(/%/g, "%%").replace(/\^/g, "^^").replace(/!/g, "^^!").replace(/"/g, "^\""); }
    function injectVariables(commandText, type, definitions, supplied, secretValues) {
        var values = validateVariables(definitions, supplied);
        Object.keys(secretValues || {}).forEach(function (name) { values[name] = String(secretValues[name] == null ? "" : secretValues[name]); });
        var names = Object.keys(values).filter(function (name) { return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name); });
        if (Number(type) === 2) return names.map(function (name) { return "$" + name + "='" + psQuote(values[name]) + "'"; }).join(";") + (names.length ? ";" : "") + commandText;
        return (names.length ? "@echo off\r\n" + names.map(function (name) { return "set \"" + name + "=" + cmdQuote(values[name]) + "\""; }).join("\r\n") + "\r\n" : "") + commandText;
    }

    function buildCommand(payload) {
        if (payload.scriptPath) {
            var script = library.getScript(payload.scriptPath, true);
            if (!script) throw new Error("Script not found.");
            if (payload.scriptHash && String(payload.scriptHash) !== String(script.hash)) throw new Error("The script changed after submission and was not executed.");
            var type = script.shell === "cmd" ? 1 : 2;
            return { label: script.label || script.name, cmd: injectVariables(script.body, type, script.variables || [], payload.variableValues, admin.secretValues(script.path)), type: type, runAsUser: Number(script.runAsUser) || 0 };
        }
        if (payload.commandId) {
            var found = findCatalogCommand(payload.commandId);
            if (!found) throw new Error("Command preset not found.");
            return { label: found.command.label, cmd: injectVariables(found.command.cmd, found.command.type, found.command.variables || [], payload.variableValues, null), type: Number(found.command.type) || 1, runAsUser: Number(found.command.runAsUser) || 0 };
        }
        var custom = String(payload.command || "");
        if (!custom) throw new Error("Command is empty.");
        return { label: payload.label || "Custom command", cmd: custom, type: Number(payload.type) || 2, runAsUser: Number(payload.runAsUser) || 0 };
    }

    function normalizePayload(payload) {
        payload = shared.copy(payload || {});
        payload.variableValues = payload.variableValues && typeof payload.variableValues === "object" && !Array.isArray(payload.variableValues) ? payload.variableValues : {};
        if (payload.scriptPath) {
            var script = library.getScript(payload.scriptPath, true);
            if (!script) throw new Error("Script not found.");
            if (script.confirmExecution === true && payload.confirmedExecution !== true) throw new Error("Execution confirmation is required for this script.");
            payload.scriptPath = script.path;
            payload.scriptHash = script.hash;
            payload.label = script.label || script.name;
            payload.description = script.description || "";
            payload.approvalLevels = approvalLevels(script.approvalLevels || []);
            payload.confirmedExecution = script.confirmExecution === true;
            delete payload.command;
            delete payload.commandId;
            return payload;
        }
        if (payload.commandId) {
            var found = findCatalogCommand(payload.commandId);
            if (!found) throw new Error("Command preset not found.");
            payload.commandId = found.command.id;
            payload.label = found.command.label;
            payload.description = found.command.description;
            payload.approvalLevels = approvalLevels([]);
            payload.confirmedExecution = false;
            delete payload.command;
            delete payload.scriptPath;
            return payload;
        }
        payload.approvalLevels = approvalLevels(payload.approvalLevels || []);
        return payload;
    }

    function execute(payload, request) {
        var user = shared.findUser(context.parent, request.requester && request.requester.id) || { _id: request.requester && request.requester.id, name: request.requester && request.requester.name };
        var command;
        try {
            if (payload.scriptPath) requireScriptAccess(user);
            if (payload.commandId) requireCommandAccess(user, payload.commandId);
            command = buildCommand(payload);
        } catch (error) { return Promise.reject(error); }
        return context.device.resolveNode(user, payload.nodeId, { requireCommandRights: true }).then(function (node) {
            var id = "sirk-platform-" + shared.randomId(10);
            return context.device.sendRunCommands(node, command, id, null).then(function (state) {
                var row = { id: id, requestId: request.id || "", nodeId: node.nodeId, nodeName: node.node && node.node.name || payload.nodeName || payload.nodeId, command: command.label, status: state.state, requester: request.requester, createdAt: Date.now(), updatedAt: Date.now(), output: "" };
                saveExecution(row);
                context.device.auditCommand(node, user, command);
                return row;
            });
        });
    }

    function outputForUser(user, id) {
        var row = executionRows().find(function (item) { return String(item.id) === String(id || ""); });
        if (!row) return { ok: true, ready: false, missing: true, output: "", status: "missing" };
        if (!shared.isSiteAdmin(user) && String(row.requester && row.requester.id || "") !== String(user && user._id || "")) throw new Error("Permission denied.");
        var ready = !!row.output || ["completed", "failed", "error"].indexOf(String(row.status || "").toLowerCase()) >= 0;
        return { ok: true, ready: ready, output: row.output || "", status: row.status || "", row: shared.copy(row) };
    }

    function approvalResults(user, query) {
        query = query || {};
        return context.approval.list(user, { type: "mycommands", status: query.status || "", q: query.q || "", page: Number(query.page) || 1, perPage: Math.min(200, Number(query.perPage) || 100) }).then(function (value) {
            var byId = Object.create(null);
            executionRows().forEach(function (row) { byId[String(row.id || "")] = row; });
            value.rows = (value.rows || []).filter(function (request) {
                var payload = request && request.payload || {};
                if (payload.scriptPath) return canUseScripts(user);
                if (payload.commandId) {
                    var found = findCatalogCommand(payload.commandId);
                    return !!found && folderAccess.canAccess(user, folderRules(), "@menu/" + found.category.key);
                }
                return true;
            }).map(function (request) { var id = request.result && request.result.id; if (id && byId[String(id)]) request.result = shared.copy(byId[String(id)]); return request; });
            value.ok = true;
            return value;
        });
    }

    function nodeIds(value) {
        var list = Array.isArray(value) ? value : String(value || "").split(/[\r\n,;]+/), seen = Object.create(null);
        return list.map(function (id) { return String(id || "").trim(); }).filter(function (id) { if (!id || seen[id]) return false; seen[id] = true; return true; });
    }

    function multiExecute(user, value) {
        value = value || {};
        requireScriptAccess(user);
        var settings = context.settings.read().modules.mycommands || {};
        var maxMultiHostNodes = Math.max(1, Math.min(1000, Number(settings.maxMultiHostNodes) || 200));
        var multiHostConcurrency = Math.max(1, Math.min(64, Number(settings.multiHostConcurrency) || 8));
        var ids = nodeIds(value.nodeIds);
        if (!ids.length && value.nodeId) ids = [String(value.nodeId)];
        if (!ids.length) throw new Error("Select at least one device.");
        if (ids.length > maxMultiHostNodes) throw new Error("A maximum of " + maxMultiHostNodes + " devices can be selected.");
        var script = library.getScript(value.scriptPath, true);
        if (!script) throw new Error("Script not found.");
        if (script.multiHost !== true) throw new Error("This script does not allow multi-device execution.");
        if (script.confirmExecution === true && value.confirmedExecution !== true) throw new Error("Execution confirmation is required for this script.");
        var cursor = 0, rows = [];
        function worker() {
            if (cursor >= ids.length) return Promise.resolve();
            var id = ids[cursor++];
            return context.approval.submit("mycommands", user, { nodeId: id, scriptPath: script.path, nodeName: id, variableValues: value.variableValues || {}, multiHost: true, confirmedExecution: script.confirmExecution === true }, value.note).then(function (request) {
                rows.push({ nodeId: id, ok: true, request: request });
            }).catch(function (error) {
                rows.push({ nodeId: id, ok: false, error: String(error && error.message || error) });
            }).then(worker);
        }
        var workers = [];
        for (var index = 0; index < Math.min(multiHostConcurrency, ids.length); index++) workers.push(worker());
        return Promise.all(workers).then(function () {
            var failed = rows.filter(function (row) { return !row.ok; }).length;
            var pending = rows.filter(function (row) { return row.ok && row.request && row.request.status === "pending"; }).length;
            return { ok: failed === 0, total: ids.length, submitted: rows.length - failed, pending: pending, failed: failed, rows: rows };
        });
    }

    var provider = {
        type: "mycommands", moduleKey: "mycommands", title: "My Commands", tabTitle: "Commands", description: "Direct and multi-device command execution.", columns: ["createdAt", "title", "requester", "status"], normalizePayload: normalizePayload,
        getTitle: function (payload) { return payload.label || payload.scriptPath || payload.commandId || "Command"; },
        getSummary: function (payload) { return "Device: " + (payload.nodeName || payload.nodeId || "unknown"); },
        getApprovalLevels: function (payload) { return payload.approvalLevels || []; },
        canSubmit: allowed,
        getResources: function (user, query) {
            if (query && query.scriptPath) requireScriptAccess(user);
            var script = query && query.scriptPath ? library.getScript(query.scriptPath, true) : null;
            return { tree: visibleTree(user), catalog: visibleCatalog(user), script: script || null };
        },
        execute: execute
    };

    return {
        key: "mycommands",
        clientConfig: function () {
            var value = context.settings.read().modules.mycommands || {};
            return { key: "mycommands", name: "My Commands", menuTitle: "My Commands", script: "mycommands.js", style: "myscripts.css", showInMenu: false, showOnDevice: value.showOnDevice !== false, scriptsRoot: root, maxMultiHostNodes: Number(value.maxMultiHostNodes) || 200, multiHostConcurrency: Number(value.multiHostConcurrency) || 8, toolbar: { refresh: true, clear: false, favorites: true, search: true, manage: true, multiHost: true, settings: false } };
        },
        getAccess: function (user) { return { allowed: allowed(user), siteAdmin: shared.isSiteAdmin(user) }; },
        initialize: function () { library.ensure(); if (!unregister) unregister = context.approval.registerProvider(provider); return Promise.resolve(); },
        captureAgentData: function (command) {
            var id = command && (command.responseid || command.responseId);
            if (!id) return;
            var rows = executionRows();
            var row = rows.find(function (item) { return item.id === id; });
            if (!row) return;
            var output = command.value != null ? command.value : command.result != null ? command.result : command.stdout != null ? command.stdout : command.output;
            row.status = String(command.status || command.state || "completed");
            row.output = shared.cleanText(output == null ? "" : output, 1000000);
            row.updatedAt = Date.now();
            writeRows(rows);
        },
        apiGet: function (asset, req, user) {
            if (!allowed(user)) throw new Error("Permission denied.");
            var query = req && req.query || {};
            if (asset === "scripts") return { ok: true, tree: visibleTree(user), catalog: visibleCatalog(user), scriptsRoot: shared.isSiteAdmin(user) ? root : "" };
            if (asset === "catalog") return { ok: true, catalog: visibleCatalog(user) };
            if (asset === "script") { requireScriptAccess(user); var script = library.getScript(query.path, true); if (!script) throw new Error("Script not found."); return { ok: true, script: script }; }
            if (asset === "source") { requireAdmin(user); requireScriptAccess(user); var source = library.getSource(query.path); if (!source) throw new Error("Script not found."); return { ok: true, source: source }; }
            if (asset === "definition") { requireScriptAccess(user); return { ok: true, definition: admin.getDefinition(user, query.path) }; }
            if (asset === "script-secrets") { requireScriptAccess(user); return { ok: true, secrets: admin.getSecretState(user, query.path) }; }
            if (asset === "system-credentials") { requireScriptAccess(user); return { ok: true, systemCredentials: admin.getSystemCredentialState(user, query.path) }; }
            if (asset === "output") return outputForUser(user, query.id);
            if (asset === "results") return approvalResults(user, query);
            if (asset === "settings") return { ok: true, settings: context.settings.read().modules.mycommands || {}, scriptsRoot: root };
            throw new Error("Unknown My Commands action.");
        },
        apiPost: function (asset, req, user) {
            if (!allowed(user)) throw new Error("Permission denied.");
            var value = req && req.body || {};
            if (asset === "execute") {
                if (value.scriptPath) requireScriptAccess(user);
                if (value.commandId) requireCommandAccess(user, value.commandId);
                return context.approval.submit("mycommands", user, value, value.note).then(function (request) { return { ok: true, request: request }; });
            }
            if (asset === "multi-execute") return multiExecute(user, value);
            if (asset === "refresh") { library.invalidate(); return { ok: true, tree: visibleTree(user), catalog: visibleCatalog(user) }; }
            if (asset === "source") { requireAdmin(user); requireScriptAccess(user); return { ok: true, script: library.saveSource(value.path, value.text), tree: visibleTree(user) }; }
            if (asset === "definition") { requireScriptAccess(user); var saved = admin.saveDefinition(user, value.path, value.definition); saved.ok = true; saved.tree = visibleTree(user); return saved; }
            if (asset === "script-secrets") { requireScriptAccess(user); return { ok: true, secrets: admin.saveSecrets(user, value.path, value.values, value.clearNames) }; }
            if (asset === "system-credentials") { requireScriptAccess(user); return { ok: true, systemCredentials: admin.saveSystemCredentials(user, value.path, value.selected) }; }
            if (asset === "settings") {
                requireAdmin(user);
                return context.settings.update(function (current) {
                    var config = current.modules.mycommands;
                    config.showInMenu = false;
                    config.showOnDevice = value.showOnDevice !== false;
                    config.accessGroupIds = Array.isArray(value.accessGroupIds) ? value.accessGroupIds.map(String) : [];
                    config.folderPermissions = folderAccess.normalizeRules(value.folderPermissions, folderKeys(), shared.getUserGroups(context.parent).map(function (group) { return group.id; }));
                    config.maxMultiHostNodes = Math.max(1, Math.min(1000, Number(value.maxMultiHostNodes) || 200));
                    config.multiHostConcurrency = Math.max(1, Math.min(64, Number(value.multiHostConcurrency) || 8));
                    return current;
                }).then(function () { return { ok: true }; });
            }
            throw new Error("Unknown My Commands action.");
        },
        getFolderSettings: folderSettings
    };
};
