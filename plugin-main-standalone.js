"use strict";

var fs = require("fs");
var path = require("path");
var baseFactory = require("./plugin-main.js");

var VERSION = "1.5.8";

function normalizeBase(value) {
    value = String(value || "/");
    if (value.charAt(0) !== "/") value = "/" + value;
    if (value.charAt(value.length - 1) !== "/") value += "/";
    return value.replace(/\/+/g, "/");
}

function send(res, status, type, body) {
    if (typeof res.status === "function") res.status(status);
    else res.statusCode = status;
    if (typeof res.set === "function") {
        res.set("Content-Type", type);
        res.set("Cache-Control", "no-store");
        res.set("X-Content-Type-Options", "nosniff");
    } else if (typeof res.setHeader === "function") {
        res.setHeader("Content-Type", type);
        res.setHeader("Cache-Control", "no-store");
        res.setHeader("X-Content-Type-Options", "nosniff");
    }
    if (typeof res.send === "function") res.send(body);
    else res.end(body);
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

function safePublicPath(asset) {
    asset = decodeURIComponent(String(asset || "")).replace(/\\/g, "/");
    if (!asset || asset.indexOf("..") >= 0 || asset.charAt(0) === "/") return null;
    var publicRoot = path.resolve(__dirname, "public");
    var target = path.resolve(publicRoot, asset);
    if (target !== publicRoot && target.indexOf(publicRoot + path.sep) !== 0) return null;
    return target;
}

module.exports.createPlugin = function (parent, shortName) {
    var plugin = baseFactory.createPlugin(parent, shortName);

    if (plugin.exports.indexOf("hook_setupHttpHandlers") < 0) plugin.exports.push("hook_setupHttpHandlers");

    function portalEnabled() {
        try {
            var state = plugin.runtime && typeof plugin.runtime.bootstrap === "function" ? plugin.runtime.bootstrap(null) : null;
            return !!(state && state.modules && state.modules.portal && state.modules.portal.enabled && state.modules.portal.ready !== false);
        } catch (error) {
            return false;
        }
    }

    function portalHtml(base) {
        var template = fs.readFileSync(path.join(__dirname, "public", "portal-standalone.html"), "utf8");
        var assetBase = base + "sirkportal/assets";
        var apiBase = base + "pluginadmin.ashx";
        var nativeUrl = base + "meshcentral/";
        return template
            .replace(/__API_BASE_JSON__/g, JSON.stringify(apiBase))
            .replace(/__ASSET_BASE_JSON__/g, JSON.stringify(assetBase))
            .replace(/__NATIVE_URL_JSON__/g, JSON.stringify(nativeUrl))
            .replace(/__VERSION_JSON__/g, JSON.stringify(VERSION))
            .replace(/__ASSET_BASE__/g, assetBase)
            .replace(/__NATIVE_URL__/g, nativeUrl)
            .replace(/__VERSION__/g, VERSION);
    }

    function registerDomain(webserver, domain) {
        var base = normalizeBase(domain && domain.url || "/");
        var portalPath = base + "sirkportal";
        var portalPathSlash = portalPath + "/";
        var nativePath = base + "meshcentral";
        var nativePathSlash = nativePath + "/";

        function servePortal(req, res) {
            if (!portalEnabled()) {
                send(res, 503, "text/html; charset=utf-8", "<!doctype html><meta charset=\"utf-8\"><title>SirK Portal disabled</title><p>SirK Portal is disabled in MyCompany settings.</p><p><a href=\"" + nativePathSlash + "\">Open MeshCentral</a></p>");
                return;
            }
            send(res, 200, "text/html; charset=utf-8", portalHtml(base));
        }

        webserver.app.get(portalPath, servePortal);
        webserver.app.get(portalPathSlash, servePortal);

        webserver.app.get(base + "sirkportal/assets/*", function (req, res) {
            var asset = req.params && req.params[0] || "";
            var target = safePublicPath(asset);
            if (!target) {
                send(res, 400, "text/plain; charset=utf-8", "Invalid asset path");
                return;
            }
            fs.readFile(target, function (error, data) {
                if (error) send(res, 404, "text/plain; charset=utf-8", "Not found");
                else send(res, 200, contentType(target), data);
            });
        });

        function openNative(req, res) {
            redirect(res, base + "?sirkNative=1");
        }
        webserver.app.get(nativePath, openNative);
        webserver.app.get(nativePathSlash, openNative);
    }

    plugin.hook_setupHttpHandlers = function (webserver, meshServer) {
        if (!webserver || !webserver.app || webserver.__myCompanyStandaloneRoutes) return;
        webserver.__myCompanyStandaloneRoutes = true;
        var domains = meshServer && meshServer.config && meshServer.config.domains || { "": { url: "/" } };
        Object.keys(domains).forEach(function (key) {
            var domain = domains[key] || {};
            if (domain.dns != null || domain.share != null) return;
            registerDomain(webserver, domain);
        });
    };

    return plugin;
};