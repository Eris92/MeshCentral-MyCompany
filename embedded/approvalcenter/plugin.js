"use strict";

var backendCore = require("./core.js");
var createModule = require("./module.js").createModule;

module.exports.approvalcenter = function (parent) {
    var obj = {};
    var root = parent.path.join(parent.pluginPath, "approvalcenter");
    var config = backendCore.readJson(parent.fs, parent.path.join(root, "config.json"), {
        name: "Approval Center", shortName: "approvalcenter", version: "3.0.6", viewmode: 105,
        pageText: "Approval Center", leftMenuIcon: "assets/ApprovalCenter.svg"
    });
    var service = createModule(config, parent, obj);
    var auditClick = backendCore.createAuditLogger(parent, "approvalcenter", obj);
    var assets = {
        "core.js": { path: parent.path.join(root, "public", "core.js"), type: "text/javascript; charset=utf-8" },
        "main.js": { path: parent.path.join(root, "public", "main.js"), type: "text/javascript; charset=utf-8" },
        "noapproval.js": { path: parent.path.join(root, "public", "noapproval.js"), type: "text/javascript; charset=utf-8" },
        "plugin.css": { path: parent.path.join(root, "public", "plugin.css"), type: "text/css; charset=utf-8" },
        "ApprovalCenter.svg": { path: parent.path.join(root, "assets", "ApprovalCenter.svg"), type: "image/svg+xml; charset=utf-8" }
    };

    obj.parent = parent;
    obj.meshServer = parent.parent;
    obj.exports = ["onWebUIStartupEnd", "goPageStart", "goPageEnd"];
    obj.server_startup = function () { service.initialize(); };

    function send(res, status, type, body) {
        res.statusCode = status;
        res.setHeader("Content-Type", type);
        res.setHeader("Cache-Control", "no-store");
        res.end(body);
    }

    function sendJson(res, status, value) {
        send(res, status, "application/json; charset=utf-8", JSON.stringify(value));
    }

    function sendApiJson(res, status, value) {
        res.statusCode = status;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader("Cache-Control", "no-store");
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.end(JSON.stringify(value));
    }

    function apiFailure(res, error) {
        var message = String(error && error.message || error || "Request failed.");
        var status = Number(error && error.statusCode) || (/not found|unavailable/i.test(message) ? 404 : (/permission|access|grant/i.test(message) ? 403 : (/already|changed|idempotency/i.test(message) ? 409 : 400)));
        sendApiJson(res, status, { ok: false, error: { code: String(error && error.apiCode || "request_failed"), message: message } });
    }

    function apiContext(req) {
        var authorization = String(req && req.headers && req.headers.authorization || "");
        var match = authorization.match(/^Bearer\s+(.+)$/i);
        return service.authenticateApiToken(match && match[1] || "");
    }

    function idempotencyKey(req, body) {
        return String(req && req.headers && req.headers["idempotency-key"] || body && body.idempotencyKey || "").trim().slice(0, 128);
    }

    function parseJsonArray(value, fallback) {
        if (value == null || value === "") value = fallback;
        if (Array.isArray(value)) return value;
        if (typeof value === "string") {
            try { value = JSON.parse(value); } catch (error) { return value ? [value] : []; }
        }
        return Array.isArray(value) ? value : (value ? [value] : []);
    }

    function handlePromise(res, promise, map) {
        Promise.resolve(promise).then(function (value) {
            sendJson(res, 200, map ? map(value) : { ok: true, result: value });
        }).catch(function (error) {
            sendJson(res, 400, { ok: false, error: String(error && error.message || error || "Request failed.") });
        });
    }

    obj.onWebUIStartupEnd = function () {
        if (typeof window === "undefined" || typeof document === "undefined") return;
        window.ApprovalCenter = window.ApprovalCenter || {};
        if (window.ApprovalCenter.bootstrapPromise) return;

        var assetUrl = function (asset) {
            var endpoint = new URL("pluginadmin.ashx", window.location.href);
            endpoint.searchParams.set("pin", "mycompany"); endpoint.searchParams.set("module", "approvals");
            endpoint.searchParams.set("asset", asset);
            endpoint.searchParams.set("v", "3.0.6");
            return endpoint.href;
        };
        var load = function (id, source) {
            return new Promise(function (resolve, reject) {
                var existing = document.getElementById(id);
                if (existing) {
                    if (existing.getAttribute("data-loaded") === "1") resolve();
                    else { existing.addEventListener("load", resolve, { once: true }); existing.addEventListener("error", reject, { once: true }); }
                    return;
                }
                var script = document.createElement("script");
                script.id = id; script.src = source; script.async = false;
                script.onload = function () { script.setAttribute("data-loaded", "1"); resolve(); };
                script.onerror = reject;
                (document.head || document.documentElement).appendChild(script);
            });
        };
        var style = document.getElementById("approvalcenter-style");
        if (!style) { style = document.createElement("link"); style.id = "approvalcenter-style"; style.rel = "stylesheet"; style.href = assetUrl("plugin.css"); (document.head || document.documentElement).appendChild(style); }
        window.ApprovalCenter.bootstrapPromise = load("approvalcenter-core-script", assetUrl("core.js")).then(function () {
            return load("approvalcenter-main-script", assetUrl("main.js"));
        }).then(function () {
            return load("approvalcenter-noapproval-script", assetUrl("noapproval.js"));
        }).then(function () { return window.ApprovalCenter.initialize(); }).catch(function (error) {
            window.ApprovalCenter.bootstrapPromise = null;
            if (window.console) window.console.error("Approval Center bootstrap error", error);
        });
    };

    obj.goPageStart = function (view) {
        if (typeof window !== "undefined" && window.ApprovalCenter && typeof window.ApprovalCenter.onNativePageStart === "function") window.ApprovalCenter.onNativePageStart(view);
    };
    obj.goPageEnd = function (view) {
        if (typeof window !== "undefined" && window.ApprovalCenter && typeof window.ApprovalCenter.onNativePageEnd === "function") window.ApprovalCenter.onNativePageEnd(view);
    };

    obj.handleExternalApi = function (req, res) {
        var method = String(req && req.method || "GET").toUpperCase();
        var route = String(req && req.path || req && req.url || "/").split("?")[0].replace(/\/+$/, "") || "/";
        if (method === "GET" && route === "/health") {
            sendApiJson(res, 200, { ok: true, data: { service: "approvalcenter", apiVersion: "v1", pluginVersion: service.getClientConfig().version } });
            return;
        }
        var context;
        try { context = apiContext(req); }
        catch (error) { apiFailure(res, error); return; }

        var resourceMatch = route.match(/^\/providers\/([a-z0-9_-]+)\/resources$/i);
        var requestMatch = route.match(/^\/requests\/([a-f0-9]{32})$/i);
        var decisionMatch = route.match(/^\/requests\/([a-f0-9]{32})\/decision$/i);
        if (method === "GET" && route === "/providers") {
            try {
                service.authorizeApi(context, "providers:read");
                var allowed = context.client.providerTypes;
                var providerRows = service.listProviders().filter(function (provider) { return !allowed.length || allowed.indexOf(provider.type) >= 0; });
                sendApiJson(res, 200, { ok: true, data: { providers: providerRows } });
            } catch (error) { apiFailure(res, error); }
            return;
        }
        if (method === "GET" && resourceMatch) {
            try { service.authorizeApi(context, "providers:read", resourceMatch[1]); }
            catch (error) { apiFailure(res, error); return; }
            Promise.resolve(service.getProviderResources(resourceMatch[1], context.user, req.query || {})).then(function (resources) {
                sendApiJson(res, 200, { ok: true, data: resources });
            }).catch(function (error) { apiFailure(res, error); });
            return;
        }
        if (method === "GET" && route === "/requests") {
            var requestedType = String(req && req.query && req.query.type || "").toLowerCase();
            try { service.authorizeApi(context, "requests:read", requestedType); }
            catch (error) { apiFailure(res, error); return; }
            var options = Object.assign({}, req.query || {}, { allowedTypes: context.client.providerTypes });
            Promise.resolve(service.list(context.user, options)).then(function (result) { sendApiJson(res, 200, { ok: true, data: result }); }).catch(function (error) { apiFailure(res, error); });
            return;
        }
        if (method === "GET" && requestMatch) {
            try { service.authorizeApi(context, "requests:read"); }
            catch (error) { apiFailure(res, error); return; }
            Promise.resolve(service.getRequest(context.user, requestMatch[1], context.client.providerTypes)).then(function (request) {
                service.authorizeApi(context, "requests:read", request.type);
                sendApiJson(res, 200, { ok: true, data: { request: request } });
            }).catch(function (error) { apiFailure(res, error); });
            return;
        }
        if (method === "POST" && route === "/requests") {
            var body = req && req.body && typeof req.body === "object" ? req.body : {};
            var type = String(body.type || "").toLowerCase(), key = idempotencyKey(req, body);
            try {
                service.authorizeApi(context, "requests:submit", type);
                if (!key) throw (function () { var error = new Error("Idempotency-Key is required."); error.statusCode = 400; error.apiCode = "idempotency_key_required"; return error; }());
            } catch (error) { apiFailure(res, error); return; }
            Promise.resolve(service.submit(type, context.user, body.payload || {}, body.requesterNote || "", { idempotencyKey: key, apiClientId: context.client.id, apiClientName: context.client.name })).then(function (request) {
                sendApiJson(res, 202, { ok: true, data: { request: request } });
            }).catch(function (error) { apiFailure(res, error); });
            return;
        }
        if (method === "POST" && decisionMatch) {
            var decisionBody = req && req.body && typeof req.body === "object" ? req.body : {}, decisionKey = idempotencyKey(req, decisionBody);
            try {
                service.authorizeApi(context, "requests:decide");
                if (!decisionKey) throw (function () { var error = new Error("Idempotency-Key is required."); error.statusCode = 400; error.apiCode = "idempotency_key_required"; return error; }());
            } catch (error) { apiFailure(res, error); return; }
            Promise.resolve(service.getRequest(context.user, decisionMatch[1], context.client.providerTypes)).then(function (request) {
                service.authorizeApi(context, "requests:decide", request.type);
                return service.decide(context.user, request.id, decisionBody.decision, decisionBody.note || "", { idempotencyKey: decisionKey, apiClientId: context.client.id, apiClientName: context.client.name });
            }).then(function (request) { sendApiJson(res, 200, { ok: true, data: { request: request } }); }).catch(function (error) { apiFailure(res, error); });
            return;
        }
        sendApiJson(res, 404, { ok: false, error: { code: "endpoint_not_found", message: "API endpoint not found." } });
    };

    obj.hook_setupHttpHandlers = function (webServer, meshCentral) {
        if (!webServer || !webServer.app || !webServer.bodyParser || webServer.__approvalCenterApiV1Registered) return;
        webServer.__approvalCenterApiV1Registered = true;
        var urls = Object.create(null), domains = meshCentral && meshCentral.config && meshCentral.config.domains || { "": { url: "/" } };
        Object.keys(domains).forEach(function (id) {
            var base = String(domains[id] && domains[id].url || "/");
            if (base.charAt(0) !== "/") base = "/" + base;
            if (base.charAt(base.length - 1) !== "/") base += "/";
            urls[base + "approvalcenter/api/v1"] = true;
        });
        var jsonParser = webServer.bodyParser.json({ limit: "256kb", strict: true });
        Object.keys(urls).forEach(function (prefix) {
            webServer.app.use(prefix, function (req, res) {
                var dispatch = function () {
                    var active = parent.plugins && parent.plugins.approvalcenter;
                    if (!active || typeof active.handleExternalApi !== "function") { sendApiJson(res, 503, { ok: false, error: { code: "service_unavailable", message: "Approval Center is unavailable." } }); return; }
                    active.handleExternalApi(req, res);
                };
                if (String(req.method || "").toUpperCase() !== "POST") { dispatch(); return; }
                jsonParser(req, res, function (error) {
                    if (error) { sendApiJson(res, 400, { ok: false, error: { code: "invalid_json", message: "The request body must contain valid JSON." } }); return; }
                    dispatch();
                });
            });
        });
    };

    obj.handleAdminReq = function (req, res, user) {
        var asset = String(req && req.query && req.query.asset || "");
        if (asset === "access") { sendJson(res, 200, { ok: true, access: service.getAccess(user) }); return; }
        if (asset === "bootstrap") { sendJson(res, 200, { ok: true, access: service.getAccess(user), config: service.getClientConfig(), providers: service.listProviders() }); return; }
        if (asset === "config") { sendJson(res, 200, service.getClientConfig()); return; }
        if (asset === "providers") { sendJson(res, 200, { ok: true, providers: service.listProviders() }); return; }
        if (asset === "settings") {
            var settings = service.getSettings(user);
            if (!settings) { sendJson(res, 403, { ok: false, error: "Permission denied." }); return; }
            sendJson(res, 200, { ok: true, settings: settings }); return;
        }
        if (asset === "overview") { handlePromise(res, service.overview(user), function (cards) { return { ok: true, cards: cards }; }); return; }
        if (asset === "requests") {
            handlePromise(res, service.list(user, req && req.query), function (result) { result.ok = true; return result; }); return;
        }
        var file = assets[asset];
        if (!file) { send(res, 404, "text/plain; charset=utf-8", "Not found"); return; }
        parent.fs.readFile(file.path, function (error, data) {
            if (error) send(res, 404, "text/plain; charset=utf-8", "Not found");
            else send(res, 200, file.type, data);
        });
    };

    obj.handleAdminPostReq = function (req, res, user) {
        var asset = String(req && req.query && req.query.asset || "");
        var body = req && req.body || {};
        if (asset === "click") { auditClick(user, body.target); sendJson(res, 200, { ok: true }); return; }
        if (asset === "decision") {
            handlePromise(res, service.decide(user, body.requestId, body.decision, body.note), function (request) { return { ok: true, request: request }; }); return;
        }
        if (asset === "provider-settings") {
            var groupIds = { 1: parseJsonArray(body.group1Ids, body.group1Id != null ? body.group1Id : body.groupId), 2: parseJsonArray(body.group2Ids, body.group2Id), 3: parseJsonArray(body.group3Ids, body.group3Id) };
            var meshAssignments = {}; try { meshAssignments = body.meshAssignmentsJson ? JSON.parse(body.meshAssignmentsJson) : {}; } catch (error) { meshAssignments = {}; }
            handlePromise(res, service.saveProviderSettings(user, body.type, groupIds, body.enabled, meshAssignments), function () { return { ok: true }; }); return;
        }
        if (asset === "cleanup") {
            handlePromise(res, service.clean(user, body.type, body.retentionDays), function (result) { result.ok = true; return result; }); return;
        }
        if (asset === "api-token-create") {
            var scopes = String(body.scopes || "").split(","), providerTypes = String(body.providerTypes || "").split(",").filter(Boolean);
            try { sendJson(res, 200, { ok: true, result: service.createApiClient(user, { name: body.name, userId: body.userId, scopes: scopes, providerTypes: providerTypes }) }); }
            catch (error) { sendJson(res, 400, { ok: false, error: String(error && error.message || error) }); }
            return;
        }
        if (asset === "api-token-revoke") {
            try { service.revokeApiClient(user, body.clientId); sendJson(res, 200, { ok: true }); }
            catch (error) { sendJson(res, 400, { ok: false, error: String(error && error.message || error) }); }
            return;
        }
        sendJson(res, 400, { ok: false, error: "Unknown action." });
    };

    return obj;
};
