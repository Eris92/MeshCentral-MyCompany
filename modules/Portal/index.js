"use strict";

var fs = require("fs");
var path = require("path");
var https = require("https");
var shared = require("../../core/shared.js");

var VENDOR_VERSION = "0.3.17";
var VENDOR_REF = "e894c444c9d7e2e1218642018bf9c14dfb99c957";
var CUSTOM_FILES_KEY = "mycompany-sirk-portal";
var VENDOR_FILES = [
    "sirk-portal.css",
    "sirk-preflight-0.3.13.js",
    "sirk-portal.js",
    "sirk-remote-modules-0.3.13.js",
    "sirk-portal-patch-0.2.8.js",
    "sirk-ui-icons-0.3.4.js",
    "sirk-layout-0.3.1.js",
    "sirk-management-workspace-0.3.6.js",
    "sirk-ui-runtime-0.3.15.js",
    "sirk-device-layout-0.3.13.js",
    "sirk-controls-0.3.17.js"
];
var EARLY_VENDOR_SCRIPTS = [
    "sirk-preflight-0.3.13.js",
    "sirk-portal.js",
    "sirk-remote-modules-0.3.13.js",
    "sirk-portal-patch-0.2.8.js",
    "sirk-ui-icons-0.3.4.js",
    "sirk-layout-0.3.1.js",
    "sirk-ui-runtime-0.3.15.js",
    "sirk-device-layout-0.3.13.js",
    "sirk-controls-0.3.17.js"
];

