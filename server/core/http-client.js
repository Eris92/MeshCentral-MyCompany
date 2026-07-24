"use strict";

var http = require("http");
var https = require("https");

function cleanMessage(value) {
    if (value == null) return "";
    if (typeof value === "string") return value;
    try { return JSON.stringify(value); } catch (error) { return String(value); }
}

function responseError(statusCode, parsed, text, prefix) {
    var details = parsed && (
        parsed.errorMessages ||
        parsed.errors ||
        parsed.error ||
        parsed.message
    );
    var message = cleanMessage(details) || String(text || "").trim() ||
        (String(prefix || "HTTP") + " " + statusCode);
    var error = new Error(message);
    error.statusCode = statusCode;
    error.response = parsed || text || null;
    return error;
}

function removeSensitiveHeaders(headers) {
    var result = {};
    Object.keys(headers || {}).forEach(function (name) {
        if (!/^(authorization|cookie|proxy-authorization)$/i.test(name)) result[name] = headers[name];
    });
    return result;
}

function requestOnce(options, redirectsLeft) {
    var endpoint = options.url instanceof URL ? options.url : new URL(options.url);
    if (endpoint.protocol !== "http:" && endpoint.protocol !== "https:") {
        return Promise.reject(new Error("Unsupported HTTP protocol: " + endpoint.protocol));
    }
    var transport = endpoint.protocol === "https:" ? https : http;
    var body = Object.prototype.hasOwnProperty.call(options, "body") ? options.body : options.json;
    if (body != null && typeof body !== "string" && !Buffer.isBuffer(body)) {
        body = JSON.stringify(body);
    }

    var headers = Object.assign({ Accept: "application/json" }, options.headers || {});
    if (body != null && headers["Content-Type"] == null && headers["content-type"] == null) {
        headers["Content-Type"] = "application/json";
    }
    if (body != null && headers["Content-Length"] == null && headers["content-length"] == null) {
        headers["Content-Length"] = Buffer.byteLength(body);
    }

    return new Promise(function (resolve, reject) {
        var request = transport.request({
            protocol: endpoint.protocol,
            hostname: endpoint.hostname,
            port: endpoint.port || undefined,
            path: endpoint.pathname + endpoint.search,
            method: String(options.method || (body == null ? "GET" : "POST")).toUpperCase(),
            headers: headers,
            rejectUnauthorized: options.verifyTls !== false
        }, function (response) {
            if (
                response.statusCode >= 300 &&
                response.statusCode < 400 &&
                response.headers.location &&
                redirectsLeft > 0
            ) {
                response.resume();
                var redirectedUrl = new URL(response.headers.location, endpoint);
                if (endpoint.protocol === "https:" && redirectedUrl.protocol !== "https:") {
                    reject(new Error("HTTPS redirect downgrade is not allowed."));
                    return;
                }
                var redirected = Object.assign({}, options, { url: redirectedUrl.href });
                if (redirectedUrl.origin !== endpoint.origin) redirected.headers = removeSensitiveHeaders(options.headers);
                requestOnce(redirected, redirectsLeft - 1).then(resolve, reject);
                return;
            }

            var chunks = [];
            var size = 0;
            var maxBytes = Math.max(1024, Number(options.maxBytes) || 16 * 1024 * 1024);
            response.on("data", function (chunk) {
                size += chunk.length;
                if (size > maxBytes) {
                    request.destroy(new Error("HTTP response exceeded the configured size limit."));
                    return;
                }
                chunks.push(chunk);
            });
            response.on("end", function () {
                var text = Buffer.concat(chunks).toString("utf8");
                var parsed = null;
                if (text) {
                    try { parsed = JSON.parse(text); } catch (error) { parsed = null; }
                }
                if (response.statusCode < 200 || response.statusCode >= 300) {
                    reject(responseError(response.statusCode, parsed, text, options.errorPrefix));
                    return;
                }
                resolve({
                    statusCode: response.statusCode,
                    headers: response.headers,
                    text: text,
                    json: parsed
                });
            });
        });

        request.setTimeout(Math.max(1000, Number(options.timeoutMs) || 45000), function () {
            request.destroy(new Error(String(options.errorPrefix || "HTTP") + " request timed out."));
        });
        request.on("error", reject);
        if (body != null) request.write(body);
        request.end();
    });
}

function request(options) {
    options = options || {};
    if (!options.url) return Promise.reject(new Error("HTTP URL is required."));
    return requestOnce(options, Math.max(0, Math.min(5, Number(options.maxRedirects) || 2)));
}

function requestJson(options) {
    return request(options).then(function (response) {
        if (response.json != null) return response.json;
        if (!response.text) return {};
        throw new Error(String(options && options.errorPrefix || "HTTP") + " returned invalid JSON.");
    });
}

module.exports = {
    request: request,
    requestJson: requestJson
};
