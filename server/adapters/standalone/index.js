"use strict";

var fs = require("fs");
var path = require("path");
var contract = require("../../contracts/host-context.js");

module.exports.createHost = function (options) {
    options = options || {};
    var dataRoot = path.resolve(options.dataRoot || process.env.SIRK_DATA_ROOT || path.join(process.cwd(), "sirk-platform-data"));
    fs.mkdirSync(path.join(dataRoot, "extensions"), { recursive: true });
    return contract.createHostContext({
        kind: "standalone",
        dataRoot: dataRoot,
        fs: fs,
        path: path,
        auth: options.auth || {
            currentUser: function () {
                return {
                    id: process.env.SIRK_USER_ID || "local/admin",
                    displayName: process.env.SIRK_USER_NAME || "Local Administrator",
                    tenantId: process.env.SIRK_TENANT_ID || "local",
                    roles: ["admin"],
                    groups: [],
                    isAdmin: true
                };
            }
        },
        devices: options.devices || {
            list: function () { return Promise.resolve({ meshes: [], nodes: [] }); },
            resolve: function () { return Promise.reject(new Error("No device connector is configured.")); },
            runCommand: function () { return Promise.reject(new Error("No agent transport is configured.")); }
        },
        sessions: options.sessions || {
            create: function () { return Promise.reject(new Error("No remote-session connector is configured.")); }
        },
        capabilities: Object.assign({ devices: true, desktop: false, terminal: false, files: false, nativeUi: false, extensions: true }, options.capabilities || {}),
        logger: options.logger || console
    });
};
