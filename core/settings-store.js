"use strict";
var shared = require("./shared.js");

function isObject(value) { return value && typeof value === "object" && !Array.isArray(value); }
function merge(base, override) {
    var result = {}; base = isObject(base) ? base : {}; override = isObject(override) ? override : {};
    Object.keys(base).forEach(function (key) {
        result[key] = isObject(base[key]) ? merge(base[key], {}) : shared.copy(base[key]);
    });
    Object.keys(override).forEach(function (key) {
        result[key] = isObject(base[key]) && isObject(override[key])
            ? merge(base[key], override[key]) : shared.copy(override[key]);
    });
    return result;
}

module.exports.createSettingsStore = function (options) {
    var fs = options.fs, path = options.path, filePath = options.filePath;
    var defaults = shared.copy(options.defaults || {}), queue = Promise.resolve();
    function read() { return merge(defaults, shared.readJson(fs, filePath, {})); }
    function write(value) {
        var normalized = merge(defaults, value);
        shared.writeJsonAtomic(fs, path, filePath, normalized);
        return normalized;
    }
    function update(mutator) {
        var operation = queue.then(function () {
            var next = mutator(shared.copy(read()));
            if (!isObject(next)) throw new Error("Settings update must return an object.");
            return write(next);
        });
        queue = operation.catch(function () {});
        return operation;
    }
    function isModuleEnabled(key) {
        var value = read().modules && read().modules[key];
        return !!value && value.enabled !== false;
    }
    return { defaults: defaults, filePath: filePath, isModuleEnabled: isModuleEnabled,
        read: read, update: update, write: write };
};
