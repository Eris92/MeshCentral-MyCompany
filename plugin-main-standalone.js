"use strict";

var fs = require("fs");
var path = require("path");
var baseFactory = require("./plugin-main.js");
var VERSION = require("./config.json").version;

var PORTAL_ROOT = path.join(__dirname, "public", "portal");
var ASSETS = {
    "vendor/sirk-portal/sirk-portal.css": "vendor/sirk-portal.css",
    "vendor/sirk-portal/portal-ui-contract.css": "vendor/portal-ui-contract.css",
    "main.css": "../shared/styles/main.css",
    "myscripts.css": "../modules/automation/style.css",
    "shared-ui/shared-ui.css": "../shared/ui/shared-ui.css",
    "shared-ui/toolbar.css": "../shared/ui/toolbar.css",
    "portal.css": "portal.css",
    "portal-standalone.css": "standalone/styles/base.css",
    "portal-standalone-devices.css": "standalone/styles/devices.css",
    "portal-device-workspace.css": "standalone/styles/device-workspace.css",
    "portal-device-tabs.css": "../native/device-tabs.css",
    "portal-module-shell.css": "standalone/styles/module-shell.css",
    "portal-login.css": "standalone/styles/login.css",
    "portal-cleanup.css": "standalone/styles/cleanup.css",
    "standalone-core.js": "standalone/scripts/core.js",
    "portal-standalone.js": "standalone/scripts/app.js",
    "portal-device-workspace.js": "standalone/scripts/device-workspace.js",
    "portal-device-tabs.js": "../native/device-tabs.js",
    "portal-standalone-nav.js": "standalone/scripts/navigation.js",
    "portal-terminal-connect.js": "standalone/scripts/terminal-connect.js",
    "portal-cleanup.js": "standalone/scripts/cleanup.js",
    "portal-login.js": "standalone/scripts/login.js",
    "portal-view-mode.js": "standalone/scripts/view-mode.js",
    "sirk-native-login.js": "standalone/scripts/native-login.js",
    "sirk-native-login.css": "standalone/styles/native-login.css",
    "portal-branding.js": "standalone/scripts/branding.js",
    "portal-branding.json": "standalone/branding.json",
    "vendor/sirk-portal/portal-ui-contract.js": "vendor/portal-ui-contract.js",
    "shared-ui/toolbar-config.js": "../shared/ui/toolbar-config.js",
    "shared-ui/toolbar-api.js": "../shared/ui/toolbar-api.js",
    "shared-ui/toolbar.js": "../shared/ui/toolbar.js",
    "shared-ui/tabs.js": "../shared/ui/tabs.js",
    "shared-ui/layout.js": "../shared/ui/layout.js",
    "shared-ui/settings.js": "../shared/ui/settings.js",
    "shared-ui/status-nav.js": "../shared/ui/status-nav.js",
    "shared-ui/tree.js": "../shared/ui/tree.js",
    "shared-ui/catalog.js": "../shared/ui/catalog.js",
    "shared-ui/results.js": "../shared/ui/results.js",
    "shared-ui/result-layout.js": "../shared/ui/result-layout.js",
    "shared-ui/script-tools.js": "../shared/ui/script-tools.js",
    "shared-ui/script-definition-form.js": "../shared/ui/script-definition-form.js",
    "shared-ui/confirm-execution-form.js": "../shared/ui/confirm-execution-form.js",
    "shared-ui/script-edit-actions.js": "../shared/ui/script-edit-actions.js",
    "shared-ui/system-credentials-form.js": "../shared/ui/system-credentials-form.js",
    "shared-ui/page.js": "../shared/ui/page.js",
    "module-shell.js": "../shared/module-shell.js",
    "portal-icon-data.js": "icons.js",
    "approvalcenter.js": "../modules/approvals/index.js",
    "moverequests.js": "../modules/move-requests/index.js",
    "mycommands.js": "../modules/commands/index.js",
    "myjira.js": "../modules/jira/index.js",
    "defendertools.js": "../modules/security/index.js",
    "portal-management.js": "management.js",
    "portal-subfolder-icons.js": "subfolder-icons.js",
    "portal-folder-collapse.js": "folder-collapse.js",
    "shared/icon-registry.js": "../shared/icon-registry.js",
    "icons/sirk-ui.svg": "../../assets/icons/sirk-ui.svg"
};

function normalizeBase(value) {
    value = String(value || "/");
    if (value.charAt(0) !== "/") value = "/" + value;
    if (value.charAt(value.length - 1) !== "/") value += "/";
    return value.replace(/\/+/g, "/");
}

