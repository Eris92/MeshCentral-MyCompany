"use strict";

var shared = require("./shared.js");
var atomicJson = require("./atomic-json.js");

function isObject(value) {
    return value && typeof value === "object" && !Array.isArray(value);
}

function merge(base, override) {
    var result = {};
    base = isObject(base) ? base : {};
    override = isObject(override) ? override : {};

    Object.keys(base).forEach(function (key) {
        result[key] = isObject(base[key])
            ? merge(base[key], {})
            : shared.copy(base[key]);
    });

    Object.keys(override).forEach(function (key) {
        result[key] = isObject(base[key]) && isObject(override[key])
            ? merge(base[key], override[key])
            : shared.copy(override[key]);
    });

    return result;
}

module.exports.createSettingsStore = function (options) {
    var fs = options.fs;
    var path = options.path;
    var filePath = options.filePath;
    var defaults = shared.copy(options.defaults || {});
    var queue = Promise.resolve();

    function read() {
        return merge(defaults, shared.readJson(fs, filePath, {}));
    }

    function write(value) {
        var normalized = merge(defaults, value);
        return atomicJson.write(fs, path, filePath, normalized)
            .then(function () {
                return normalized;
            });
    }

    function update(mutator) {
        var operation = queue.then(function () {
            return Promise.resolve(mutator(shared.copy(read())));
        }).then(function (next) {
            if (!isObject(next)) {
                throw new Error("Settings update must return an object.");
            }
            return write(next);
        });

        queue = operation.catch(function () {});
        return operation;
    }

    function isModuleEnabled(key) {
        var settings = read();
        var value = settings.modules && settings.modules[key];
        return !!value && value.enabled !== false;
    }

    return {
        defaults: defaults,
        filePath: filePath,
        isModuleEnabled: isModuleEnabled,
        read: read,
        update: update,
        write: write
    };
};
