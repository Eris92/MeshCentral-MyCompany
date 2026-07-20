"use strict";

var fs = require("fs");
var path = require("path");
var createMyCompany = require("./plugin.js").mycompany;

module.exports.mycompany = function (parent) {
    var pluginRoot = path.join(parent.pluginPath, "mycompany");
    var settingsPath = path.join(pluginRoot, "data", "settings.json");
    var defaultSettings = {
        tabs: {
            scripts: true,
            commands: true,
            approvals: true,
            move: true
        }
    };

    function booleanValue(value, fallback) {
        if (value === true || value === 1 || value === "1") return true;
        if (value === false || value === 0 || value === "0") return false;
        if (/^(true|on|yes)$/i.test(String(value || ""))) return true;
        if (/^(false|off|no)$/i.test(String(value || ""))) return false;
        return fallback;
    }

    function normalizeSettings(value) {
        value = value && typeof value === "object" && !Array.isArray(value) ? value : {};
        var tabs = value.tabs && typeof value.tabs === "object" && !Array.isArray(value.tabs) ? value.tabs : {};
        return {
            tabs: {
                scripts: booleanValue(tabs.scripts, true),
                commands: booleanValue(tabs.commands, true),
                approvals: booleanValue(tabs.approvals, true),
                move: booleanValue(tabs.move, true)
            }
        };
    }

    function readSettings() {
        try {
            return normalizeSettings(JSON.parse(fs.readFileSync(settingsPath, "utf8")));
        } catch (error) {
            return normalizeSettings(defaultSettings);
        }
    }

    function writeSettings(settings) {
        settings = normalizeSettings(settings);
        fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
        var temporaryPath = settingsPath + "." + process.pid + ".tmp";
        fs.writeFileSync(temporaryPath, JSON.stringify(settings, null, 2), "utf8");
        try {
            fs.renameSync(temporaryPath, settingsPath);
        } catch (error) {
            fs.copyFileSync(temporaryPath, settingsPath);
            fs.unlinkSync(temporaryPath);
        }
        return settings;
    }

    function readJson(filePath, fallback) {
        try {
            return JSON.parse(fs.readFileSync(filePath, "utf8"));
        } catch (error) {
            return fallback;
        }
    }

    function siteAdminAllowed(user) {
        return !!(user && ((Number(user.siteadmin) & 0xFFFFFFFF) !== 0));
    }

    function send(res, statusCode, contentType, body) {
        res.statusCode = statusCode;
        res.setHeader("Content-Type", contentType);
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.end(body);
    }

    function moduleDiagnostics(settings) {
        var manifest = readJson(path.join(pluginRoot, "embedded-manifest.json"), []);
        return manifest.map(function (item) {
            var instance = parent && parent.plugins && parent.plugins[item.shortName];
            var entryPath = path.join(pluginRoot, "embedded", item.shortName, item.entry);
            return {
                key: item.key,
                name: item.pageText || item.shortName,
                shortName: item.shortName,
                enabled: settings.tabs[item.key] !== false,
                loaded: !!instance,
                entryExists: fs.existsSync(entryPath),
                serverStarted: !!(instance && instance.__myCompanyStarted),
                backendHooks: instance ? Object.keys(instance).filter(function (key) {
                    return typeof instance[key] === "function";
                }).sort() : []
            };
        });
    }

    function readRelevantLogLines() {
        var dataPath = parent && parent.parent && parent.parent.datapath;
        if (!dataPath || !fs.existsSync(dataPath)) return [];

        var matcher = /mycompany|myscripts|mycommands|approvalcenter|moverequest|embedded module|error loading plugin/i;
        var output = [];
        var candidates = [];

        try {
            fs.readdirSync(dataPath).forEach(function (name) {
                if (/^(mesherrors|meshcentral.*(?:error|log)|.*\.log|.*errors.*\.txt)$/i.test(name)) {
                    candidates.push(path.join(dataPath, name));
                }
            });
        } catch (error) {
            return [];
        }

        candidates.slice(0, 20).forEach(function (filePath) {
            try {
                var stat = fs.statSync(filePath);
                if (!stat.isFile()) return;
                var length = Math.min(stat.size, 512 * 1024);
                var buffer = Buffer.alloc(length);
                var descriptor = fs.openSync(filePath, "r");
                fs.readSync(descriptor, buffer, 0, length, Math.max(0, stat.size - length));
                fs.closeSync(descriptor);
                buffer.toString("utf8").split(/\r?\n/).forEach(function (line) {
                    if (matcher.test(line)) output.push(path.basename(filePath) + ": " + line.slice(0, 4000));
                });
            } catch (error) {
                // Ignore individual unreadable log files.
            }
        });

        return output.slice(-150);
    }

    function debugSnapshot() {
        var config = readJson(path.join(pluginRoot, "config.json"), {});
        var settings = readSettings();
        var meshServer = parent && parent.parent;
        return {
            generatedAt: new Date().toISOString(),
            plugin: {
                name: config.name || "My Company",
                version: config.version || "unknown",
                root: pluginRoot,
                hasAdminPanel: config.hasAdminPanel === true
            },
            runtime: {
                node: process.version,
                platform: process.platform,
                arch: process.arch,
                meshCentralVersion: meshServer && (meshServer.currentVer || meshServer.currentVersion || meshServer.version) || "unknown"
            },
            settings: settings,
            modules: moduleDiagnostics(settings),
            relevantServerLogs: readRelevantLogLines()
        };
    }

    function safeJsonForHtml(value) {
        return JSON.stringify(value)
            .replace(/</g, "\\u003c")
            .replace(/>/g, "\\u003e")
            .replace(/&/g, "\\u0026");
    }

    function renderAdminPage(snapshot) {
        var snapshotJson = safeJsonForHtml(snapshot);
        return "<!doctype html>" +
            "<html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'>" +
            "<title>My Company Settings</title><style>" +
            ":root{color-scheme:dark}body{font-family:Arial,Helvetica,sans-serif;background:#1d1f20;color:#e7e7e7;margin:0;padding:18px}" +
            "h1{font-size:24px;margin:0 0 4px}h2{font-size:18px;margin:20px 0 10px}.muted{opacity:.72}" +
            ".toolbar{display:flex;gap:8px;flex-wrap:wrap;margin:18px 0}button{border:1px solid #70757a;border-radius:4px;background:#5f6b77;color:#fff;padding:8px 13px;cursor:pointer}" +
            "button.primary{background:#3168d8;border-color:#3168d8}.card{border:1px solid #505458;border-radius:6px;padding:14px;background:#242728}" +
            ".setting{display:block;padding:8px 0}.setting input{margin-right:8px}.notice{min-height:20px;margin-top:10px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:10px}" +
            ".pill{display:inline-block;border-radius:999px;padding:2px 8px;font-size:12px;background:#3a3e40;margin-left:6px}.ok{color:#71d58a}.bad{color:#ff7b7b}.off{color:#b8b8b8}" +
            ".line{margin-top:5px;font-size:13px}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#111;border:1px solid #444;border-radius:6px;padding:12px;max-height:520px;overflow:auto}" +
            "#debugPanel{display:none}</style></head><body>" +
            "<h1>My Company</h1><div class='muted'>Settings and diagnostics</div>" +
            "<div class='toolbar'><button class='primary' onclick='saveSettings()'>Save settings</button><button onclick='location.reload()'>Refresh</button><button onclick='toggleDebug()'>Debug</button></div>" +
            "<section class='card'><h2 style='margin-top:0'>UI integration</h2>" +
            "<label class='setting'><input id='tab-scripts' type='checkbox'>Show the My Scripts tab</label>" +
            "<label class='setting'><input id='tab-commands' type='checkbox'>Show the My Commands tab</label>" +
            "<label class='setting'><input id='tab-approvals' type='checkbox'>Show the Approval Center tab</label>" +
            "<label class='setting'><input id='tab-move' type='checkbox'>Show the Move Requests tab</label>" +
            "<div id='settingsNotice' class='notice muted'></div></section>" +
            "<h2>Embedded modules</h2><div id='moduleGrid' class='grid'></div>" +
            "<section id='debugPanel'><h2>Debug</h2><div id='browserState' class='card'></div><h2>Server data</h2><pre id='debugText'></pre></section>" +
            "<script>" +
            "var snapshot=" + snapshotJson + ";" +
            "function esc(v){return String(v==null?'':v).replace(/[&<>\"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;'})[c]})}" +
            "function loadSettings(){var t=snapshot.settings&&snapshot.settings.tabs||{};['scripts','commands','approvals','move'].forEach(function(k){document.getElementById('tab-'+k).checked=t[k]!==false})}" +
            "function renderModules(){var host=document.getElementById('moduleGrid');host.innerHTML='';snapshot.modules.forEach(function(m){var ok=m.loaded&&m.entryExists;var state=!m.enabled?'Disabled':(ok?'Loaded':'Error');var cls=!m.enabled?'off':(ok?'ok':'bad');var card=document.createElement('div');card.className='card';card.innerHTML='<strong>'+esc(m.name)+'</strong><span class=\"pill '+cls+'\">'+state+'</span><div class=\"line\">Tab: '+(m.enabled?'enabled':'disabled')+'</div><div class=\"line\">Backend: '+(m.loaded?'loaded':'unavailable')+'</div><div class=\"line\">Entry file: '+(m.entryExists?'found':'missing')+'</div><div class=\"line\">Server startup: '+(m.serverStarted?'completed':'not confirmed')+'</div>';host.appendChild(card)})}" +
            "function saveSettings(){var tabs={};['scripts','commands','approvals','move'].forEach(function(k){tabs[k]=document.getElementById('tab-'+k).checked});var url=new URL(window.location.href);url.searchParams.set('asset','save-settings');var body=new URLSearchParams();body.set('tabs',JSON.stringify(tabs));var notice=document.getElementById('settingsNotice');notice.textContent='Saving...';fetch(url.href,{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'},body:body.toString()}).then(function(r){return r.json()}).then(function(v){if(!v.ok)throw new Error(v.error||'Save failed');snapshot.settings=v.settings;notice.textContent='Saved. Refresh the main MeshCentral page to apply.';}).catch(function(e){notice.textContent='Error: '+(e.message||e)})}" +
            "function toggleDebug(){var panel=document.getElementById('debugPanel');var show=panel.style.display!=='block';panel.style.display=show?'block':'none';if(!show)return;var root=parent||window;var browser={MyCompanyAssetUrl:typeof root.MyCompanyAssetUrl,MyCompany:typeof root.MyCompany,MyScriptsOpen:typeof(root.MyScripts&&root.MyScripts.open),MyCommandsOpen:typeof(root.MyCommands&&root.MyCommands.openStandalone),ApprovalCenterOpen:typeof(root.ApprovalCenter&&root.ApprovalCenter.open),MoveRequestInitialize:typeof(root.MoveRequest&&root.MoveRequest.initialize)};document.getElementById('browserState').innerHTML='<strong>Browser state</strong><pre>'+esc(JSON.stringify(browser,null,2))+'</pre>';document.getElementById('debugText').textContent=JSON.stringify(snapshot,null,2)}" +
            "loadSettings();renderModules();</script></body></html>";
    }

    var obj = createMyCompany(parent);

    // Embedded aliases are backend discovery aliases only. Their browser hooks
    // are exported by MyCompany and must not be invoked twice.
    ["myscripts", "mycommands", "approvalcenter", "moverequest"].forEach(function (shortName) {
        if (parent && parent.exports) parent.exports[shortName] = [];
        if (parent && parent.plugins && parent.plugins[shortName]) parent.plugins[shortName].exports = [];
    });

    var originalAdminReq = obj.handleAdminReq;
    var originalAdminPostReq = obj.handleAdminPostReq;

    obj.handleAdminReq = function (req, res, user) {
        var moduleName = String(req && req.query && req.query.module || "");
        if (moduleName) return originalAdminReq.apply(obj, arguments);

        var asset = String(req && req.query && req.query.asset || "");
        if (asset === "ui-config") {
            send(res, 200, "application/json; charset=utf-8", JSON.stringify({ ok: true, settings: readSettings() }));
            return;
        }

        if (!siteAdminAllowed(user)) {
            send(res, 403, "text/plain; charset=utf-8", "Permission denied.");
            return;
        }

        if (asset === "debug") {
            send(res, 200, "application/json; charset=utf-8", JSON.stringify({ ok: true, debug: debugSnapshot() }, null, 2));
            return;
        }

        send(res, 200, "text/html; charset=utf-8", renderAdminPage(debugSnapshot()));
    };

    obj.handleAdminPostReq = function (req, res, user) {
        var moduleName = String(req && req.query && req.query.module || "");
        if (moduleName) {
            if (typeof originalAdminPostReq === "function") return originalAdminPostReq.apply(obj, arguments);
            send(res, 404, "application/json; charset=utf-8", JSON.stringify({ ok: false, error: "Embedded POST endpoint is unavailable." }));
            return;
        }

        if (!siteAdminAllowed(user)) {
            send(res, 403, "application/json; charset=utf-8", JSON.stringify({ ok: false, error: "Permission denied." }));
            return;
        }

        var asset = String(req && req.query && req.query.asset || "");
        if (asset === "save-settings") {
            try {
                var rawTabs = req && req.body && req.body.tabs;
                var tabs = typeof rawTabs === "string" ? JSON.parse(rawTabs) : rawTabs;
                var settings = writeSettings({ tabs: tabs });
                send(res, 200, "application/json; charset=utf-8", JSON.stringify({ ok: true, settings: settings }));
            } catch (error) {
                send(res, 400, "application/json; charset=utf-8", JSON.stringify({ ok: false, error: String(error && error.message || error) }));
            }
            return;
        }

        send(res, 400, "application/json; charset=utf-8", JSON.stringify({ ok: false, error: "Unknown admin action." }));
    };

    // Run the original MyCompany browser startup first, then apply only the
    // requested MyCompany UI settings. No global DOM observer is installed.
    obj.myCompanyMainStartup = obj.onWebUIStartupEnd;
    if (obj.exports.indexOf("myCompanyMainStartup") < 0) obj.exports.push("myCompanyMainStartup");

    obj.onWebUIStartupEnd = function () {
        if (typeof window === "undefined" || typeof document === "undefined") return;

        var api = window.pluginHandler && window.pluginHandler.mycompany;
        if (api && typeof api.myCompanyMainStartup === "function") api.myCompanyMainStartup();

        var uiSettings = {
            tabs: {
                scripts: true,
                commands: true,
                approvals: true,
                move: true
            }
        };

        function removeMyCompanyMenuEntry() {
            ["MainMenuMyCompany", "LeftMenuMyCompany"].forEach(function (id) {
                var element = document.getElementById(id);
                if (element && element.parentNode) element.parentNode.removeChild(element);
            });
        }

        function firstEnabledTab() {
            var keys = ["scripts", "commands", "approvals", "move"];
            for (var index = 0; index < keys.length; index++) {
                if (uiSettings.tabs[keys[index]] !== false) return keys[index];
            }
            return "";
        }

        function applyNavigationSettings() {
            removeMyCompanyMenuEntry();
            var navigation = document.getElementById("MyCompanyNavigation");
            if (!navigation) return;

            Array.prototype.forEach.call(navigation.querySelectorAll("[data-mycompany-module]"), function (button) {
                var key = button.getAttribute("data-mycompany-module");
                if (key === "settings") {
                    if (button.parentNode) button.parentNode.removeChild(button);
                    return;
                }
                button.style.display = uiSettings.tabs[key] === false ? "none" : "";
                button.setAttribute("aria-hidden", uiSettings.tabs[key] === false ? "true" : "false");
            });
        }

        function patchMyCompany() {
            var app = window.MyCompany;
            if (!app) {
                removeMyCompanyMenuEntry();
                return;
            }

            if (!app.__adminUiSettingsPatched) {
                app.__adminUiSettingsPatched = true;

                var originalEnsureNavigation = app.ensureNavigation;
                app.ensureNavigation = function () {
                    var result = typeof originalEnsureNavigation === "function" ? originalEnsureNavigation.apply(app, arguments) : null;
                    applyNavigationSettings();
                    return result;
                };

                var originalShowNavigation = app.showNavigation;
                app.showNavigation = function () {
                    var result = typeof originalShowNavigation === "function" ? originalShowNavigation.apply(app, arguments) : undefined;
                    applyNavigationSettings();
                    return result;
                };

                var originalShowModule = app.showModule;
                app.showModule = function (key) {
                    if (key === "settings") return false;
                    if (uiSettings.tabs[key] === false) return false;
                    return typeof originalShowModule === "function" ? originalShowModule.apply(app, arguments) : false;
                };

                app.ensureMenus = function () {
                    removeMyCompanyMenuEntry();
                };

                app.open = function (event) {
                    if (event) {
                        if (event.preventDefault) event.preventDefault();
                        if (event.stopPropagation) event.stopPropagation();
                    }
                    var key = firstEnabledTab();
                    return key ? app.showModule(key) : false;
                };

                app.renderSettings = app.open;
            }

            applyNavigationSettings();
        }

        function loadUiSettings() {
            var endpoint = new URL("pluginadmin.ashx", window.location.href);
            endpoint.searchParams.set("pin", "mycompany");
            endpoint.searchParams.set("asset", "ui-config");
            endpoint.searchParams.set("v", "0.6.1");
            fetch(endpoint.href, { credentials: "same-origin", cache: "no-store" })
                .then(function (response) { return response.json(); })
                .then(function (value) {
                    var tabs = value && value.settings && value.settings.tabs;
                    if (tabs && typeof tabs === "object") {
                        ["scripts", "commands", "approvals", "move"].forEach(function (key) {
                            uiSettings.tabs[key] = tabs[key] !== false;
                        });
                    }
                    window.MyCompanyUiSettings = uiSettings;
                    patchMyCompany();
                })
                .catch(function () {
                    patchMyCompany();
                });
        }

        [0, 100, 500, 1500, 3000].forEach(function (delay) {
            window.setTimeout(patchMyCompany, delay);
        });
        loadUiSettings();
    };

    return obj;
};
