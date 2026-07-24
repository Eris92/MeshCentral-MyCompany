"use strict";

var path = require("path");
var runtimeFactory = require("./core/runtime-portal.js");

module.exports.createRuntime = function (host, pluginRoot) {
    var syntheticParent = {
        fs: host.fs,
        path: host.path,
        pluginPath: pluginRoot,
        parent: { datapath: path.dirname(host.dataRoot) }
    };
    var runtime = runtimeFactory.createRuntime({
        parent: syntheticParent,
        pluginRoot: pluginRoot,
        source: { shortName: "SIRKPortalStandalone" }
    });
    var originalBootstrap = runtime.bootstrap;
    runtime.bootstrap = function (user) {
        var value = originalBootstrap(user && user.raw || user);
        value.host = { kind: host.kind, capabilities: host.capabilities };
        return value;
    };
    runtime.host = host;
    return runtime;
};
