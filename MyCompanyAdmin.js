"use strict";

var fs = require("fs");
var path = require("path");
var shared = require("./core/shared.js");

module.exports.admin = function (plugin) {
    var obj = {}, root = __dirname;
    var assets = {
        "admin.css": ["web/admin.css", "text/css; charset=utf-8"],
        "admin-ui-enhancements.css": ["web/admin-ui-enhancements.css", "text/css; charset=utf-8"],
        "admin.js": ["web/admin.js", "text/javascript; charset=utf-8"],
        "admin-layout.js": ["web/admin-layout.js", "text/javascript; charset=utf-8"],
        "admin-approval-policy.js": ["web/admin-approval-policy.js", "text/javascript; charset=utf-8"],
        "admin-ui-enhancements.js": ["web/admin-ui-enhancements.js", "text/javascript; charset=utf-8"],
        "admin-move-mesh-levels.js": ["web/admin-move-mesh-levels.js", "text/javascript; charset=utf-8"],
        "admin-portal.js": ["web/admin-portal.js", "text/javascript; charset=utf-8"],
        "core.js": ["public/core.js", "text/javascript; charset=utf-8"],
        "mesh-plugin-core.js": ["public/mesh-plugin-core.js", "text/javascript; charset=utf-8"],
        "module-shell.js": ["public/module-shell.js", "text/javascript; charset=utf-8"],
        "runtime.js": ["public/runtime.js", "text/javascript; charset=utf-8"],
        "portal.js": ["public/portal.js", "text/javascript; charset=utf-8"],
        "portal.css": ["public/portal.css", "text/css; charset=utf-8"],
        "myscripts.js": ["public/myscripts.js", "text/javascript; charset=utf-8"],
        "myscripts.css": ["public/myscripts.css", "text/css; charset=utf-8"],
        "myscripts-menu.svg": ["assets/myscripts-menu.svg", "image/svg+xml; charset=utf-8"],
        "mycommands.js": ["public/mycommands.js", "text/javascript; charset=utf-8"],
        "myjira.js": ["public/myjira.js", "text/javascript; charset=utf-8"],
        "defendertools.js": ["public/defendertools.js", "text/javascript; charset=utf-8"],
        "approvalcenter.js": ["public/approvalcenter.js", "text/javascript; charset=utf-8"],
        "moverequests.js": ["public/moverequests.js", "text/javascript; charset=utf-8"],
        "main.css": ["public/main.css", "text/css; charset=utf-8"],
        "shared-ui/toolbar-config.js": ["public/shared-ui/toolbar-config.js", "text/javascript; charset=utf-8"],
        "shared-ui/toolbar-api.js": ["public/shared-ui/toolbar-api.js", "text/javascript; charset=utf-8"],
        "shared-ui/toolbar.js": ["public/shared-ui/toolbar.js", "text/javascript; charset=utf-8"],
        "shared-ui/tabs.js": ["public/shared-ui/tabs.js", "text/javascript; charset=utf-8"],
        "shared-ui/layout.js": ["public/shared-ui/layout.js", "text/javascript; charset=utf-8"],
        "shared-ui/settings.js": ["public/shared-ui/settings.js", "text/javascript; charset=utf-8"],
        "shared-ui/status-nav.js": ["public/shared-ui/status-nav.js", "text/javascript; charset=utf-8"],
        "shared-ui/tree.js": ["public/shared-ui/tree.js", "text/javascript; charset=utf-8"],
        "shared-ui/catalog.js": ["public/shared-ui/catalog.js", "text/javascript; charset=utf-8"],
        "shared-ui/results.js": ["public/shared-ui/results.js", "text/javascript; charset=utf-8"],
        "shared-ui/result-layout.js": ["public/shared-ui/result-layout.js", "text/javascript; charset=utf-8"],
        "shared-ui/script-tools.js": ["public/shared-ui/script-tools.js", "text/javascript; charset=utf-8"],
        "shared-ui/script-definition-form.js": ["public/shared-ui/script-definition-form.js", "text/javascript; charset=utf-8"],
        "shared-ui/confirm-execution-form.js": ["public/shared-ui/confirm-execution-form.js", "text/javascript; charset=utf-8"],
        "shared-ui/script-edit-actions.js": ["public/shared-ui/script-edit-actions.js", "text/javascript; charset=utf-8"],
        "shared-ui/system-credentials-form.js": ["public/shared-ui/system-credentials-form.js", "text/javascript; charset=utf-8"],
        "shared-ui/page.js": ["public/shared-ui/page.js", "text/javascript; charset=utf-8"],
        "shared-ui/shared-ui.css": ["public/shared-ui/shared-ui.css", "text/css; charset=utf-8"],
        "shared-ui/toolbar.css": ["public/shared-ui/toolbar.css", "text/css; charset=utf-8"]
    };

    function serve(res, name) {
        var def = assets[name];
        if (!def) { shared.send(res, 404, "text/plain; charset=utf-8", "Not found"); return; }
        fs.readFile(path.join(root, def[0]), function (error, data) {
            if (error) shared.send(res, 404, "text/plain; charset=utf-8", "Not found");
            else shared.send(res, 200, def[1], data);
        });
    }

    function moduleObject(moduleName) {
        return plugin.runtime && plugin.runtime.modules && plugin.runtime.modules[String(moduleName || "").toLowerCase()];
    }

    obj.req = function (req, res, user) {
        var asset = String(req && req.query && req.query.asset || "");
        var moduleName = String(req && req.query && req.query.module || "");
        if (assets[asset]) { serve(res, asset); return; }
        if (asset === "bootstrap") { plugin.runtime.request("GET", "_runtime", "bootstrap", req, res, user); return; }
        if (moduleName === "myscripts" && asset === "folder-icon") {
            if (plugin.runtime.modules && plugin.runtime.modules.myscripts && typeof plugin.runtime.modules.myscripts.serveIcon === "function") {
                plugin.runtime.modules.myscripts.serveIcon(req, res, user);
            } else shared.send(res, 404, "text/plain; charset=utf-8", "Folder icon unavailable");
            return;
        }
        if (moduleName) { plugin.runtime.request("GET", moduleName, asset, req, res, user); return; }
        if (!shared.isSiteAdmin(user)) { shared.send(res, 403, "text/plain; charset=utf-8", "Forbidden"); return; }
        var data = plugin.runtime.adminSnapshot(user);
        try {
            res.render("MyCompany", {
                title: "My Company",
                pluginShortName: String(req && req.query && req.query.pin || plugin.shortName || "MyCompany"),
                adminDataJson: JSON.stringify(data).replace(/</g, "\u003c").replace(/>/g, "\u003e").replace(/&/g, "\u0026")
            });
        } catch (error) {
            console.error("MyCompany admin render failed", error);
            shared.send(res, 500, "text/plain; charset=utf-8", "Internal error");
        }
    };

    obj.post = function (req, res, user) {
        var moduleName = String(req && req.query && req.query.module || "");
        var asset = String(req && req.query && req.query.asset || "");
        var action = String(req && req.query && req.query.action || "");
        if (moduleName) {
            if (req && req.body && typeof req.body.payload === "string") req.body = shared.parseJsonObject(req.body.payload, {});
            var module = moduleObject(moduleName);
            if (asset === "settings" && shared.isSiteAdmin(user) && module && !module.__loadError && typeof module.apiPost === "function") {
                try {
                    Promise.resolve(module.apiPost(asset, req, user)).then(function (value) {
                        shared.sendJson(res, 200, value || { ok: true });
                    }).catch(function (error) {
                        shared.sendJson(res, 400, { ok: false, error: String(error && error.message || error) });
                    });
                } catch (error) {
                    shared.sendJson(res, 400, { ok: false, error: String(error && error.message || error) });
                }
                return;
            }
            plugin.runtime.request("POST", moduleName, asset, req, res, user);
            return;
        }
        if (action === "save-settings" || action === "save-modules") {
            var payload = {
                modules: shared.parseJsonObject(req && req.body && req.body.modules, {}),
                moduleOptions: shared.parseJsonObject(req && req.body && req.body.moduleOptions, {}),
                integrations: shared.parseJsonObject(req && req.body && req.body.integrations, {}),
                secrets: shared.parseJsonObject(req && req.body && req.body.secrets, {})
            };
            plugin.runtime.saveAdminSettings(user, payload).then(function (snapshot) {
                shared.sendJson(res, 200, { ok: true, snapshot: snapshot });
            }).catch(function (error) {
                shared.sendJson(res, 403, { ok: false, error: String(error && error.message || error) });
            });
            return;
        }
        shared.sendJson(res, 400, { ok: false, error: "Unknown MyCompany action." });
    };

    return obj;
};
