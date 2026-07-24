"use strict";

var implementation = require("./plugin-main-standalone.js");
var routeCompat = require("./server/core/express-route-compat.js");

module.exports.SIRKPortal = function (parent) {
    var plugin = implementation.createPlugin(parent, "SIRKPortal");
    var setupHttpHandlers = plugin.hook_setupHttpHandlers;

    plugin.hook_setupHttpHandlers = function (webserver, meshServer) {
        return routeCompat.withExactPortalRedirect(webserver && webserver.app, function () {
            return setupHttpHandlers.call(plugin, webserver, meshServer);
        });
    };

    return plugin;
};