module.exports.createModule = function (context) {
    var vendorState = {
        version: VENDOR_VERSION,
        ref: VENDOR_REF,
        ready: false,
        directory: "",
        missing: [],
        error: "",
        earlyOverlay: false,
        customFilesDomains: []
    };

    function settings() {
        return context.settings.read().modules.portal || {};
    }

    function allowed(user) {
        return !!user;
    }

    function requireAdmin(user) {
        if (!shared.isSiteAdmin(user)) throw new Error("Permission denied.");
    }

    function meshServer() {
        return context.parent && context.parent.parent;
    }

    function standalonePortalActive() {
        var plugins = context.parent && context.parent.plugins || {};
        return Object.keys(plugins).some(function (key) {
            var normalized = String(key || "").replace(/[^a-z0-9]/gi, "").toLowerCase();
            return normalized === "sirkportal";
        });
    }

    function vendorDirectory() {
        return path.join(context.pluginRoot, "public", "vendor", "sirk-portal");
    }

    function validVendorFile(filePath) {
        try {
            return fs.statSync(filePath).isFile() && fs.statSync(filePath).size > 32;
        } catch (error) {
            return false;
        }
    }

    function download(url, targetPath, redirects) {
        redirects = Number(redirects || 0);
        return new Promise(function (resolve, reject) {
            var request = https.get(url, {
                headers: {
                    "User-Agent": "MeshCentral-MyCompany/1.4.9",
                    "Accept": "application/octet-stream"
                }
            }, function (response) {
                if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                    response.resume();
                    if (redirects >= 5) {
                        reject(new Error("Too many redirects while downloading " + url));
                        return;
                    }
                    download(response.headers.location, targetPath, redirects + 1).then(resolve, reject);
                    return;
                }
                if (response.statusCode !== 200) {
                    response.resume();
                    reject(new Error("HTTP " + response.statusCode + " while downloading " + url));
                    return;
                }

                var temporaryPath = targetPath + ".tmp-" + process.pid + "-" + Date.now();
                var stream = fs.createWriteStream(temporaryPath, { flags: "wx" });
                var completed = false;

                function fail(error) {
                    if (completed) return;
                    completed = true;
                    try { stream.destroy(); } catch (ignored) {}
                    try { fs.unlinkSync(temporaryPath); } catch (ignored) {}
                    reject(error);
                }

                response.on("error", fail);
                stream.on("error", fail);
                stream.on("finish", function () {
                    if (completed) return;
                    completed = true;
                    stream.close(function () {
                        try {
                            if (!validVendorFile(temporaryPath)) throw new Error("Downloaded vendor asset is empty: " + path.basename(targetPath));
                            try { fs.unlinkSync(targetPath); } catch (ignored) {}
                            fs.renameSync(temporaryPath, targetPath);
                            resolve();
                        } catch (error) {
                            try { fs.unlinkSync(temporaryPath); } catch (ignored) {}
                            reject(error);
                        }
                    });
                });
                response.pipe(stream);
            });
            request.setTimeout(30000, function () {
                request.destroy(new Error("Timeout while downloading " + url));
            });
            request.on("error", reject);
        });
    }

    function ensureVendorAssets() {
        var directory = vendorDirectory();
        vendorState.directory = directory;
        fs.mkdirSync(directory, { recursive: true });

        var missing = VENDOR_FILES.filter(function (name) {
            return !validVendorFile(path.join(directory, name));
        });
        vendorState.missing = missing.slice();

        var chain = Promise.resolve();
        missing.forEach(function (name) {
            chain = chain.then(function () {
                var url = "https://raw.githubusercontent.com/Eris92/SirK-Portal/" + VENDOR_REF + "/" + encodeURIComponent(name);
                return download(url, path.join(directory, name));
            });
        });

        return chain.then(function () {
            var unresolved = VENDOR_FILES.filter(function (name) {
                return !validVendorFile(path.join(directory, name));
            });
            if (unresolved.length) throw new Error("Missing SirK Portal vendor assets: " + unresolved.join(", "));
            vendorState.ready = true;
            vendorState.missing = [];
            vendorState.error = "";
            return vendorState;
        }).catch(function (error) {
            vendorState.ready = false;
            vendorState.error = String(error && error.message || error);
            throw new Error("Unable to provision embedded SirK Portal " + VENDOR_VERSION + ": " + vendorState.error);
        });
    }

    function webPaths() {
        var server = meshServer();
        if (!server || !server.datapath) throw new Error("MeshCentral datapath is unavailable.");
        var meshRoot = path.dirname(server.datapath);
        return {
            root: path.join(meshRoot, "meshcentral-web", "public"),
            scripts: path.join(meshRoot, "meshcentral-web", "public", "scripts"),
            styles: path.join(meshRoot, "meshcentral-web", "public", "styles")
        };
    }

    function earlyScript() {
        return [
            "(function(){",
            "if(window.__myCompanySirkEarlyLoaded)return;window.__myCompanySirkEarlyLoaded=true;",
            "var root=document.documentElement;",
            "var url=new URL(window.location.href);",
            "if(url.searchParams.get('sirkNative')==='1'||url.searchParams.get('sirkremote39')==='1'){root.classList.add('sirk-native-embed');return;}",
            "root.classList.add('mycompany-sirk-pending');",
            "function ready(){if(document.getElementById('sirkPortalRoot')||document.getElementById('sirkLoginShell')||root.classList.contains('sirk-login-active')||root.classList.contains('sirk-portal-active'))root.classList.remove('mycompany-sirk-pending');}",
            "if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready);else ready();",
            "new MutationObserver(ready).observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});",
            "setTimeout(function(){root.classList.remove('mycompany-sirk-pending');},8000);",
            "})();"
        ].join("");
    }

    function earlyStyle() {
        return [
            "html.mycompany-sirk-pending body{visibility:hidden!important;background:#0b1220!important}",
            "html.sirk-login-active body,html.sirk-portal-active body,html.sirk-native-embed body{visibility:visible!important}",
            "html.sirk-native-embed body{background:#fff!important}"
        ].join("\n");
    }

    function copyEarlyAssets() {
        var paths = webPaths();
        fs.mkdirSync(paths.scripts, { recursive: true });
        fs.mkdirSync(paths.styles, { recursive: true });
        fs.writeFileSync(path.join(paths.scripts, "mycompany-sirk-early.js"), earlyScript(), "utf8");
        fs.writeFileSync(path.join(paths.styles, "mycompany-sirk-early.css"), earlyStyle(), "utf8");
        EARLY_VENDOR_SCRIPTS.forEach(function (name) {
            fs.copyFileSync(path.join(vendorDirectory(), name), path.join(paths.scripts, name));
        });
        fs.copyFileSync(path.join(vendorDirectory(), "sirk-portal.css"), path.join(paths.styles, "sirk-portal.css"));
        return paths;
    }

    function isPortalCustomEntry(entry) {
        if (!entry || typeof entry !== "object") return false;
        if (entry.name === CUSTOM_FILES_KEY || entry.myCompanyPortal === true) return true;
        return entry.sirkPortal === true || entry.name === "sirk-portal";
    }

    function removePortalEntries(current) {
        if (Array.isArray(current)) return current.filter(function (entry) { return !isPortalCustomEntry(entry); });
        if (current && typeof current === "object") {
            var result = Object.assign({}, current);
            Object.keys(result).forEach(function (key) {
                if (key === CUSTOM_FILES_KEY || isPortalCustomEntry(result[key])) delete result[key];
            });
            return result;
        }
        return {};
    }

    function portalCustomEntry() {
        return {
            name: CUSTOM_FILES_KEY,
            myCompanyPortal: true,
            css: ["mycompany-sirk-early.css", "sirk-portal.css"],
            js: ["mycompany-sirk-early.js"].concat(EARLY_VENDOR_SCRIPTS),
            scope: ["all"]
        };
    }

    function setEarlyOverlay(enabled) {
        var server = meshServer();
        var config = server && server.config;
        if (!config || !config.domains || typeof config.domains !== "object") throw new Error("MeshCentral config.domains is unavailable.");
        if (enabled) copyEarlyAssets();

        var domains = [];
        Object.keys(config.domains).forEach(function (domainId) {
            var domain = config.domains[domainId];
            if (!domain || typeof domain !== "object") return;
            var current = domain.customFiles != null ? domain.customFiles : domain.customfiles;
            var cleaned = removePortalEntries(current);
            if (enabled) {
                if (Array.isArray(cleaned)) cleaned.push(portalCustomEntry());
                else cleaned[CUSTOM_FILES_KEY] = portalCustomEntry();
                domain.newAccounts = false;
                domain.newaccounts = false;
            }
            domain.customFiles = cleaned;
            domain.customfiles = cleaned;
            domains.push(domainId || "<default>");
        });
        vendorState.earlyOverlay = !!enabled;
        vendorState.customFilesDomains = domains;
        return domains;
    }

    return {
        key: "portal",
        clientConfig: function () {
            var value = settings();
            return {
                key: "portal",
                name: "SirK Portal",
                menuTitle: "SirK Portal",
                script: "portal.js",
                style: "portal.css",
                showInMenu: false,
                defaultView: String(value.defaultView || "overview"),
                showLauncher: value.showLauncher !== false,
                standaloneConflict: standalonePortalActive(),
                vendorVersion: VENDOR_VERSION,
                vendorReady: vendorState.ready,
                earlyOverlay: vendorState.earlyOverlay
            };
        },
        getAccess: function (user) {
            return {
                allowed: allowed(user),
                siteAdmin: shared.isSiteAdmin(user)
            };
        },
        initialize: function () {
            return ensureVendorAssets().then(function () {
                var value = settings();
                if (value.enabled === true && !standalonePortalActive()) setEarlyOverlay(true);
                else setEarlyOverlay(false);
                return vendorState;
            });
        },
        apiGet: function (asset, req, user) {
            if (!allowed(user)) throw new Error("Permission denied.");
            if (asset === "status" || asset === "settings") {
                return {
                    ok: true,
                    module: settings(),
                    siteAdmin: shared.isSiteAdmin(user),
                    standaloneConflict: standalonePortalActive(),
                    vendor: vendorState
                };
            }
            throw new Error("Unknown Portal action.");
        },
        apiPost: function (asset, req, user) {
            requireAdmin(user);
            var value = req && req.body || {};
            if (asset !== "settings") throw new Error("Unknown Portal action.");
            if (value.enabled === true && standalonePortalActive()) {
                throw new Error("Disable or uninstall the standalone SirKPortal plugin before enabling the embedded MyCompany Portal.");
            }
            return context.settings.update(function (current) {
                current.modules.portal = current.modules.portal || {};
                if (typeof value.enabled === "boolean") current.modules.portal.enabled = value.enabled;
                current.modules.portal.defaultView = ["overview", "devices", "management", "approvals", "settings"].indexOf(String(value.defaultView || "")) >= 0
                    ? String(value.defaultView)
                    : "overview";
                current.modules.portal.showLauncher = value.showLauncher !== false;
                return current;
            }).then(function () {
                var enabled = settings().enabled === true && !standalonePortalActive();
                setEarlyOverlay(enabled);
                return { ok: true, module: settings(), reloadRequired: true, vendor: vendorState };
            });
        }
    };
};