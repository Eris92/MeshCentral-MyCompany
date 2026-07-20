"use strict";

var childProcess = require("child_process");
var crypto = require("crypto");
var core = require("./core.js");

function cleanText(value, limit) { return String(value == null ? "" : value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").slice(0, limit || 1000); }
function asBoolean(value) { return /^(1|y|yes|t|tak|true)$/i.test(String(value == null ? "" : value).trim()); }
function copy(value) { return JSON.parse(JSON.stringify(value)); }

module.exports.createModule = function (config, parent, source) {
    var fs = parent.fs, path = parent.path;
    var root = path.join(parent.pluginPath, "myscripts");
    var scriptsRoot = path.join(root, "scripts");
    var dataRoot = path.join(root, "data");
    var settingsRoot = path.join(root, "settings");
    var folderPermissionsPath = path.join(dataRoot, "folder-permissions.json");
    var credentialsStore = core.createProtectedJsonStore(fs, path, path.join(dataRoot, "credentials.json"));
    var scriptSecretsStore = core.createProtectedJsonStore(fs, path, path.join(dataRoot, "script-secrets.json"));
    var bus = core.ensureApprovalBus(parent);
    var executionQueue = Promise.resolve();
    var scriptCache = Object.create(null);
    var treeCache = { value: null, expiresAt: 0 };
    var userChoicesCache = { mtimeMs: -1, size: -1, value: null };
    var installUrl = "https://raw.githubusercontent.com/Eris92/MeshCentral-ApprovalCenter/main/config.json";
    var allowedExtensions = { ".ps1": "powershell", ".cmd": "cmd", ".bat": "cmd" };
    var iconTypes = { ".svg": "image/svg+xml; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" };
    var clientConfig = {
        name: String(config.name || "My Scripts"), shortName: "myscripts", version: String(config.version || "1.9.7"),
        viewMode: Number(config.viewmode) || 101, pageText: String(config.pageText || "My Scripts"),
        leftMenuAsset: String(config.leftMenuIcon || "assets/LeftMenu.svg").replace(/\\/g, "/").split("/").pop(),
        credentialsEnabled: config.credentialsEnabled !== false,
        runTimeoutMs: Math.max(30, Math.min(3600, Number(config.runTimeoutSeconds) || 600)) * 1000,
        approvalCenterInstallUrl: installUrl
    };

    function ensureStorage() { fs.mkdirSync(dataRoot, { recursive: true }); fs.mkdirSync(scriptsRoot, { recursive: true }); }
    function getFolderPermissions() { ensureStorage(); var value = core.readJson(fs, folderPermissionsPath, {}); return value && typeof value === "object" ? value : {}; }
    function saveFolderPermissions(value) {
        ensureStorage(); var temporary = folderPermissionsPath + "." + process.pid + ".tmp";
        fs.writeFileSync(temporary, JSON.stringify(value || {}, null, 2), "utf8");
        try { fs.renameSync(temporary, folderPermissionsPath); } catch (error) { fs.copyFileSync(temporary, folderPermissionsPath); fs.unlinkSync(temporary); }
    }
    function stringValue(value, limit) { return cleanText(value == null ? "" : value, limit || 4000).trim(); }
    function getCredentials() { ensureStorage(); var value = credentialsStore.read(); return value && value.credentials && typeof value.credentials === "object" ? value.credentials : {}; }
    function getScriptSecrets() { ensureStorage(); var value = scriptSecretsStore.read(); return value && value.scripts && typeof value.scripts === "object" ? value.scripts : {}; }
    function scriptSecretValues(scriptPath) { var all = getScriptSecrets(), value = all[String(scriptPath || "").replace(/\\/g, "/").toLowerCase()]; return value && typeof value === "object" ? value : {}; }
    function saveCredentials(values) {
        var current = getCredentials(), next = Object.assign({}, current);
        ["adDomain", "adLogin", "adPassword", "entraTenantId", "entraClientId", "entraClientSecret", "jiraUrl", "jiraLogin", "jiraToken"].forEach(function (key) { if (values && Object.prototype.hasOwnProperty.call(values, key) && stringValue(values[key])) next[key] = stringValue(values[key]); });
        var store = credentialsStore.read(); store.credentials = next; credentialsStore.save(store); return true;
    }
    function saveScriptSecrets(scriptPath, values) {
        var script = readScript(scriptPath, false); if (!script) throw new Error("Script not found.");
        var allowed = {}; (script.secretVariables || []).forEach(function (item) { if (values && stringValue(values[item.name])) allowed[item.name] = stringValue(values[item.name]); });
        var all = getScriptSecrets(); all[String(script.path).replace(/\\/g, "/").toLowerCase()] = allowed; scriptSecretsStore.save({ scripts: all }); return true;
    }

    function credentialEnvironment() {
        var credentials = getCredentials();
        return {
            MYSCRIPTS_AD_DOMAIN: credentials.adDomain || "", MYSCRIPTS_AD_LOGIN: credentials.adLogin || "", MYSCRIPTS_AD_PASSWORD: credentials.adPassword || "",
            MYSCRIPTS_ENTRA_TENANT_ID: credentials.entraTenantId || "", MYSCRIPTS_ENTRA_CLIENT_ID: credentials.entraClientId || "", MYSCRIPTS_ENTRA_CLIENT_SECRET: credentials.entraClientSecret || "",
            MYSCRIPTS_JIRA_URL: credentials.jiraUrl || "", MYSCRIPTS_JIRA_LOGIN: credentials.jiraLogin || "", MYSCRIPTS_JIRA_TOKEN: credentials.jiraToken || ""
        };
    }

    function selectUserChoices(value, query, limit) {
        query = stringValue(query, 300).toLowerCase(); limit = Math.max(1, Math.min(500, Number(limit) || value.choices.length));
        var choices = value.choices;
        if (query) choices = choices.filter(function (item) { return (item.label + " " + item.value).toLowerCase().indexOf(query) >= 0; });
        return { choices: copy(choices.slice(0, limit)), generatedAt: value.generatedAt, total: choices.length };
    }

    function readUserChoices(user, query, limit) {
        if (!getAccess(user).allowed) throw new Error("You do not have access to My Scripts.");
        var filePath = path.join(settingsRoot, "users_list.json"), parsed, stat;
        try { stat = fs.statSync(filePath); } catch (error) { throw new Error("User list is unavailable. Run Update user list first."); }
        if (userChoicesCache.value && userChoicesCache.mtimeMs === stat.mtimeMs && userChoicesCache.size === stat.size) return selectUserChoices(userChoicesCache.value, query, limit);
        try { parsed = JSON.parse(String(fs.readFileSync(filePath, "utf8") || "").replace(/^\uFEFF/, "")); }
        catch (error) { throw new Error("User list is unavailable. Run Update user list first."); }
        var rows = Array.isArray(parsed) ? parsed : (parsed && (parsed.Users || parsed.users || parsed.value || parsed.data));
        if (!Array.isArray(rows)) throw new Error("User list has an invalid format. Run Update user list again.");
        var choices = [], seen = Object.create(null);
        rows.slice(0, 10000).forEach(function (row) {
            if (!row) return;
            if (typeof row === "string") row = { DisplayName: row };
            var display = stringValue(row.DisplayName || row.displayName || row.RealName || row.realName || row.Name || row.name, 300);
            var login = stringValue(row.Login || row.login || row.UserPrincipalName || row.userPrincipalName || row.UPN || row.upn || row.EmailAddress || row.email || row.Username || row.username, 300);
            var value = display || login; if (!value) return;
            var key = value.toLowerCase(); if (seen[key]) return; seen[key] = true;
            choices.push({ value: value, label: display && login && display.toLowerCase() !== login.toLowerCase() ? display + " (" + login + ")" : value });
        });
        choices.sort(function (a, b) { return a.label.localeCompare(b.label, "pl", { sensitivity: "base" }); });
        userChoicesCache = { mtimeMs: stat.mtimeMs, size: stat.size, value: { choices: choices, generatedAt: String(parsed && parsed.GeneratedAt || "") } };
        return selectUserChoices(userChoicesCache.value, query, limit);
    }

    function meshUserDisplayName(user) {
        if (!user || typeof user !== "object") return "";
        return stringValue(user.realname || user.realName || user.displayName || user.displayname || user.fullName || user.fullname || user.name || user.userid || user._id || user.id, 300);
    }

    function getMeshUsers(user) {
        if (!getAccess(user).allowed) return Promise.reject(new Error("You do not have access to My Scripts."));
        return new Promise(function (resolve) {
            var choices = [], seen = Object.create(null), current = meshUserDisplayName(user);
            function add(entry) {
                var value = typeof entry === "string" ? stringValue(entry, 300) : meshUserDisplayName(entry);
                var key = value.toLowerCase();
                if (!key || seen[key]) return;
                seen[key] = true;
                choices.push({ value: value, label: value });
            }
            function addCollection(collection) {
                if (!collection || typeof collection !== "object") return;
                if (Array.isArray(collection)) { collection.forEach(add); return; }
                Object.keys(collection).forEach(function (key) { add(collection[key]); });
            }
            function finish(databaseUsers) {
                add(user);
                if (Array.isArray(databaseUsers)) databaseUsers.forEach(add);
                try { addCollection(parent && parent.users); } catch (error) { }
                try { addCollection(parent && parent.parent && parent.parent.users); } catch (error) { }
                try { addCollection(parent && parent.parent && parent.parent.webserver && parent.parent.webserver.users); } catch (error) { }
                choices.sort(function (a, b) { return a.label.localeCompare(b.label, "pl", { sensitivity: "base" }); });
                resolve({ choices: choices.slice(0, 5000), current: current });
            }
            var db = parent && parent.db;
            if (!db || typeof db.GetAllType !== "function") { finish([]); return; }
            db.GetAllType("user", function (error, documents) { finish(!error && Array.isArray(documents) ? documents : []); });
        });
    }

    function findScriptFile(fileName) {
        var found = "";
        function walk(directory, depth) {
            if (found || depth > 12) return;
            var entries = []; try { entries = fs.readdirSync(directory, { withFileTypes: true }); } catch (error) { return; }
            for (var index = 0; index < entries.length && !found; index++) {
                var entry = entries[index];
                if (entry.name === ".git" || entry.name === "node_modules") continue;
                var target = path.join(directory, entry.name);
                if (entry.isDirectory()) walk(target, depth + 1);
                else if (entry.isFile() && entry.name.toLowerCase() === String(fileName).toLowerCase()) found = target;
            }
        }
        walk(scriptsRoot, 0); return found;
    }

    function readJsonLine(output) {
        var lines = String(output || "").replace(/^\uFEFF/, "").split(/\r?\n/).map(function (line) { return line.trim(); }).filter(Boolean);
        for (var index = lines.length - 1; index >= 0; index--) { try { return JSON.parse(lines[index]); } catch (error) { } }
        return null;
    }

    function getJiraAssets(user, userName) {
        if (!getAccess(user).allowed) return Promise.reject(new Error("You do not have access to My Scripts."));
        userName = stringValue(userName, 300); if (!userName) return Promise.reject(new Error("Select a Jira user first."));
        var credentials = getCredentials();
        if (!credentials.jiraUrl || !credentials.jiraLogin || !credentials.jiraToken) return Promise.reject(new Error("Configure Jira credentials in My Scripts settings first."));
        var helper = findScriptFile("DirectoryToolsJiraAssets.ps1");
        if (!helper) return Promise.reject(new Error("Jira assets helper is missing from the scripts directory."));
        var environment = Object.assign({}, process.env, credentialEnvironment(), { MYSCRIPTS_PLUGIN_ROOT: root, MYSCRIPTS_SCRIPTS_ROOT: scriptsRoot, DIRECTORYTOOLS_PLUGIN_ROOT: root });
        return new Promise(function (resolve, reject) {
            childProcess.execFile(powershellPath(), ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", helper, "-PluginRoot", root, "-UserName", userName], { cwd: root, env: environment, windowsHide: true, encoding: "utf8", timeout: clientConfig.runTimeoutMs, maxBuffer: 8 * 1024 * 1024 }, function (error, stdout, stderr) {
                var result = readJsonLine(stdout), details = cleanText(String(stderr || stdout || ""), 8000).trim();
                if (error && (!result || result.ok !== true)) { reject(new Error(result && result.error || details || error.message || "Could not load Jira assets.")); return; }
                if (!result || result.ok !== true) { reject(new Error(result && result.error || details || "Could not load Jira assets.")); return; }
                resolve({ assets: Array.isArray(result.assets) ? result.assets.slice(0, 1000) : [], user: result.user || userName });
            });
        });
    }
    function getPermissions() { return parent && typeof parent.getPluginPermissions === "function" ? parent.getPluginPermissions("myscripts") : null; }
    function getAccessGroups() { var permissions = getPermissions(), access = permissions && permissions.permissions && permissions.permissions.access, groups = access && access.allowed && access.allowed.userGroups; return Array.isArray(groups) ? groups.map(String) : []; }
    function folderGroupIds(relative) { var value = getFolderPermissions()[String(relative || "").split("/")[0]]; value = Array.isArray(value) ? value : (value ? [value] : []); return value.map(String).filter(Boolean); }
    function getAccess(user) { var siteAdmin = core.isSiteAdmin(user), allowed = siteAdmin; if (!allowed && user) allowed = rootFolderSettings().some(function (folder) { return folderGroupIds(folder.path).some(function (groupId) { return user.links && user.links[groupId] != null; }); }); return { allowed: allowed, siteAdmin: siteAdmin }; }

    function normalizePath(relativePath) {
        relativePath = String(relativePath || "").replace(/\\/g, "/");
        if (!relativePath || relativePath.indexOf("\0") >= 0 || relativePath.charAt(0) === "/" || relativePath.split("/").indexOf("..") >= 0) return null;
        var resolvedRoot = path.resolve(scriptsRoot), target = path.resolve(resolvedRoot, relativePath.replace(/\//g, path.sep));
        var prefix = resolvedRoot.endsWith(path.sep) ? resolvedRoot : resolvedRoot + path.sep;
        return target.toLowerCase().indexOf(prefix.toLowerCase()) === 0 ? target : null;
    }

    function parseVariable(text, required, control) {
        var parts = String(text || "").split(","), variable = String(parts.shift() || "").trim(), defaultValue = "";
        var match = variable.match(/^(.+?)\s*=\s*(.*)$/); if (match) { variable = match[1].trim(); defaultValue = match[2]; }
        if (control === "switch" && parts.length && /^(true|false|1|0|yes|no|tak|nie)$/i.test(String(parts[0]).trim())) defaultValue = String(parts.shift()).trim();
        var name = variable.replace(/^[\s$%]+/, "").trim(); if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) return null;
        var label = parts.join(",").trim() || name, options = [];
        if (control === "select") { var optionParts = label.split("|"); if (optionParts.length && optionParts[0].indexOf("=") < 0) label = String(optionParts.shift() || "").trim(); options = optionParts.map(function (item) { var pieces = item.split("="); return { value: String(pieces.shift() || "").trim(), label: String(pieces.join("=") || "").trim() || String(item).trim() }; }).filter(function (item) { return item.value; }); if (!defaultValue && options.length) defaultValue = options[0].value; }
        if (control === "switch") defaultValue = asBoolean(defaultValue) ? "true" : "false";
        return { name: name, label: label, required: required === true, control: control || "text", defaultValue: cleanText(defaultValue, 4000), options: options };
    }

    function parseScript(text, fileName) {
        var lines = String(text || "").replace(/^\uFEFF/, "").split(/\r?\n/), variables = [], secretVariables = [], label = path.basename(fileName, path.extname(fileName)), description = "", approvalFlags = {}, index = 0;
        while (index < lines.length) {
            var trimmed = String(lines[index] || "").trim();
            if (!trimmed) { index++; continue; }
            if (trimmed.charAt(0) !== "#") break;
            var header = trimmed.replace(/^\s*#\s*/, "");
            var approvalDirective = header.match(/^Approval(?:_([123]))?\s*:\s*(true|false)$/i);
            if (approvalDirective) { approvalFlags[Number(approvalDirective[1] || 1)] = approvalDirective[2].toLowerCase() === "true"; index++; continue; }
            var directive = header.match(/^(VariableSelectRequired|VariableSelect|VariableSwitchRequired|VariableSwitch|VariableUserRequired|VariableUser|VariableAssetRequired|VariableAsset|VariableRequired|Variable|SaveSecretRequired|SaveSecret)\s*:\s*(.+)$/i);
            if (directive) {
                var kind = directive[1].toLowerCase(), required = kind.indexOf("required") >= 0;
                var control = kind.indexOf("select") >= 0 ? "select" : (kind.indexOf("switch") >= 0 ? "switch" : (kind.indexOf("user") >= 0 ? "user" : (kind.indexOf("asset") >= 0 ? "asset" : (kind.indexOf("savesecret") >= 0 ? "secret" : "text"))));
                var parsed = parseVariable(directive[2], required, control);
                if (parsed) (control === "secret" ? secretVariables : variables).push(parsed);
            } else if (!description) {
                var separator = header.indexOf("|");
                if (separator >= 0) { label = header.slice(0, separator).trim() || label; description = header.slice(separator + 1).trim(); }
                else { label = header.trim() || label; }
            }
            index++;
        }
        var approvalLevels = [1, 2, 3].filter(function (level) { return approvalFlags[level] === true; });
        return { label: cleanText(label, 120), description: cleanText(description, 500), variables: variables, secretVariables: secretVariables, approvalLevels: approvalLevels, approval: approvalLevels.length > 0, body: lines.slice(index).join("\n") };
    }

    function readScript(relativePath, includeBody) {
        var target = normalizePath(relativePath); if (!target || !allowedExtensions[path.extname(target).toLowerCase()]) return null;
        var stat; try { stat = fs.statSync(target); } catch (error) { return null; }
        if (!stat.isFile() || stat.size > 2 * 1024 * 1024) return null;
        var cacheKey = target.toLowerCase(), cached = scriptCache[cacheKey];
        if (cached && cached.size === stat.size && cached.mtimeMs === stat.mtimeMs) {
            var cachedResult = copy(cached.value);
            if (!includeBody) delete cachedResult.body;
            return cachedResult;
        }
        var buffer = fs.readFileSync(target), text = buffer.toString("utf8").replace(/^\uFEFF/, ""), parsed = parseScript(text, target);
        var result = { type: "script", name: path.basename(target), path: String(relativePath).replace(/\\/g, "/"), shell: allowedExtensions[path.extname(target).toLowerCase()], label: parsed.label, description: parsed.description, variables: parsed.variables, secretVariables: parsed.secretVariables, approvalLevels: parsed.approvalLevels, requiresApproval: parsed.approval === true, hash: crypto.createHash("sha256").update(buffer).digest("hex"), size: stat.size, mtimeMs: stat.mtimeMs, body: parsed.body };
        scriptCache[cacheKey] = { size: stat.size, mtimeMs: stat.mtimeMs, value: result };
        result = copy(result); if (!includeBody) delete result.body; return result;
    }

    function folderIcon(relative, directory) {
        var base = path.basename(directory);
        var extensions = Object.keys(iconTypes);
        for (var index = 0; index < extensions.length; index++) {
            var candidate = path.join(directory, base + extensions[index]);
            try { if (fs.statSync(candidate).isFile()) return relative + "/" + base + extensions[index]; } catch (error) { }
        }
        return "";
    }
    function displayFolderName(name) { return String(name || "") === "settings" ? "Settings" : String(name || ""); }

    function rootFolderSettings() {
        ensureStorage(); var result = [], entries = [];
        try { entries = fs.readdirSync(scriptsRoot, { withFileTypes: true }); } catch (error) { return result; }
        var permissions = getFolderPermissions();
        entries.filter(function (entry) { return entry.isDirectory() && entry.name !== "_shared" && entry.name !== ".git" && entry.name !== "node_modules"; }).sort(function (a, b) { return a.name.localeCompare(b.name); }).forEach(function (entry) {
            var relative = entry.name.replace(/\\/g, "/");
            var assigned = permissions[relative]; assigned = Array.isArray(assigned) ? assigned.map(String).filter(Boolean) : (assigned ? [String(assigned)] : []);
            result.push({ path: relative, name: displayFolderName(entry.name), icon: folderIcon(relative, path.join(scriptsRoot, entry.name)), groupIds: assigned });
        });
        return result;
    }

    function folderAllowed(user, relative) {
        if (core.isSiteAdmin(user)) return true;
        var groups = folderGroupIds(relative);
        if (!groups.length) return false;
        return !!(user && groups.some(function (groupId) { return user.links && user.links[groupId] != null; }));
    }

    function filterTreeForUser(node, user) {
        if (!node) return node;
        var result = copy(node);
        result.children = (node.children || []).filter(function (child) { return child.type !== "directory" || folderAllowed(user, child.path); }).map(function (child) { return child.type === "directory" ? filterTreeForUser(child, user) : child; });
        return result;
    }

    function getTree(user) {
        if (!getAccess(user).allowed) return null;
        if (treeCache.value && treeCache.expiresAt > Date.now()) return filterTreeForUser(treeCache.value, user);
        ensureStorage();
        function walk(directory, relative, depth) {
            var node = { type: "directory", name: relative ? displayFolderName(path.basename(directory)) : "scripts", path: relative, icon: relative ? folderIcon(relative, directory) : "", children: [] };
            if (depth > 12) return node;
            var entries = []; try { entries = fs.readdirSync(directory, { withFileTypes: true }); } catch (error) { return node; }
            entries.sort(function (a, b) { if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1; return a.name.localeCompare(b.name); });
            entries.forEach(function (entry) {
                if (entry.name === ".git" || entry.name === "node_modules" || entry.name === "_shared") return;
                var childRelative = relative ? relative + "/" + entry.name : entry.name;
                if (entry.isDirectory()) node.children.push(walk(path.join(directory, entry.name), childRelative, depth + 1));
                else if (entry.isFile() && allowedExtensions[path.extname(entry.name).toLowerCase()]) { var script = readScript(childRelative, false); if (script) node.children.push(script); }
            });
            return node;
        }
        treeCache = { value: walk(scriptsRoot, "", 0), expiresAt: Date.now() + 5000 };
        return filterTreeForUser(treeCache.value, user);
    }

    function getIcon(relativePath) {
        var target = normalizePath(relativePath); if (!target) return null;
        var extension = path.extname(target).toLowerCase(); if (!iconTypes[extension]) return null;
        var folder = path.dirname(target), expected = path.basename(folder) + extension;
        if (path.basename(target).toLowerCase() !== expected.toLowerCase()) return null;
        try { var stat = fs.statSync(target); if (!stat.isFile() || stat.size > 1024 * 1024) return null; } catch (error) { return null; }
        return { path: target, type: iconTypes[extension] };
    }

    function validateValues(script, supplied, includeSecrets) {
        supplied = supplied && typeof supplied === "object" ? supplied : {};
        var values = {};
        script.variables.forEach(function (variable) {
            var value = Object.prototype.hasOwnProperty.call(supplied, variable.name) ? supplied[variable.name] : variable.defaultValue;
            value = cleanText(value, 4000);
            if (variable.control === "switch") value = asBoolean(value) ? "true" : "false";
            if (variable.control === "select" && variable.options.map(function (item) { return item.value; }).indexOf(value) < 0) throw new Error("Invalid value for " + variable.label + ".");
            if (variable.required && !String(value).trim()) throw new Error(variable.label + " is required.");
            values[variable.name] = value;
        });
        if (includeSecrets && script.secretVariables.length) {
            var saved = scriptSecretValues(script.path);
            script.secretVariables.forEach(function (variable) { var secret = stringValue(saved[variable.name]); if (variable.required && !secret) throw new Error("Configure credential " + variable.label + " for this script first."); values[variable.name] = secret; });
        }
        return values;
    }

    function validateRequest(payload, user) {
        if (!getAccess(user).allowed) throw new Error("You do not have access to My Scripts.");
        payload = payload && typeof payload === "object" ? payload : {};
        var script = readScript(String(payload.scriptPath || ""), true); if (!script) throw new Error("Script not found.");
        if (!script.requiresApproval) throw new Error("This script does not require approval and must be run directly.");
        var values = validateValues(script, payload.variableValues);
        var savedSecrets = scriptSecretValues(script.path);
        script.secretVariables.forEach(function (variable) { if (variable.required && !stringValue(savedSecrets[variable.name])) throw new Error("Configure credential " + variable.label + " for this script first."); });
        return {
            payload: { scriptPath: script.path, scriptHash: script.hash, variableValues: values },
            approvalLevels: script.approvalLevels,
            summary: script.label,
            fields: { script: script.label, description: script.description, variables: Object.keys(values).map(function (key) { return key + "=" + values[key]; }).join(", ") }
        };
    }

    function powershellPath() { return process.env.SystemRoot ? path.join(process.env.SystemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe") : "powershell.exe"; }
    function psQuote(value) { return String(value == null ? "" : value).replace(/'/g, "''"); }
    function cmdQuote(value) { return String(value == null ? "" : value).replace(/[\r\n]/g, " ").replace(/%/g, "%%").replace(/\^/g, "^^").replace(/!/g, "^^!").replace(/"/g, "^\""); }
    function buildPlan(script, values) {
        var target = normalizePath(script.path); if (!target) throw new Error("Invalid script path.");
        var names = Object.keys(values || {}).filter(function (name) { return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name); });
        if (script.shell === "powershell") {
            var preamble = names.map(function (name) { return "$" + name + "='" + psQuote(values[name]) + "'"; }).join(";");
            var wrapper = "$ProgressPreference='SilentlyContinue';try{$e=New-Object System.Text.UTF8Encoding($false);[Console]::OutputEncoding=$e;$OutputEncoding=$e}catch{};" + preamble + "; & '" + psQuote(target) + "' *>&1 | ForEach-Object { if($_ -ne $null){$_.ToString()} }";
            return { file: powershellPath(), args: ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand", Buffer.from(wrapper, "utf16le").toString("base64")], cwd: path.dirname(target) };
        }
        var lines = names.map(function (name) { return 'set "' + name + "=" + cmdQuote(values[name]) + '"'; });
        lines.push('call "' + target.replace(/"/g, '""') + '"');
        return { file: process.env.ComSpec || "cmd.exe", args: ["/d", "/s", "/c", "@echo off\r\n@chcp 65001 >nul\r\n" + lines.join("\r\n")], cwd: path.dirname(target) };
    }

    function runPlan(plan, request, script) {
        return new Promise(function (resolve, reject) {
            var environment = Object.assign({}, process.env, credentialEnvironment(), {
                MYSCRIPTS_REQUEST_ID: request.id || "", MYSCRIPTS_REQUESTER: request.requester && request.requester.name || "",
                MYSCRIPTS_PLUGIN_ROOT: root, MYSCRIPTS_SCRIPTS_ROOT: scriptsRoot, DIRECTORYTOOLS_PLUGIN_ROOT: root
            });
            childProcess.execFile(plan.file, plan.args, { cwd: plan.cwd, env: environment, windowsHide: true, encoding: "utf8", timeout: clientConfig.runTimeoutMs, maxBuffer: 4 * 1024 * 1024 }, function (error, stdout, stderr) {
                var output = cleanText(String(stdout || "") + (stderr ? "\n" + stderr : ""), 32000).trim();
                if (error) { var failure = new Error(output || error.message || "Script failed."); failure.code = error.code; reject(failure); return; }
                core.dispatch(parent, source, { etype: "user", action: "myscriptsexecuted", userid: request.requester && request.requester.id, username: request.requester && request.requester.name, requestid: request.id, msg: "My Scripts executed script: " + script.label });
                resolve({ message: output || "Script completed without output.", data: { exitCode: 0 } });
            });
        });
    }

    function executeApproved(payload, request) {
        var task = function () {
            var script = readScript(String(payload && payload.scriptPath || ""), true); if (!script) throw new Error("Approved script no longer exists.");
            if (script.hash !== String(payload.scriptHash || "")) throw new Error("The script changed after approval and was not executed.");
            var values = validateValues(script, payload.variableValues, true);
            return runPlan(buildPlan(script, values), request, script);
        };
        var result = executionQueue.catch(function () { }).then(task);
        executionQueue = result.catch(function () { });
        return result;
    }

    function executeDirect(user, payload) {
        if (!getAccess(user).allowed) return Promise.reject(new Error("You do not have access to My Scripts."));
        var script = readScript(String(payload && payload.scriptPath || ""), true);
        if (!script) return Promise.reject(new Error("Script not found."));
        if (script.requiresApproval) return Promise.reject(new Error("This script must be submitted for approval."));
        var values = validateValues(script, payload && payload.variableValues, true);
        var request = { id: "direct-" + Date.now().toString(36), requester: { id: user && user._id, name: user && user.name } };
        var result = executionQueue.catch(function () { }).then(function () { return runPlan(buildPlan(script, values), request, script); });
        executionQueue = result.catch(function () { });
        return result;
    }

    function formatRequest(request) {
        var fields = Object.assign({}, request.fields || {});
        if (request.result && request.result.message) fields.result = cleanText(request.result.message, 500);
        return fields;
    }

    function getResults(user) {
        if (!bus.service || typeof bus.service.list !== "function") return Promise.resolve({ rows: [], total: 0, page: 1, pageCount: 1, perPage: 100 });
        return bus.service.list(user, { type: "myscripts", perPage: 100, page: 1 });
    }

    var provider = {
        type: "myscripts", title: "Script requests", tabTitle: "Scripts", settingsTitle: "My Scripts approvers",
        description: "Server-side scripts waiting for approval or already executed.", version: clientConfig.version,
        installUrl: clientConfig.approvalCenterInstallUrl,
        columns: [{ key: "script", label: "Script" }, { key: "description", label: "Script Description" }, { key: "variables", label: "Variables" }, { key: "result", label: "Result" }],
        api: {
            resourceDescription: "Returns the script tree and variable metadata. Pass scriptPath to return one script definition.",
            payloadSchema: {
                type: "object",
                required: ["scriptPath", "variableValues"],
                additionalProperties: false,
                properties: {
                    scriptPath: { type: "string", description: "Path relative to the My Scripts scripts directory." },
                    variableValues: { type: "object", additionalProperties: { type: ["string", "number", "boolean"] }, description: "Values keyed by names declared in #Variable metadata." }
                }
            },
            resources: function (user, query) {
                if (!getAccess(user).allowed) throw new Error("You do not have access to My Scripts.");
                var scriptPath = String(query && query.scriptPath || "").trim();
                if (scriptPath) { var script = readScript(scriptPath, false); if (!script) throw new Error("Script not found."); return { script: script }; }
                return { tree: getTree(user) };
            }
        },
        canSubmit: function (user) { return getAccess(user).allowed; }, validate: validateRequest, execute: executeApproved, formatRequest: formatRequest
    };
    bus.registerProvider(provider);

    var api = {
        ensureStorage: function () { try { ensureStorage(); return null; } catch (error) { return error.message || String(error); } },
        getAccess: getAccess,
        getBootstrap: function (user) { return { access: getAccess(user), approvalAvailable: !!(bus.service && typeof bus.service.submit === "function"), approvalCenterInstallUrl: installUrl }; },
        getClientConfig: function () { var result = Object.assign({}, clientConfig); result.approvalAvailable = !!(bus.service && typeof bus.service.submit === "function"); return result; },
        getTree: getTree,
        getIcon: getIcon,
        getUserChoices: readUserChoices,
        getMeshUsers: getMeshUsers,
        getJiraAssets: getJiraAssets,
        getResults: getResults,
        getSettings: function (user) { if (!core.isSiteAdmin(user)) return null; var credentials = getCredentials(), secretStore = getScriptSecrets(); return { groups: core.getUserGroups(parent), folders: rootFolderSettings(), credentialsEnabled: clientConfig.credentialsEnabled, credentials: { adDomain: !!credentials.adDomain, adDomainValue: String(credentials.adDomain || ""), adLogin: !!credentials.adLogin, adLoginValue: String(credentials.adLogin || ""), adPassword: !!credentials.adPassword, entraTenantId: !!credentials.entraTenantId, entraTenantIdValue: String(credentials.entraTenantId || ""), entraClientId: !!credentials.entraClientId, entraClientIdValue: String(credentials.entraClientId || ""), entraClientSecret: !!credentials.entraClientSecret, jiraUrl: !!credentials.jiraUrl, jiraUrlValue: String(credentials.jiraUrl || ""), jiraLogin: !!credentials.jiraLogin, jiraLoginValue: String(credentials.jiraLogin || ""), jiraToken: !!credentials.jiraToken }, scriptSecrets: Object.keys(secretStore).length }; },
        executeDirect: executeDirect,
        saveSettings: function (user, credentials, folderPermissions) { if (!core.isSiteAdmin(user)) return Promise.reject(new Error("Only Site Admin can change settings.")); var groups = core.getUserGroups(parent), validGroups = Object.create(null); groups.forEach(function (group) { validGroups[group.id] = true; }); var allowedFolders = Object.create(null); rootFolderSettings().forEach(function (folder) { var value = folderPermissions && typeof folderPermissions === "object" ? folderPermissions[folder.path] : folder.groupIds; value = Array.isArray(value) ? value.map(String).filter(function (groupId, index, list) { return groupId && validGroups[groupId] && list.indexOf(groupId) === index; }) : (value ? [String(value)] : []); allowedFolders[folder.path] = value; }); saveFolderPermissions(allowedFolders); if (clientConfig.credentialsEnabled && credentials) saveCredentials(credentials); return Promise.resolve(true); },
        saveScriptSecrets: function (user, scriptPath, values) { if (!core.isSiteAdmin(user)) return Promise.reject(new Error("Only Site Admin can change script credentials.")); saveScriptSecrets(scriptPath, values || {}); return Promise.resolve(true); },
        submit: function (user, payload, note) { if (!bus.service || typeof bus.service.submit !== "function") return Promise.reject(new Error("Approval Center is not installed. Install it from: " + installUrl)); return bus.service.submit("myscripts", user, payload, note); }
    };
    return api;
};
