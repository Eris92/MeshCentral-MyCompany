"use strict";

function sendJson(res, status, value) {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.end(JSON.stringify(value));
}

function responseAdapter(res) {
    return {
        statusCode: 200,
        status: function (code) { this.statusCode = code; return this; },
        set: function (name, value) { res.setHeader(name, value); },
        setHeader: function (name, value) { res.setHeader(name, value); },
        send: function (body) { res.statusCode = this.statusCode; res.end(body); },
        end: function (body) { res.statusCode = this.statusCode; res.end(body); }
    };
}

module.exports.createHandler = function (runtime, host) {
    return function (req, res) {
        var url = new URL(req.url, "http://sirk.local");
        host.currentUser(req).then(function (user) {
            if (req.method === "GET" && url.pathname === "/api/bootstrap") {
                sendJson(res, 200, runtime.bootstrap(user));
                return;
            }
            if (req.method === "GET" && url.pathname === "/api/devices") {
                Promise.resolve(host.devices.list(user)).then(function (value) {
                    sendJson(res, 200, { ok: true, value: value });
                }).catch(function (error) {
                    sendJson(res, 503, { ok: false, error: String(error && error.message || error) });
                });
                return;
            }
            var match = url.pathname.match(/^\/api\/modules\/([^/]+)\/([^/]+)$/);
            if (!match) { sendJson(res, 404, { ok: false, error: "Endpoint not found." }); return; }
            runtime.request(req.method, decodeURIComponent(match[1]), decodeURIComponent(match[2]), {
                method: req.method,
                headers: req.headers,
                query: Object.fromEntries(url.searchParams.entries()),
                body: {}
            }, responseAdapter(res), user.raw || user);
        }).catch(function (error) {
            sendJson(res, 401, { ok: false, error: String(error && error.message || error) });
        });
    };
};
