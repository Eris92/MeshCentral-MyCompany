"use strict";

var childProcess = require("child_process");
var shared = require("./shared.js");

function text(value, limit) {
    return shared.cleanText(value == null ? "" : value, limit || 4000);
}

function bool(value) {
    return value === true || /^(1|true|yes|tak|on)$/i.test(String(value || ""));
}

function uniqueLevels(value) {
    return (Array.isArray(value) ? value : []).map(Number).filter(function (level, index, list) {
        return level >= 1 && level <= 3 && list.indexOf(level) === index;
    }).sort();
}

function assignmentKey(value) {
    return String(value || "").replace(/\\/g, "/").toLowerCase();
}

module.exports.createServerScriptExecutor = function (options) {
    options = options || {};
    var context = options.context;
    var library = options.library;
    var admin = options.admin;
    var assignmentNamespace = String(options.assignmentNamespace || "script-secrets.myscripts.system-credentials");
    var queue = Promise.resolve();

    function timeoutMs() {
        var current = context.settings.read();
        var moduleSettings = current.modules && current.modules.myscripts || {};
        return Math.max(30, Math.min(3600, Number(moduleSettings.runTimeoutSeconds) || 600)) * 1000;
    }

    function validateValues(script, supplied) {
        supplied = supplied && typeof supplied === "object" && !Array.isArray(supplied) ? supplied : {};
        var values = {};

        (script.variables || []).forEach(function (variable) {
            var value = Object.prototype.hasOwnProperty.call(supplied, variable.name)
                ? supplied[variable.name]
                : variable.defaultValue;
            value = text(value, 4000);
            if (variable.control === "switch") value = bool(value) ? "true" : "false";
            if (variable.control === "select") {
                var allowed = (variable.options || []).map(function (item) { return String(item.value); });
                if (allowed.length && allowed.indexOf(String(value)) < 0) {
                    throw new Error("Invalid value for " + (variable.label || variable.name) + ".");
                }
            }
            if (variable.required && !String(value).trim()) {
                throw new Error((variable.label || variable.name) + " is required.");
            }
            values[variable.name] = value;
        });

        var secrets = admin.secretValues(script.path);
        Object.keys(secrets || {}).forEach(function (name) {
            values[name] = String(secrets[name] == null ? "" : secrets[name]);
        });
        return values;
    }

    function assignedProfiles(scriptPath) {
        var assignments = context.secrets.get(assignmentNamespace);
        assignments = assignments && typeof assignments === "object" ? assignments : {};
        var selected = assignments[assignmentKey(scriptPath)];
        return Array.isArray(selected) ? selected.map(String) : [];
    }

    function systemEnvironment(scriptPath) {
        var selected = assignedProfiles(scriptPath);
        var environment = {};
        function enabled(name) { return selected.indexOf(name) >= 0; }

        if (enabled("ad")) {
            var ad = context.integrations.get("ad");
            environment.MYSCRIPTS_AD_DOMAIN = String(ad.domain || "");
            environment.MYSCRIPTS_AD_LOGIN = String(ad.login || "");
            environment.MYSCRIPTS_AD_PASSWORD = String(ad.password || "");
        }
        if (enabled("entra")) {
            var entra = context.integrations.get("entra");
            environment.MYSCRIPTS_ENTRA_TENANT_ID = String(entra.tenantId || "");
            environment.MYSCRIPTS_ENTRA_CLIENT_ID = String(entra.clientId || "");
            environment.MYSCRIPTS_ENTRA_CLIENT_SECRET = String(entra.clientSecret || "");
        }
        if (enabled("jira")) {
            var jira = context.integrations.get("jira");
            environment.MYSCRIPTS_JIRA_URL = String(jira.url || "");
            environment.MYSCRIPTS_JIRA_LOGIN = String(jira.email || "");
            environment.MYSCRIPTS_JIRA_EMAIL = String(jira.email || "");
            environment.MYSCRIPTS_JIRA_TOKEN = String(jira.token || "");
            environment.MYSCRIPTS_JIRA_PROJECT_KEY = String(jira.projectKey || "");
            environment.MYSCRIPTS_JIRA_WORKSPACE_ID = String(jira.workspaceId || "");
            environment.MYSCRIPTS_JIRA_CLOUD_ID = String(jira.cloudId || "");
        }
        if (enabled("defender")) {
            var defender = context.integrations.get("defender");
            environment.MYSCRIPTS_DEFENDER_TENANT_ID = String(defender.tenantId || "");
            environment.MYSCRIPTS_DEFENDER_CLIENT_ID = String(defender.clientId || "");
            environment.MYSCRIPTS_DEFENDER_CLIENT_SECRET = String(defender.clientSecret || "");
        }
        if (enabled("zabbix")) {
            var zabbix = context.integrations.get("zabbix");
            environment.MYSCRIPTS_ZABBIX_URL = String(zabbix.url || "");
            environment.MYSCRIPTS_ZABBIX_USERNAME = String(zabbix.username || "");
            environment.MYSCRIPTS_ZABBIX_PASSWORD = String(zabbix.password || "");
            environment.MYSCRIPTS_ZABBIX_TOKEN = String(zabbix.token || "");
        }
        return environment;
    }

    function powershellPath() {
        var configured = String(process.env.MYCOMPANY_POWERSHELL || "").trim();
        if (configured) return configured;
        if (process.platform !== "win32") return "pwsh";

        var programFiles = process.env.ProgramFiles || "C:\\Program Files";
        var pwsh = context.nativePath.join(programFiles, "PowerShell", "7", "pwsh.exe");
        try {
            if (context.fs.existsSync(pwsh)) return pwsh;
        } catch (error) {}

        return process.env.SystemRoot
            ? context.nativePath.join(process.env.SystemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe")
            : "powershell.exe";
    }

    function psQuote(value) {
        return String(value == null ? "" : value).replace(/'/g, "''");
    }

    function cmdQuote(value) {
        return String(value == null ? "" : value)
            .replace(/[\r\n]/g, " ")
            .replace(/%/g, "%%")
            .replace(/\^/g, "^^")
            .replace(/!/g, "^^!")
            .replace(/"/g, "^\"");
    }

    function buildPlan(script, values) {
        var target = context.nativePath.resolve(context.pluginRoot, "seed", "MyScripts", String(script.path || "").replace(/\//g, context.nativePath.sep));
        var root = context.nativePath.resolve(context.pluginRoot, "seed", "MyScripts");
        var prefix = root.endsWith(context.nativePath.sep) ? root : root + context.nativePath.sep;
        if (target.toLowerCase().indexOf(prefix.toLowerCase()) !== 0) throw new Error("Invalid script path.");

        var names = Object.keys(values || {}).filter(function (name) {
            return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name);
        });

        if (script.shell === "powershell") {
            var preamble = names.map(function (name) {
                return "$" + name + "='" + psQuote(values[name]) + "'";
            }).join(";");
            var wrapper = "$ProgressPreference='SilentlyContinue';$ErrorActionPreference='Stop';" +
                "try{$e=New-Object System.Text.UTF8Encoding($false);[Console]::OutputEncoding=$e;$OutputEncoding=$e}catch{};" +
                preamble + ";" +
                "$__mcOutput=@(& '" + psQuote(target) + "' *>&1);" +
                "$__mcText=New-Object System.Collections.Generic.List[string];" +
                "$__mcObjects=New-Object System.Collections.Generic.List[object];" +
                "foreach($__mcItem in $__mcOutput){" +
                "if($__mcItem -eq $null){continue};" +
                "if(($__mcItem -is [string])-or($__mcItem -is [System.ValueType])-or($__mcItem -is [System.Management.Automation.ErrorRecord])){$__mcText.Add($__mcItem.ToString())}else{$__mcObjects.Add($__mcItem)}};" +
                "$__mcText|ForEach-Object{$_};" +
                "if($__mcObjects.Count -eq 1){ConvertTo-Json -InputObject $__mcObjects[0] -Depth 12 -Compress}" +
                "elseif($__mcObjects.Count -gt 1){ConvertTo-Json -InputObject @($__mcObjects) -Depth 12 -Compress}";
            return {
                file: powershellPath(),
                args: ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand", Buffer.from(wrapper, "utf16le").toString("base64")],
                cwd: context.nativePath.dirname(target)
            };
        }

        var lines = names.map(function (name) {
            return "set \"" + name + "=" + cmdQuote(values[name]) + "\"";
        });
        lines.push("call \"" + target.replace(/"/g, "\"\"") + "\"");
        return {
            file: process.env.ComSpec || "cmd.exe",
            args: ["/d", "/s", "/c", "@echo off\r\n@chcp 65001 >nul\r\n" + lines.join("\r\n")],
            cwd: context.nativePath.dirname(target)
        };
    }

    function parseData(raw) {
        var value = String(raw || "").trim();
        if (!value) return null;
        try { return JSON.parse(value); } catch (error) {}
        var lines = value.split(/\r?\n/);
        for (var index = 0; index < lines.length; index++) {
            var candidate = lines.slice(index).join("\n").trim();
            if (!candidate) continue;
            try { return JSON.parse(candidate); } catch (error) {}
        }
        return null;
    }

    function run(script, payload, request) {
        if (payload.scriptHash && String(payload.scriptHash) !== String(script.hash)) {
            return Promise.reject(new Error("The script changed after submission and was not executed."));
        }

        var values;
        try { values = validateValues(script, payload.variableValues); }
        catch (error) { return Promise.reject(error); }

        var plan;
        try { plan = buildPlan(script, values); }
        catch (error) { return Promise.reject(error); }

        var environment = Object.assign({}, process.env, systemEnvironment(script.path), {
            MYSCRIPTS_REQUEST_ID: request && request.id || "",
            MYSCRIPTS_REQUESTER: request && request.requester && request.requester.name || "",
            MYSCRIPTS_PLUGIN_ROOT: context.pluginRoot,
            MYSCRIPTS_SCRIPTS_ROOT: context.nativePath.join(context.pluginRoot, "seed", "MyScripts"),
            DIRECTORYTOOLS_PLUGIN_ROOT: context.pluginRoot
        });

        return new Promise(function (resolve, reject) {
            childProcess.execFile(plan.file, plan.args, {
                cwd: plan.cwd,
                env: environment,
                windowsHide: true,
                encoding: "utf8",
                timeout: timeoutMs(),
                maxBuffer: 8 * 1024 * 1024
            }, function (error, stdout, stderr) {
                var raw = text(String(stdout || "") + (stderr ? "\n" + stderr : ""), 1000000).trim();
                if (error) {
                    var failure = new Error(raw || error.message || "Script failed.");
                    failure.code = error.code;
                    reject(failure);
                    return;
                }
                var parsed = parseData(raw);
                resolve({
                    message: raw || "Script completed without output.",
                    output: raw,
                    rawOutput: raw,
                    data: parsed,
                    exitCode: 0,
                    scriptPath: script.path,
                    label: script.label || script.name || "Script"
                });
            });
        });
    }

    function execute(payload, request) {
        payload = payload && typeof payload === "object" ? payload : {};
        var task = function () {
            var script = library.getScript(String(payload.scriptPath || ""), true);
            if (!script) throw new Error("Script not found.");
            return run(script, payload, request || {});
        };
        var operation = queue.catch(function () {}).then(task);
        queue = operation.catch(function () {});
        return operation;
    }

    return {
        execute: execute,
        normalizeLevels: uniqueLevels,
        validateValues: validateValues
    };
};