function send(res, status, type, body) {
    if (typeof res.status === "function") res.status(status); else res.statusCode = status;
    if (typeof res.set === "function") {
        res.set("Content-Type", type);
        res.set("Cache-Control", "no-store");
        res.set("X-Content-Type-Options", "nosniff");
    } else if (typeof res.setHeader === "function") {
        res.setHeader("Content-Type", type);
        res.setHeader("Cache-Control", "no-store");
        res.setHeader("X-Content-Type-Options", "nosniff");
    }
    if (typeof res.send === "function") res.send(body); else res.end(body);
}

function redirect(res, target) {
    if (typeof res.redirect === "function") res.redirect(302, target);
    else {
        res.statusCode = 302;
        res.setHeader("Location", target);
        res.end();
    }
}

function contentType(file) {
    if (/\.css$/i.test(file)) return "text/css; charset=utf-8";
    if (/\.js$/i.test(file)) return "text/javascript; charset=utf-8";
    if (/\.svg$/i.test(file)) return "image/svg+xml; charset=utf-8";
    if (/\.png$/i.test(file)) return "image/png";
    if (/\.jpe?g$/i.test(file)) return "image/jpeg";
    if (/\.json$/i.test(file)) return "application/json; charset=utf-8";
    if (/\.html?$/i.test(file)) return "text/html; charset=utf-8";
    return "application/octet-stream";
}

function assetPath(name) {
    name = String(name || "").replace(/\\/g, "/");
    var relative = ASSETS[name];
    if (!relative) return null;
    var target = path.resolve(PORTAL_ROOT, relative);
    var allowedRoots = [
        path.resolve(__dirname, "public"),
        path.resolve(__dirname, "assets")
    ];
    return allowedRoots.some(function (root) {
        return target === root || target.indexOf(root + path.sep) === 0;
    }) ? target : null;
}

function json(res, status, value) {
    send(res, status, "application/json; charset=utf-8", JSON.stringify(value));
}

function bearerToken(req) {
    var match = String(req && req.headers && req.headers.authorization || "").match(/^Bearer\s+(.+)$/i);
    return match && match[1] || "";
}

function idempotencyKey(req, body) {
    return String(req && req.headers && req.headers["idempotency-key"] ||
        body && body.idempotencyKey || "").trim().slice(0, 128);
}

function apiFailure(res, error) {
    var message = String(error && error.message || error || "Request failed.");
    var status = /invalid api token|authentication|required|owner no longer exists/i.test(message) ? 401
        : /scope|permission|cannot use/i.test(message) ? 403
            : /not found|unavailable/i.test(message) ? 404
                : /already|changed|idempotency/i.test(message) ? 409 : 400;
    json(res, status, { ok: false, error: { code: "request_failed", message: message } });
}

