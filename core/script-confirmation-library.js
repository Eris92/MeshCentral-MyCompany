"use strict";

var baseFactory = require("./script-library.js");
var shared = require("./shared.js");

var DIRECTIVE = /^\s*#\s*ConfirmExecution\s*:\s*(true|false)\s*$/i;

function parseEnabled(source) {
    var lines = String(source && source.text || source || "").replace(/^\uFEFF/, "").split(/\r?\n/);
    var enabled = false;
    for (var index = 0; index < lines.length; index++) {
        var line = String(lines[index] || "");
        var trimmed = line.trim();
        if (!trimmed) continue;
        if (trimmed.charAt(0) !== "#") break;
        var match = line.match(DIRECTIVE);
        if (match) enabled = String(match[1]).toLowerCase() === "true";
    }
    return enabled;
}

function updateDirective(sourceText, enabled) {
    var newline = String(sourceText || "").indexOf("\r\n") >= 0 ? "\r\n" : "\n";
    var lines = String(sourceText || "").replace(/^\uFEFF/, "").split(/\r?\n/);
    var boundary = lines.length;

    for (var index = 0; index < lines.length; index++) {
        var trimmed = String(lines[index] || "").trim();
        if (!trimmed || trimmed.charAt(0) === "#") continue;
        boundary = index;
        break;
    }

    var header = lines.slice(0, boundary).filter(function (line) {
        return !DIRECTIVE.test(String(line || ""));
    });
    var body = lines.slice(boundary);

    if (enabled === true) {
        var insertAt = 0;
        for (var headerIndex = 0; headerIndex < header.length; headerIndex++) {
            if (String(header[headerIndex] || "").trim().charAt(0) === "#") {
                insertAt = headerIndex + 1;
                break;
            }
        }
        header.splice(insertAt, 0, "# ConfirmExecution: true");
    }

    return header.concat(body).join(newline);
}

function decorateScript(base, script) {
    if (!script || script.type !== "script") return script;
    var result = shared.copy(script);
    var source = base.getSource(result.path);
    result.confirmExecution = parseEnabled(source);
    return result;
}

function decorateTree(base, node) {
    if (!node) return node;
    var result = shared.copy(node);
    if (result.type === "script") return decorateScript(base, result);
    result.children = (result.children || []).map(function (child) {
        return decorateTree(base, child);
    });
    return result;
}

module.exports.createScriptLibrary = function (options) {
    var base = baseFactory.createScriptLibrary(options);
    var wrapper = {};

    Object.keys(base).forEach(function (key) {
        wrapper[key] = base[key];
    });

    wrapper.getScript = function (relativePath, includeBody) {
        return decorateScript(base, base.getScript(relativePath, includeBody));
    };

    wrapper.getTree = function () {
        return decorateTree(base, base.getTree());
    };

    wrapper.getRoots = function () {
        return (wrapper.getTree().children || []).filter(function (node) {
            return node.type === "directory";
        });
    };

    wrapper.getDefinition = function (relativePath) {
        var definition = base.getDefinition(relativePath);
        if (!definition) return null;
        definition.confirmExecution = parseEnabled(base.getSource(relativePath));
        return definition;
    };

    wrapper.saveDefinition = function (relativePath, definition) {
        definition = definition && typeof definition === "object" ? definition : {};
        var enabled = definition.confirmExecution === true;
        var result = base.saveDefinition(relativePath, definition);
        var source = base.getSource(relativePath);
        if (!source) throw new Error("Script not found after definition save.");
        base.saveSource(relativePath, updateDirective(source.text, enabled));
        return {
            script: wrapper.getScript(relativePath, true),
            definition: wrapper.getDefinition(relativePath)
        };
    };

    return wrapper;
};
