"use strict";

var baseFactory = require("./plugin-admin-service.js");

module.exports.createPluginAdminService = function (options) {
    var base = baseFactory.createPluginAdminService(options);
    return {
        list: base.list,
        listBackups: base.listBackups,
        operate: function (user, action, payload) {
            action = String(action || "").toLowerCase();
            payload = payload || {};
            if (action === "backups") {
                return base.listBackups(user, String(payload.id || "")).then(function (value) {
                    return {
                        changed: false,
                        restartRequired: false,
                        plugin: value.plugin,
                        backups: value.backups
                    };
                });
            }
            return base.operate(user, action, payload);
        }
    };
};