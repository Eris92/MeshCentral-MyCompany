"use strict";

var shared = require("./shared.js");

function keyFor(value) {
    return String(value || "")
        .replace(/\\/g, "/")
        .toLowerCase();
}

module.exports.createScriptAdminService = function (options) {
    options = options || {};
    var context = options.context;
    var library = options.library;
    var namespace = String(options.namespace || "scripts");

    function requireAdmin(user) {
        if (!shared.isSiteAdmin(user)) {
            throw new Error("Permission denied.");
        }
    }

    function script(relativePath) {
        var value = library.getScript(relativePath, false);
        if (!value) throw new Error("Script not found.");
        return value;
    }

    function readStore() {
        var value = context.secrets.get(namespace);
        return value && typeof value === "object" ? value : {};
    }

    function getSecretState(user, relativePath) {
        requireAdmin(user);
        var value = script(relativePath);
        var store = readStore();
        var configured = store[keyFor(value.path)] || {};
        return {
            path: value.path,
            variables: (value.secretVariables || []).map(function (variable) {
                return {
                    name: variable.name,
                    label: variable.label,
                    required: variable.required === true,
                    configured: !!String(configured[variable.name] || "")
                };
            })
        };
    }

    function saveSecrets(user, relativePath, values, clearNames) {
        requireAdmin(user);
        var value = script(relativePath);
        var allowed = Object.create(null);
        (value.secretVariables || []).forEach(function (variable) {
            allowed[variable.name] = true;
        });

        values = values && typeof values === "object" ? values : {};
        clearNames = Array.isArray(clearNames) ? clearNames.map(String) : [];
        var store = readStore();
        var key = keyFor(value.path);
        var current = store[key] && typeof store[key] === "object"
            ? shared.copy(store[key])
            : {};

        Object.keys(values).forEach(function (name) {
            if (!allowed[name]) return;
            var secret = shared.cleanText(values[name], 8000);
            if (secret) current[name] = secret;
        });
        clearNames.forEach(function (name) {
            if (allowed[name]) delete current[name];
        });

        if (Object.keys(current).length) store[key] = current;
        else delete store[key];
        context.secrets.set(namespace, store);
        return getSecretState(user, value.path);
    }

    function secretValues(relativePath) {
        var value = script(relativePath);
        var store = readStore();
        var current = store[keyFor(value.path)] || {};
        var result = {};
        (value.secretVariables || []).forEach(function (variable) {
            var secret = String(current[variable.name] || "");
            if (variable.required && !secret) {
                throw new Error(
                    "Configure credential " + variable.label +
                    " for this script first."
                );
            }
            result[variable.name] = secret;
        });
        return result;
    }

    function getDefinition(user, relativePath) {
        requireAdmin(user);
        var definition = library.getDefinition(relativePath);
        var value = library.getScript(relativePath, true);
        if (!definition || !value) throw new Error("Script not found.");
        definition.body = String(value.body || "");
        definition.shell = value.shell || "";
        return definition;
    }

    function saveDefinition(user, relativePath, definition) {
        requireAdmin(user);
        definition = definition && typeof definition === "object" ? definition : {};
        var requestedBody = Object.prototype.hasOwnProperty.call(definition, "body")
            ? String(definition.body == null ? "" : definition.body).replace(/^\uFEFF/, "")
            : null;
        var result = library.saveDefinition(relativePath, definition);

        if (requestedBody !== null) {
            var source = library.getSource(relativePath);
            var generatedBody = String(result.script && result.script.body || "");
            var text = String(source && source.text || "");
            var prefix = generatedBody && text.slice(-generatedBody.length) === generatedBody
                ? text.slice(0, text.length - generatedBody.length)
                : text;
            prefix = prefix.replace(/[\t ]+$/gm, "").replace(/(?:\r?\n)+$/, "\n\n");
            library.saveSource(relativePath, prefix + requestedBody.replace(/^\s*\r?\n/, ""));
            result = {
                script: library.getScript(relativePath, true),
                definition: library.getDefinition(relativePath)
            };
            result.definition.body = String(result.script.body || "");
            result.definition.shell = result.script.shell || "";
        }
        return result;
    }

    return {
        getDefinition: getDefinition,
        saveDefinition: saveDefinition,
        getSecretState: getSecretState,
        saveSecrets: saveSecrets,
        secretValues: secretValues
    };
};