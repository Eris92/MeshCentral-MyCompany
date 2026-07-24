"use strict";

var childProcess = require("child_process");
var shared = require("./shared.js");

module.exports.createServerAdminService = function (options) {
    var meshRoot = options.path.resolve(options.meshRoot);
    var powershell = process.env.SystemRoot
        ? options.path.join(process.env.SystemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe")
        : "powershell.exe";

    function requireAdmin(user) {
        if (!shared.isSiteAdmin(user)) throw new Error("Permission denied.");
    }

    function encoded(script) {
        return Buffer.from(script, "utf16le").toString("base64");
    }

    function run(script) {
        return new Promise(function (resolve, reject) {
            childProcess.execFile(powershell, ["-NoProfile", "-NonInteractive", "-EncodedCommand", encoded(script)], {
                windowsHide: true,
                timeout: 15000,
                maxBuffer: 1024 * 1024
            }, function (error, stdout) {
                if (error) return reject(new Error("Windows service state could not be read."));
                try { resolve(JSON.parse(String(stdout || "[]").replace(/^\uFEFF/, ""))); }
                catch (parseError) { reject(new Error("Windows service state returned an invalid response.")); }
            });
        });
    }

    function services(user) {
        requireAdmin(user);
        var rootLiteral = meshRoot.replace(/'/g, "''");
        var script = "$root='" + rootLiteral + "';" +
            "$items=@(Get-CimInstance Win32_Service | Where-Object { $_.PathName -and $_.PathName.IndexOf($root,[StringComparison]::OrdinalIgnoreCase) -ge 0 } | ForEach-Object { [pscustomobject]@{ name=$_.Name; displayName=$_.DisplayName; state=$_.State; startMode=$_.StartMode; processId=[int]$_.ProcessId } });" +
            "ConvertTo-Json -InputObject $items -Compress";
        return run(script).then(function (items) {
            if (!Array.isArray(items)) items = items ? [items] : [];
            return items.map(function (item) {
                return {
                    name: shared.cleanText(item.name, 200),
                    displayName: shared.cleanText(item.displayName, 200),
                    state: shared.cleanText(item.state, 50),
                    startMode: shared.cleanText(item.startMode, 50),
                    processId: Number(item.processId) || 0
                };
            });
        });
    }

    function restart(user, serviceName) {
        requireAdmin(user);
        serviceName = String(serviceName || "");
        return services(user).then(function (items) {
            if (!items.some(function (item) { return item.name === serviceName; })) {
                throw new Error("Service does not belong to this MeshCentral installation.");
            }
            var nameLiteral = serviceName.replace(/'/g, "''");
            var restartScript = "$ErrorActionPreference='Stop'; Start-Sleep -Milliseconds 900; Restart-Service -Name '" + nameLiteral + "' -Force";
            var child = childProcess.spawn(powershell, ["-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-EncodedCommand", encoded(restartScript)], {
                detached: true,
                windowsHide: true,
                stdio: "ignore"
            });
            child.on("error", function (error) {
                console.error("SirkPlatform could not launch the MeshCentral service restart helper:", error.message);
            });
            child.unref();
            return { scheduled: true, serviceName: serviceName };
        });
    }

    return { services: services, restart: restart };
};
