"use strict";

var fs = require("fs");
var path = require("path");
var shared = require("./core/shared.js");
var pluginAdminFactory = require("./core/plugin-admin-service-backup-discovery.js");
var serverAdminFactory = require("./core/server-admin-service.js");

module.exports.admin = function (plugin) {
    var obj = {};
    var root = __dirname;
    var pluginAdmin = pluginAdminFactory.createPluginAdminService({
        pluginHandler: plugin.parent,
        fs: fs,
        path: path,
        protectedShortName: plugin.shortName
    });
    var serverAdmin = serverAdminFactory.createServerAdminService({
        path: path,
        meshRoot: path.dirname(path.dirname(plugin.parent.pluginPath))
    });

    var assets = {
        "admin.css": ["web/admin/admin.css", "text/css; charset=utf-8"],
        "admin-ui-enhancements.css": ["web/admin/admin-ui-enhancements.css", "text/css; charset=utf-8"],
        "admin.js": ["web/admin/admin.js", "text/javascript; charset=utf-8"],
        "admin-layout.js": ["web/admin/admin-layout.js", "text/javascript; charset=utf-8"],
        "admin-approval-policy.js": ["web/admin/admin-approval-policy.js", "text/javascript; charset=utf-8"],
        "admin-ui-enhancements.js": ["web/admin/admin-ui-enhancements.js", "text/javascript; charset=utf-8"],
        "admin-plugin-updates.js": ["web/admin/admin-plugin-updates.js", "text/javascript; charset=utf-8"],
        "admin-marketplace.js": ["web/admin/admin-marketplace.js", "text/javascript; charset=utf-8"],
        "admin-move-mesh-levels.js": ["web/admin/admin-move-mesh-levels.js", "text/javascript; charset=utf-8"],
        "admin-portal.js": ["web/admin/admin-portal.js", "text/javascript; charset=utf-8"],
        "marketplace.json": ["marketplace.json", "application/json; charset=utf-8"],

        "core.js": ["public/core.js", "text/javascript; charset=utf-8"],
        "mesh-plugin-core.js": ["public/mesh-plugin-core.js", "text/javascript; charset=utf-8"],
        "module-shell.js": ["public/module-shell.js", "text/javascript; charset=utf-8"],
        "runtime.js": ["public/runtime.js", "text/javascript; charset=utf-8"],
        "shared/icon-registry.js": ["public/shared/icon-registry.js", "text/javascript; charset=utf-8"],
        "icons/sirk-ui.svg": ["assets/icons/sirk-ui.svg", "image/svg+xml; charset=utf-8"],

        "native-portal-launcher.js": ["public/native-portal-launcher.js", "text/javascript; charset=utf-8"],
        "portal.js": ["public/portal.js", "text/javascript; charset=utf-8"],
        "portal-device-tabs.js": ["public/portal-device-tabs.js", "text/javascript; charset=utf-8"],
        "portal-device-tabs.css": ["public/portal-device-tabs.css", "text/css; charset=utf-8"],
        "portal-icon-data.js": ["public/portal-icon-data.js", "text/javascript; charset=utf-8"],
        "portal-subfolder-icons.js": ["public/portal-subfolder-icons.js", "text/javascript; charset=utf-8"],
        "portal-collapse-isolation.js": ["public/portal-collapse-isolation.js", "text/javascript; charset=utf-8"],
        "portal-folder-collapse.js": ["public/portal-folder-collapse.js", "text/javascript; charset=utf-8"],
        "portal-management.js": ["public/portal-management.js", "text/javascript; charset=utf-8"],
        "portal-approval.js": ["public/portal-approval.js", "text/javascript; charset=utf-8"],
        "portal-approval-hook.js": ["public/portal-approval-hook.js", "text/javascript; charset=utf-8"],
        "portal-fix.js": ["public/portal-fix.js", "text/javascript; charset=utf-8"],
        "portal-ui-fix.js": ["public/portal-ui-fix.js", "text/javascript; charset=utf-8"],
        "portal.css": ["public/portal.css", "text/css; charset=utf-8"],
        "native-approval.css": ["public/native-approval.css", "text/css; charset=utf-8"],

        "myscripts.js": ["public/myscripts.js", "text/javascript; charset=utf-8"],
        "myscripts.css": ["public/myscripts.css", "text/css; charset=utf-8"],
        "myscripts-menu.svg": ["assets/myscripts-menu.svg", "image/svg+xml; charset=utf-8"],
        "mycommands.js": ["public/mycommands.js", "text/javascript; charset=utf-8"],
        "myjira.js": ["public/myjira.js", "text/javascript; charset=utf-8"],
        "defendertools.js": ["public/defendertools.js", "text/javascript; charset=utf-8"],
        "approvalcenter.js": ["public/modules/approvalcenter.js", "text/javascript; charset=utf-8"],
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
        var definition = assets[name];
        if (!definition) {
            shared.send(res, 404, "text/plain; charset=utf-8", "Not found");
            return;
        }
        fs.readFile(path.join(root, definition[0]), function (error, data) {
            if (error) shared.send(res, 404, "text/plain; charset=utf-8", "Not found");
            else shared.send(res, 200, definition[1], data);
        });
    }

    function serveVendorPortal(res, asset) {
        var prefix = "vendor/sirk-portal/";
        if (asset.indexOf(prefix) !== 0) return false;
        var name = asset.slice(prefix.length);
        if (!/^[a-z0-9._-]+$/i.test(name)) {
            shared.send(res, 400, "text/plain; charset=utf-8", "Invalid asset name");
            return true;
        }
        var type = /\.css$/i.test(name) ? "text/css; charset=utf-8" : "text/javascript; charset=utf-8";
        fs.readFile(path.join(root, "public", "vendor", "sirk-portal", name), function (error, data) {
            if (error) shared.send(res, 404, "text/plain; charset=utf-8", "SirK Portal vendor asset unavailable");
            else shared.send(res, 200, type, data);
        });
        return true;
    }

    function moduleObject(moduleName) {
        return plugin.runtime && plugin.runtime.modules && plugin.runtime.modules[String(moduleName || "").toLowerCase()];
    }

    function safeAdminJson(value) {
        var slash = String.fromCharCode(92);
        return JSON.stringify(value).replace(/</g, slash + "u003c").replace(/>/g, slash + "u003e").replace(/&/g, slash + "u0026");
    }

    function sameOrigin(req) {
        var headers = req && req.headers || {};
        var source = String(headers.origin || headers.referer || "");
        if (!source) return true;
        try { return new URL(source).host.toLowerCase() === String(headers.host || "").toLowerCase(); }
        catch (error) { return false; }
    }

    obj.req = function (req, res, user) {
        var asset = String(req && req.query && req.query.asset || "");
        var moduleName = String(req && req.query && req.query.module || "");
        var action = String(req && req.query && req.query.action || "");
        if (serveVendorPortal(res, asset)) return;
        if (assets[asset]) { serve(res, asset); return; }
        if (asset === "bootstrap") { plugin.runtime.request("GET", "_runtime", "bootstrap", req, res, user); return; }
        if (moduleName === "myscripts" && asset === "folder-icon") {
            if (plugin.runtime.modules && plugin.runtime.modules.myscripts && typeof plugin.runtime.modules.myscripts.serveIcon === "function") plugin.runtime.modules.myscripts.serveIcon(req, res, user);
            else shared.send(res, 404, "text/plain; charset=utf-8", "Folder icon unavailable");
            return;
        }
        if (moduleName) { plugin.runtime.request("GET", moduleName, asset, req, res, user); return; }
        if (!shared.isSiteAdmin(user)) { shared.send(res, 403, "text/plain; charset=utf-8", "Forbidden"); return; }
        if (action === "plugin-state") {
            pluginAdmin.list(user).then(function (plugins) { shared.sendJson(res, 200, { ok: true, plugins: plugins }); })
                .catch(function (error) { shared.sendJson(res, 500, { ok: false, error: String(error && error.message || error) }); });
            return;
        }
        if (action === "server-state") {
            serverAdmin.services(user).then(function (services) { shared.sendJson(res, 200, { ok: true, services: services }); })
                .catch(function (error) { shared.sendJson(res, 500, { ok: false, error: String(error && error.message || error) }); });
            return;
        }
        try {
            res.render("MyCompany", {
                title: "My Company",
                pluginShortName: String(req && req.query && req.query.pin || plugin.shortName || "MyCompany"),
                adminDataJson: safeAdminJson(plugin.runtime.adminSnapshot(user))
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
                    Promise.resolve(module.apiPost(asset, req, user))
                        .then(function (value) { shared.sendJson(res, 200, value || { ok: true }); })
                        .catch(function (error) { shared.sendJson(res, 400, { ok: false, error: String(error && error.message || error) }); });
                } catch (error) { shared.sendJson(res, 400, { ok: false, error: String(error && error.message || error) }); }
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
            plugin.runtime.saveAdminSettings(user, payload)
                .then(function (snapshot) { shared.sendJson(res, 200, { ok: true, snapshot: snapshot }); })
                .catch(function (error) { shared.sendJson(res, 403, { ok: false, error: String(error && error.message || error) }); });
            return;
        }
        if (action === "plugin-operation") {
            if (!sameOrigin(req)) { shared.sendJson(res, 403, { ok: false, error: "Cross-origin request rejected." }); return; }
            var pluginPayload = shared.parseJsonObject(req && req.body && req.body.payload, {});
            pluginAdmin.operate(user, pluginPayload.operation, pluginPayload).then(function (result) {
                return pluginAdmin.list(user).then(function (plugins) { shared.sendJson(res, 200, { ok: true, result: result, plugins: plugins }); });
            }).catch(function (error) { shared.sendJson(res, 400, { ok: false, error: String(error && error.message || error) }); });
            return;
        }
        if (action === "server-restart") {
            if (!sameOrigin(req)) { shared.sendJson(res, 403, { ok: false, error: "Cross-origin request rejected." }); return; }
            var serverPayload = shared.parseJsonObject(req && req.body && req.body.payload, {});
            serverAdmin.restart(user, serverPayload.serviceName)
                .then(function (result) { shared.sendJson(res, 202, { ok: true, result: result }); })
                .catch(function (error) { shared.sendJson(res, 400, { ok: false, error: String(error && error.message || error) }); });
            return;
        }
        shared.sendJson(res, 400, { ok: false, error: "Unknown MyCompany action." });
    };

    return obj;
};