module.exports.createPlugin = function (parent, shortName) {
    var plugin = baseFactory.createPlugin(parent, shortName);

    function approvalService() {
        return plugin.runtime && plugin.runtime.context && plugin.runtime.context.approval;
    }

    function handleApprovalApi(req, res) {
        var service = approvalService();
        if (!service) {
            json(res, 503, { ok: false, error: { code: "service_unavailable", message: "Approvals service is unavailable." } });
            return;
        }

        var method = String(req && req.method || "GET").toUpperCase();
        var route = String(req && (req.path || req.url) || "/").split("?")[0].replace(/\/+$/, "") || "/";
        if (method === "GET" && route === "/health") {
            json(res, 200, { ok: true, data: { service: "sirk-platform-approvals", apiVersion: "v1", pluginVersion: VERSION } });
            return;
        }

        var token = bearerToken(req);
        var resourceMatch = route.match(/^\/providers\/([a-z0-9_-]+)\/resources$/i);
        var requestMatch = route.match(/^\/requests\/([a-z0-9_-]+)$/i);
        var decisionMatch = route.match(/^\/requests\/([a-z0-9_-]+)\/decision$/i);

        try {
            if (method === "GET" && route === "/providers") {
                var providersContext = service.externalContext(token, "providers:read");
                var providers = service.listProviders().filter(function (provider) {
                    return !(providersContext.token.providers || []).length ||
                        providersContext.token.providers.indexOf(provider.type) >= 0;
                });
                json(res, 200, { ok: true, data: { providers: providers } });
                return;
            }
            if (method === "GET" && resourceMatch) {
                var resourcesContext = service.externalContext(token, "providers:read", resourceMatch[1]);
                Promise.resolve(service.getProviderResources(resourceMatch[1], resourcesContext.user, req.query || {}))
                    .then(function (resources) { json(res, 200, { ok: true, data: resources }); })
                    .catch(function (error) { apiFailure(res, error); });
                return;
            }
            if (method === "GET" && route === "/requests") {
                var listContext = service.externalContext(token, "requests:read", req.query && req.query.type);
                var query = Object.assign({}, req.query || {}, { allowedTypes: listContext.token.providers || [] });
                Promise.resolve(service.list(listContext.user, query))
                    .then(function (result) { json(res, 200, { ok: true, data: result }); })
                    .catch(function (error) { apiFailure(res, error); });
                return;
            }
            if (method === "GET" && requestMatch) {
                var readContext = service.externalContext(token, "requests:read");
                var request = service.getRequest(readContext.user, requestMatch[1]);
                if ((readContext.token.providers || []).length &&
                    readContext.token.providers.indexOf(request.type) < 0) {
                    throw new Error("API token cannot use this provider.");
                }
                json(res, 200, { ok: true, data: { request: request } });
                return;
            }
            if (method === "POST" && route === "/requests") {
                var body = req && req.body && typeof req.body === "object" ? req.body : {};
                var key = idempotencyKey(req, body);
                if (!key) throw new Error("Idempotency-Key is required.");
                Promise.resolve(service.submitExternal(token, String(body.type || "").toLowerCase(),
                    body.payload || {}, body.requesterNote || "", key))
                    .then(function (request) { json(res, 202, { ok: true, data: { request: request } }); })
                    .catch(function (error) { apiFailure(res, error); });
                return;
            }
            if (method === "POST" && decisionMatch) {
                var decisionBody = req && req.body && typeof req.body === "object" ? req.body : {};
                var decisionKey = idempotencyKey(req, decisionBody);
                if (!decisionKey) throw new Error("Idempotency-Key is required.");
                var decision = decisionBody.decision != null
                    ? String(decisionBody.decision).toLowerCase()
                    : decisionBody.approved === true ? "approve" : decisionBody.approved === false ? "reject" : "";
                Promise.resolve(service.decideExternal(token, decisionMatch[1], decision,
                    decisionBody.note || "", decisionKey))
                    .then(function (request) { json(res, 200, { ok: true, data: { request: request } }); })
                    .catch(function (error) { apiFailure(res, error); });
                return;
            }
        } catch (error) {
            apiFailure(res, error);
            return;
        }
        json(res, 404, { ok: false, error: { code: "endpoint_not_found", message: "API endpoint not found." } });
    }

    function portalSettings() {
        try {
            var settings = plugin.runtime && plugin.runtime.context && plugin.runtime.context.settings;
            var current = settings && typeof settings.read === "function" ? settings.read() : {};
            return current && current.modules && current.modules.portal || {};
        } catch (error) { return {}; }
    }

    function portalEnabled() {
        try {
            var state = plugin.runtime && typeof plugin.runtime.bootstrap === "function"
                ? plugin.runtime.bootstrap(null) : null;
            return !!(state && state.modules && state.modules.portal &&
                state.modules.portal.enabled && state.modules.portal.ready !== false);
        } catch (error) { return false; }
    }

    function renderTemplate(file, replacements) {
        var template = fs.readFileSync(path.join(PORTAL_ROOT, "standalone", file), "utf8");
        Object.keys(replacements).forEach(function (token) {
            template = template.replace(new RegExp(token, "g"), replacements[token]);
        });
        return template;
    }

    function portalHtml(base) {
        var assetBase = base + "sirkportal/assets";
        return renderTemplate("index.html", {
            "__API_BASE_JSON__": JSON.stringify(base + "pluginadmin.ashx"),
            "__ASSET_BASE_JSON__": JSON.stringify(assetBase),
            "__NATIVE_URL_JSON__": JSON.stringify(base + "meshcentral/"),
            "__LOGOUT_URL_JSON__": JSON.stringify(base + "logout"),
            "__USER_IMAGE_URL_JSON__": JSON.stringify(base + "userimage.ashx"),
            "__DEFAULT_USER_IMAGE_URL_JSON__": JSON.stringify(base + "images/user-256.png"),
            "__VERSION_JSON__": JSON.stringify(VERSION),
            "__ASSET_BASE__": assetBase,
            "__NATIVE_URL__": base + "meshcentral/",
            "__VERSION__": VERSION
        });
    }

    function loginHtml(base) {
        var assetBase = base + "sirkportal/assets";
        return renderTemplate("login.html", {
            "__ASSET_BASE_JSON__": JSON.stringify(assetBase),
            "__PORTAL_URL_JSON__": JSON.stringify(base + "sirkportal/"),
            "__NATIVE_URL_JSON__": JSON.stringify(base + "?sirkNative=1"),
            "__NATIVE_LOGIN_URL__": base + "?sirkAuth=1",
            "__FORCE_PORTAL_JSON__": JSON.stringify(portalSettings().forcePortalInterface === true),
            "__VERSION_JSON__": JSON.stringify(VERSION),
            "__ASSET_BASE__": assetBase,
            "__VERSION__": VERSION
        });
    }

    function installForcedNavigation(webserver, base) {
        var app = webserver.app;
        var rootPath = base === "/" ? "/" : base.replace(/\/$/, "");
        var rootSlash = rootPath === "/" ? "/" : rootPath + "/";
        var middleware = function (req, res, next) {
            var method = String(req && req.method || "GET").toUpperCase();
            var requestPath = String(req && (req.path || req.url) || "/").split("?")[0];
            if ((method !== "GET" && method !== "HEAD") ||
                (requestPath !== rootPath && requestPath !== rootSlash)) {
                next();
                return;
            }
            var requestUrl;
            try { requestUrl = new URL(String(req.originalUrl || req.url || requestPath), "http://sirk-platform.local"); }
            catch (error) { next(); return; }
            if (requestUrl.searchParams.get("sirkAuth") === "1") { next(); return; }
            var settings = portalSettings();
            if (settings.forcePortalInterface === true) { redirect(res, base + "sirkportal/"); return; }
            if (requestUrl.searchParams.get("sirkNative") === "1") { next(); return; }
            if (settings.forceNewLogin === true) { redirect(res, base + "sirkportal/login"); return; }
            next();
        };
        app.use(middleware);
        var router = app._router || app.router;
        var stack = router && router.stack;
        if (!Array.isArray(stack)) return;
        var index = stack.findIndex(function (layer) { return layer && layer.handle === middleware; });
        if (index > 0) stack.unshift(stack.splice(index, 1)[0]);
    }

    function registerDomain(webserver, domain) {
        var base = normalizeBase(domain && domain.url || "/");
        var portalPath = base + "sirkportal";
        var portalSlash = portalPath + "/";
        var loginPath = portalPath + "/login";
        var nativePath = base + "meshcentral";
        var nativeSlash = nativePath + "/";

        function servePortal(req, res) {
            if (!portalEnabled()) {
                send(res, 503, "text/html; charset=utf-8",
                    "<!doctype html><meta charset=\"utf-8\"><title>SIRK Portal disabled</title>" +
                    "<p>SIRK Portal is disabled in SIRK Platform settings.</p>" +
                    "<p><a href=\"" + nativeSlash + "\">Open MeshCentral</a></p>");
                return;
            }
            send(res, 200, "text/html; charset=utf-8", portalHtml(base));
        }

        webserver.app.get(portalPath, function (req, res) { redirect(res, portalSlash); });
        webserver.app.get(portalSlash, servePortal);
        webserver.app.get(loginPath, function (req, res) {
            send(res, 200, "text/html; charset=utf-8", loginHtml(base));
        });
        webserver.app.get(base + "sirkportal/assets/*", function (req, res) {
            var target = assetPath(req.params && req.params[0] || "");
            if (!target) { send(res, 404, "text/plain; charset=utf-8", "Not found"); return; }
            fs.readFile(target, function (error, data) {
                if (error) send(res, 404, "text/plain; charset=utf-8", "Not found");
                else send(res, 200, contentType(target), data);
            });
        });

        function openNative(req, res) {
            if (portalSettings().forcePortalInterface === true) redirect(res, portalSlash);
            else redirect(res, base + "?sirkNative=1");
        }
        webserver.app.get(nativePath, openNative);
        webserver.app.get(nativeSlash, openNative);
        installForcedNavigation(webserver, base);

        var apiPrefix = base + "sirk/api/v1/approvals";
        var jsonParser = webserver.bodyParser && webserver.bodyParser.json({ limit: "256kb", strict: true });
        webserver.app.use(apiPrefix, function (req, res) {
            var dispatch = function () { handleApprovalApi(req, res); };
            if (String(req.method || "GET").toUpperCase() !== "POST" || !jsonParser) {
                dispatch();
                return;
            }
            jsonParser(req, res, function (error) {
                if (error) json(res, 400, { ok: false, error: { code: "invalid_json", message: "The request body must contain valid JSON." } });
                else dispatch();
            });
        });
    }

    plugin.hook_setupHttpHandlers = function (webserver, meshServer) {
        if (!webserver || !webserver.app || webserver.__sirkPlatformStandaloneRoutes) return;
        webserver.__sirkPlatformStandaloneRoutes = true;
        var domains = meshServer && meshServer.config && meshServer.config.domains || { "": { url: "/" } };
        Object.keys(domains).forEach(function (key) {
            var domain = domains[key] || {};
            if (domain.dns != null || domain.share != null) return;
            registerDomain(webserver, domain);
        });
    };

    return plugin;
};
