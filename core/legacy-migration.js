"use strict";

var childProcess = require("child_process");
var shared = require("./shared.js");

module.exports.createLegacyMigration = function (options) {
    var fs = options.fs;
    var path = options.path;
    var dataRoot = options.dataRoot;
    var pluginRoot = options.pluginRoot;
    var settings = options.settings;
    var integrations = options.integrations;
    var markerPath = path.join(dataRoot, "legacy-migration.json");

    function powershellPath() {
        return process.env.SystemRoot
            ? path.join(process.env.SystemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe")
            : "powershell.exe";
    }

    function decryptDpapi(value) {
        value = String(value || "").trim();
        if (!value) return "";
        if (process.platform !== "win32") throw new Error("DPAPI migration requires Windows.");
        var command = "$ErrorActionPreference='Stop';$cipher=[Console]::In.ReadToEnd();" +
            "$s=ConvertTo-SecureString $cipher;" +
            "$b=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($s);" +
            "try{[Runtime.InteropServices.Marshal]::PtrToStringBSTR($b)}" +
            "finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b)}";
        return String(childProcess.execFileSync(
            powershellPath(),
            ["-NoProfile", "-NonInteractive", "-Command", command],
            { encoding: "utf8", input: value, windowsHide: true, maxBuffer: 4 * 1024 * 1024 }
        )).trim();
    }

    function readJson(filePath) {
        return shared.readJson(fs, filePath, null);
    }

    function readProtectedJson(filePath) {
        var envelope = readJson(filePath);
        if (!envelope || !envelope.data) return null;
        var plain = decryptDpapi(envelope.data);
        if (!plain) return null;
        return JSON.parse(plain);
    }

    function candidatePluginRoots(shortNames) {
        var parent = path.dirname(pluginRoot);
        var result = [];

        shortNames.forEach(function (name) {
            [
                name,
                name + ".disabled",
                name + "-disabled"
            ].forEach(function (folder) {
                var candidate = path.join(parent, folder);
                if (result.indexOf(candidate) < 0) result.push(candidate);
            });
        });

        return result;
    }

    function firstExisting(paths) {
        for (var index = 0; index < paths.length; index++) {
            if (fs.existsSync(paths[index])) return paths[index];
        }
        return "";
    }


    function copyDirectory(source, destination) {
        if (!source || !fs.existsSync(source)) return 0;
        fs.mkdirSync(destination, { recursive: true });
        var copied = 0;
        fs.readdirSync(source, { withFileTypes: true }).forEach(function (entry) {
            if (entry.name === ".git" || entry.name === "node_modules") return;
            var from = path.join(source, entry.name);
            var to = path.join(destination, entry.name);
            if (entry.isDirectory()) {
                copied += copyDirectory(from, to);
            } else if (entry.isFile()) {
                fs.mkdirSync(path.dirname(to), { recursive: true });
                fs.copyFileSync(from, to);
                copied++;
            }
        });
        return copied;
    }

    function copyFileIfPresent(source, destination) {
        if (!source || !fs.existsSync(source)) return false;
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        fs.copyFileSync(source, destination);
        return true;
    }

    function mergePublic(target, name, values) {
        target[name] = target[name] || {};
        Object.keys(values || {}).forEach(function (key) {
            var value = values[key];
            if (value != null && value !== "") target[name][key] = value;
        });
    }

    function importMyScripts(result, publicValues, secretValues) {
        var root = firstExisting(candidatePluginRoots(["myscripts", "MyScripts"]));
        if (!root) return;

        var destinationRoot = path.join(dataRoot, "myscripts");
        var copied = 0;
        var scriptsSource = path.join(root, "scripts");
        copied += copyDirectory(
            scriptsSource,
            path.join(destinationRoot, "scripts")
        );
        var seedCopied = copyDirectory(
            scriptsSource,
            path.join(pluginRoot, "seed", "MyScripts")
        );
        copied += copyDirectory(
            path.join(root, "settings"),
            path.join(destinationRoot, "settings")
        );
        [
            "credentials.json",
            "folder-permissions.json",
            "script-secrets.json"
        ].forEach(function (name) {
            if (copyFileIfPresent(
                path.join(root, "data", name),
                path.join(destinationRoot, "data", name)
            )) copied++;
        });

        if (copied > 0) {
            result.imported.push("My Scripts library and settings");
            result.details.myScriptsFilesCopied = copied;
            result.details.myScriptsSource = root;
            result.details.myScriptsDestination = destinationRoot;
            result.details.myScriptsSeedDestination = path.join(
                pluginRoot,
                "seed",
                "MyScripts"
            );
            result.details.myScriptsSeedFilesCopied = seedCopied;
        }

        var filePath = path.join(root, "data", "credentials.json");
        if (!fs.existsSync(filePath)) return;
        var value = readProtectedJson(filePath) || {};
        var credentials = value.credentials || value;
        mergePublic(publicValues, "ad", {
            domain: credentials.adDomain,
            login: credentials.adLogin
        });
        mergePublic(publicValues, "entra", {
            tenantId: credentials.entraTenantId,
            clientId: credentials.entraClientId
        });
        mergePublic(publicValues, "jira", {
            url: credentials.jiraUrl,
            email: credentials.jiraLogin
        });
        if (credentials.adPassword) secretValues.adPassword = credentials.adPassword;
        if (credentials.entraClientSecret) secretValues.entraClientSecret = credentials.entraClientSecret;
        if (credentials.jiraToken) secretValues.jiraToken = credentials.jiraToken;
        result.imported.push("My Scripts credentials");
    }

    function importMyJira(result, publicValues, secretValues) {
        var root = firstExisting(candidatePluginRoots(["myjira", "MyJira"]));
        if (!root) return;
        var filePath = path.join(root, "data", "settings.json");
        if (!fs.existsSync(filePath)) return;
        var value = readProtectedJson(filePath) || {};
        mergePublic(publicValues, "jira", {
            url: value.url,
            email: value.email,
            projectKey: value.projectKey,
            assetFieldId: value.assetFieldId,
            hostnameAttribute: value.hostnameAttribute,
            workspaceId: value.workspaceId,
            cloudId: value.cloudId,
            aql: value.aql,
            maxResults: value.maxResults,
            verifyTls: value.verifyTls,
            cmdbEnabled: value.cmdbEnabled,
            approvalTransitionId: value.approvalTransitionId,
            closeTransitionId: value.closeTransitionId
        });
        if (value.token) secretValues.jiraToken = value.token;
        result.imported.push("My Jira settings");
    }

    function importDefender(result, publicValues, secretValues) {
        var root = firstExisting(candidatePluginRoots(["defendertools", "DefenderTools"]));
        if (!root) return;
        var credentialsPath = path.join(root, "data", "credentials.json");
        var settingsPath = path.join(root, "data", "settings.json");
        var publicDefender = {};

        if (fs.existsSync(credentialsPath)) {
            var protectedValues = readJson(credentialsPath) || {};
            var tenantId = decryptDpapi(protectedValues.tenantId || "");
            var clientId = decryptDpapi(protectedValues.clientIdGraph || "");
            var clientSecret = decryptDpapi(protectedValues.secret || "");
            if (tenantId) publicDefender.tenantId = tenantId;
            if (clientId) publicDefender.clientId = clientId;
            if (clientSecret) secretValues.defenderClientSecret = clientSecret;
        }

        if (fs.existsSync(settingsPath)) {
            var oldSettings = readJson(settingsPath) || {};
            var oldPermissions = oldSettings.permissions || {};
            publicDefender.permissions = {};
            ["incidents", "email", "trusted", "hunting"].forEach(function (name) {
                var groupId = String(oldPermissions[name] || "").trim();
                publicDefender.permissions[name] = groupId ? [groupId] : [];
            });
        }

        if (Object.keys(publicDefender).length || secretValues.defenderClientSecret) {
            mergePublic(publicValues, "defender", publicDefender);
            result.imported.push("DefenderTools settings");
        }
    }


    function importMyCommands(result) {
        var root = firstExisting(candidatePluginRoots([
            "mycommands", "MyCommands", "commandtabs", "CommandTabs"
        ]));
        if (!root) return;
        var scriptsSource = path.join(root, "scripts");
        var destination = path.join(dataRoot, "scripts", "MyCommands");
        var copied = copyDirectory(scriptsSource, destination);
        var seedCopied = copyDirectory(
            scriptsSource,
            path.join(pluginRoot, "seed", "MyCommands")
        );
        if (copied > 0) {
            result.imported.push("My Commands library and settings");
            result.details.myCommandsFilesCopied = copied;
            result.details.myCommandsSource = root;
            result.details.myCommandsDestination = destination;
            result.details.myCommandsSeedDestination = path.join(
                pluginRoot,
                "seed",
                "MyCommands"
            );
            result.details.myCommandsSeedFilesCopied = seedCopied;
        }
        ["settings.json", "folder-permissions.json", "results.json"].forEach(function (name) {
            var candidates = [
                path.join(root, "data", name),
                path.join(root, name)
            ];
            var source = firstExisting(candidates);
            if (source && copyFileIfPresent(
                source,
                path.join(dataRoot, "mycommands", "legacy-" + name)
            )) {
                result.details.myCommandsDataCopied =
                    Number(result.details.myCommandsDataCopied || 0) + 1;
            }
        });
    }

    function importApprovalCenter(result) {
        var root = firstExisting(candidatePluginRoots([
            "approvalcenter", "ApprovalCenter"
        ]));
        if (!root) return;
        var copied = 0;
        ["requests.json", "settings.json", "api-tokens.json"].forEach(function (name) {
            var source = firstExisting([
                path.join(root, "data", name),
                path.join(root, name)
            ]);
            if (source && copyFileIfPresent(
                source,
                path.join(dataRoot, "legacy", "approvalcenter", name)
            )) copied++;
        });
        if (copied) {
            result.imported.push("Approval Center data backup");
            result.details.approvalCenterFilesCopied = copied;
        }
    }

    function importMoveRequests(result) {
        var root = firstExisting(candidatePluginRoots([
            "moverequest", "moverequests", "MoveRequests"
        ]));
        if (!root) return;
        var copied = 0;
        ["settings.json", "requests.json"].forEach(function (name) {
            var source = firstExisting([
                path.join(root, "data", name),
                path.join(root, name)
            ]);
            if (source && copyFileIfPresent(
                source,
                path.join(dataRoot, "legacy", "moverequests", name)
            )) copied++;
        });
        if (copied) {
            result.imported.push("Move Requests data backup");
            result.details.moveRequestsFilesCopied = copied;
        }
    }

    function status() {
        return shared.readJson(fs, markerPath, {
            version: 5,
            completed: false,
            imported: [],
            warnings: [],
            lastAttemptAt: ""
        });
    }

    function run() {
        var previous = status();
        if (previous.completed === true && Number(previous.version) >= 5) {
            return Promise.resolve(previous);
        }

        var result = {
            version: 5,
            completed: false,
            imported: [],
            warnings: [],
            details: {},
            lastAttemptAt: new Date().toISOString()
        };

        if (process.platform !== "win32") {
            result.warnings.push("Legacy DPAPI migration skipped because the server is not Windows.");
            shared.writeJsonAtomic(fs, path, markerPath, result);
            return Promise.resolve(result);
        }

        var publicValues = {};
        var secretValues = {};
        [
            ["My Scripts", importMyScripts],
            ["My Commands", importMyCommands],
            ["Approval Center", importApprovalCenter],
            ["Move Requests", importMoveRequests],
            ["My Jira", importMyJira],
            ["DefenderTools", importDefender]
        ].forEach(function (entry) {
            try {
                entry[1](result, publicValues, secretValues);
            } catch (error) {
                result.warnings.push(entry[0] + ": " + String(error && error.message || error));
            }
        });

        return integrations.importValues(publicValues, secretValues).then(function () {
            return settings.update(function (current) {
                if (result.imported.indexOf("My Jira settings") >= 0) {
                    current.modules.myjira.enabled = true;
                }
                if (result.imported.indexOf("DefenderTools settings") >= 0) {
                    current.modules.defendertools.enabled = true;
                }
                return current;
            });
        }).then(function () {
            result.completed = true;
            result.completedAt = new Date().toISOString();
            shared.writeJsonAtomic(fs, path, markerPath, result);
            return result;
        }).catch(function (error) {
            result.warnings.push(String(error && error.message || error));
            shared.writeJsonAtomic(fs, path, markerPath, result);
            return result;
        });
    }

    return {
        run: run,
        status: status
    };
};
