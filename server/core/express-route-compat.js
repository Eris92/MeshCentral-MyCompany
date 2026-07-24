"use strict";

function escapeRegExp(value) {
    return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function exactPath(value) {
    return new RegExp("^" + escapeRegExp(value) + "$");
}

function withExactPortalRedirect(app, register) {
    if (!app || typeof app.get !== "function") return register();
    var originalGet = app.get;
    app.get = function (route) {
        var args = Array.prototype.slice.call(arguments);
        if (typeof route === "string" && /\/sirkportal$/i.test(route)) {
            args[0] = exactPath(route);
        }
        return originalGet.apply(this, args);
    };
    try {
        return register();
    } finally {
        app.get = originalGet;
    }
}

module.exports = {
    exactPath: exactPath,
    withExactPortalRedirect: withExactPortalRedirect
};
