"use strict";

var crypto = require("crypto");
var shared = require("./shared.js");

var VARIABLE_DIRECTIVE = /^(VariableSelectRequired|VariableSelect|VariableSwitchRequired|VariableSwitch|VariableUserRequired|VariableUser|VariableAssetRequired|VariableAsset|VariableRequired|Variable|SaveSecretRequired|SaveSecret)(PL|EN)?$/i;

function yes(value) {
    return /^(1|y|yes|t|tak|true)$/i.test(
        String(value == null ? "" : value).trim()
    );
}

function parseVariable(text, required, control) {
    var parts = String(text || "").split(",");
    var variable = String(parts.shift() || "").trim();
    var defaultValue = "";
    var match = variable.match(/^(.+?)\s*=\s*(.*)$/);

    if (match) {
        variable = match[1].trim();
        defaultValue = match[2];
    }

    if (
        control === "switch" &&
        parts.length &&
        /^(true|false|1|0|yes|no|tak|nie)$/i.test(
            String(parts[0]).trim()
        )
    ) {
        defaultValue = String(parts.shift()).trim();
    }

    var name = variable.replace(/^[\s$%]+/, "").trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) return null;

    var labelText = parts.join(",").trim() || name;
    var label = labelText;
    var description = "";
    var choices = [];

    if (control === "select") {
        var optionParts = labelText.split("|");
        if (optionParts.length && optionParts[0].indexOf("=") < 0) {
            label = String(optionParts.shift() || "").trim();
        }
        if (optionParts.length && optionParts[0].indexOf("=") < 0) {
            description = String(optionParts.shift() || "").trim();
        }
        choices = optionParts.map(function (item) {
            var pieces = item.split("=");
            var value = String(pieces.shift() || "").trim();
            return {
                value: value,
                label: String(pieces.join("=") || "").trim() || value
            };
        }).filter(function (item) {
            return item.value;
        });
        if (!defaultValue && choices.length) defaultValue = choices[0].value;
    } else {
        var separator = labelText.indexOf("|");
        if (separator >= 0) {
            label = labelText.slice(0, separator).trim() || name;
            description = labelText.slice(separator + 1).trim();
        }
    }

    if (control === "switch") {
        defaultValue = yes(defaultValue) ? "true" : "false";
    }

    return {
        name: name,
        label: shared.cleanText(label, 200),
        description: shared.cleanText(description, 1000),
        required: required === true,
        control: control || "text",
        defaultValue: shared.cleanText(defaultValue, 4000),
        options: choices
    };
}

function localizedHeader(value) {
    var match = String(value || "").match(/^(PL|EN)\s*:?\s*(.+)$/i);
    if (!match) return null;
    var text = String(match[2] || "").trim();
    var separator = text.indexOf("|");
    return {
        language: match[1].toLowerCase(),
        label: (separator >= 0 ? text.slice(0, separator) : text).trim(),
        description: separator >= 0 ? text.slice(separator + 1).trim() : ""
    };
}

function mergeVariableRecords(records, secret) {
    var order = [];
    var byName = Object.create(null);
    (records || []).forEach(function (record) {
        if (!record.parsed || (record.control === "secret") !== secret) return;
        var key = record.parsed.name.toLowerCase();
        var item = byName[key];
        if (!item) {
            item = byName[key] = {
                runtime: {
                    name: record.parsed.name,
                    label: record.parsed.label,
                    description: record.parsed.description || "",
                    labels: {},
                    descriptions: {},
                    required: record.required,
                    control: record.control,
                    defaultValue: record.parsed.defaultValue,
                    options: []
                },
                definition: {
                    directive: record.directive,
                    name: record.expression || record.parsed.name,
                    values: { pl: "", en: "" },
                    value: ""
                },
                options: Object.create(null)
            };
            order.push(item);
        }
        var language = record.language;
        if (language) {
            item.runtime.labels[language] = record.parsed.label;
            item.runtime.descriptions[language] = record.parsed.description || "";
            item.definition.values[language] = record.valueTail;
        } else {
            item.runtime.label = record.parsed.label;
            item.runtime.description = record.parsed.description || "";
            item.definition.value = record.value;
        }
        (record.parsed.options || []).forEach(function (option) {
            var optionItem = item.options[option.value];
            if (!optionItem) {
                optionItem = item.options[option.value] = { value: option.value, label: option.label, labels: {} };
                item.runtime.options.push(optionItem);
            }
            if (language) optionItem.labels[language] = option.label;
            else optionItem.label = option.label;
        });
    });
    order.forEach(function (item) {
        var runtime = item.runtime;
        runtime.label = runtime.labels.en || runtime.labels.pl || runtime.label || runtime.name;
        runtime.description = runtime.descriptions.en || runtime.descriptions.pl || runtime.description || "";
        runtime.options.forEach(function (option) {
            option.label = option.labels.en || option.labels.pl || option.label || option.value;
        });
    });
    return {
        runtime: order.map(function (item) { return item.runtime; }),
        definitions: order.map(function (item) { return item.definition; })
    };
}

function parseScript(path, text, fileName) {
    var lines = String(text || "")
        .replace(/^\uFEFF/, "")
        .split(/\r?\n/);
    var variableRecords = [];
    var approvalFlags = {};
    var label = path.basename(fileName, path.extname(fileName));
    var description = "";
    var locales = { pl: { label: "", description: "" }, en: { label: "", description: "" } };
    var extraHeaders = [];
    var titleParsed = false;
    var runAsUser = 0;
    var multiHost = false;
    var index = 0;

    while (index < lines.length) {
        var trimmed = String(lines[index] || "").trim();
        if (!trimmed) {
            index++;
            continue;
        }
        if (trimmed.charAt(0) !== "#") break;

        var header = trimmed.replace(/^\s*#\s*/, "");
        var approval = header.match(
            /^Approval(?:_([123]))?\s*:\s*(true|false)$/i
        );
        var runAs = header.match(/^runAsUser\s*:\s*([012])\s*$/i);
        var multi = header.match(/^MultiHost\s*:\s*(true|false)\s*$/i);
        var directive = header.match(/^([^:]+)\s*:\s*(.*)$/);
        var directiveName = directive && String(directive[1] || "").trim();
        var translatedTitle = localizedHeader(header);

        if (translatedTitle) {
            locales[translatedTitle.language] = {
                label: shared.cleanText(translatedTitle.label, 200),
                description: shared.cleanText(translatedTitle.description, 1000)
            };
            titleParsed = true;
        } else if (approval) {
            approvalFlags[Number(approval[1] || 1)] =
                approval[2].toLowerCase() === "true";
        } else if (runAs) {
            runAsUser = Number(runAs[1]);
        } else if (multi) {
            multiHost = multi[1].toLowerCase() === "true";
        } else if (directive && VARIABLE_DIRECTIVE.test(directiveName)) {
            var value = String(directive[2] || "").trim();
            var directiveMatch = directiveName.match(VARIABLE_DIRECTIVE);
            var baseDirective = directiveMatch[1];
            var language = String(directiveMatch[2] || "").toLowerCase();
            var kind = baseDirective.toLowerCase();
            var required = kind.indexOf("required") >= 0;
            var control = kind.indexOf("select") >= 0
                ? "select"
                : kind.indexOf("switch") >= 0
                    ? "switch"
                    : kind.indexOf("user") >= 0
                        ? "user"
                        : kind.indexOf("asset") >= 0
                            ? "asset"
                            : kind.indexOf("savesecret") >= 0
                                ? "secret"
                                : "text";
            var parsed = parseVariable(value, required, control);
            if (parsed) {
                var comma = value.indexOf(",");
                variableRecords.push({
                    directive: baseDirective,
                    language: language,
                    value: value,
                    expression: comma >= 0 ? value.slice(0, comma).trim().replace(/^[\s$%]+/, "") : value.trim().replace(/^[\s$%]+/, ""),
                    valueTail: comma >= 0 ? value.slice(comma + 1).trim() : "",
                    parsed: parsed,
                    required: required,
                    control: control
                });
            }
        } else if (!titleParsed) {
            var separator = header.indexOf("|");
            if (separator >= 0) {
                label = header.slice(0, separator).trim() || label;
                description = header.slice(separator + 1).trim();
            } else {
                label = header.trim() || label;
            }
            titleParsed = true;
        } else {
            extraHeaders.push(header);
        }
        index++;
    }

    var levels = [1, 2, 3].filter(function (level) {
        return approvalFlags[level] === true;
    });
    var mergedVariables = mergeVariableRecords(variableRecords, false);
    var mergedSecrets = mergeVariableRecords(variableRecords, true);
    label = locales.en.label || locales.pl.label || label;
    description = locales.en.description || locales.pl.description || description;

    return {
        approvalLevels: levels,
        body: lines.slice(index).join("\n"),
        description: shared.cleanText(description, 1000),
        extraHeaders: extraHeaders,
        label: shared.cleanText(label, 200),
        locales: locales,
        multiHost: multiHost,
        requiresApproval: levels.length > 0,
        runAsUser: runAsUser,
        secretDefinitions: mergedSecrets.definitions,
        secretVariables: mergedSecrets.runtime,
        variableDefinitions: mergedVariables.definitions,
        variables: mergedVariables.runtime
    };
}

function normalizeLevels(value) {
    value = Array.isArray(value) ? value : [];
    return [1, 2, 3].filter(function (level) {
        return value.map(Number).indexOf(level) >= 0;
    });
}

function normalizeDefinitions(value, secret) {
    value = Array.isArray(value) ? value : [];
    var result = [];
    value.forEach(function (item) {
        item = item && typeof item === "object" ? item : {};
        var directive = shared.cleanText(item.directive, 80).trim();
        var directiveMatch = directive.match(VARIABLE_DIRECTIVE);
        if (!directiveMatch) return;
        directive = directiveMatch[1];
        var isSecret = /^SaveSecret/i.test(directive);
        if (isSecret !== secret) return;
        var expression = shared.cleanText(item.name, 300).trim().replace(/^[\s$%]+/, "");
        var values = item.values && typeof item.values === "object" ? item.values : null;
        if (expression && values) {
            ["pl", "en"].forEach(function (language) {
                var tail = shared.cleanText(values[language], 4000).trim();
                if (!tail) return;
                result.push({ directive: directive + language.toUpperCase(), value: "$" + expression + ", " + tail });
            });
            return;
        }
        var text = shared.cleanText(item.value, 4000).trim();
        if (text) result.push({ directive: directive, value: text });
    });
    return result;
}

module.exports.createScriptLibrary = function (options) {
    var fs = options.fs;
    var path = options.path;
    var root = options.root;
    var readOnly = options.readOnly === true;
    var allowWrite = options.allowWrite === true;
    var extensions = options.extensions || {
        ".ps1": "powershell",
        ".cmd": "cmd",
        ".bat": "cmd"
    };
    var iconTypes = {
        ".svg": "image/svg+xml",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp"
    };
    var maxSize = Number(options.maxSize) || 2 * 1024 * 1024;
    var maxIconSize = Number(options.maxIconSize) || 1024 * 1024;
    var cache = Object.create(null);
    var treeCache = { value: null, expiresAt: 0 };

    function ensure() {
        var stat;
        try {
            stat = fs.statSync(root);
        } catch (error) {
            if (readOnly) {
                throw new Error("Script library directory not found: " + root);
            }
            fs.mkdirSync(root, { recursive: true });
            return;
        }
        if (!stat.isDirectory()) {
            throw new Error("Script library path is not a directory: " + root);
        }
    }

    function folderIcon(directory, relative) {
        var base = path.basename(directory);
        var extensionsList = Object.keys(iconTypes);
        for (var index = 0; index < extensionsList.length; index++) {
            var extension = extensionsList[index];
            var candidate = path.join(directory, base + extension);
            try {
                var stat = fs.statSync(candidate);
                if (
                    stat.isFile() &&
                    stat.size > 0 &&
                    stat.size <= maxIconSize
                ) {
                    var data = fs.readFileSync(candidate);
                    return {
                        path: (relative ? relative + "/" : "") + base + extension,
                        dataUrl: "data:" + iconTypes[extension] +
                            ";base64," + data.toString("base64")
                    };
                }
            } catch (error) {}
        }
        return { path: "", dataUrl: "" };
    }

    function folderMetadata(directory) {
        var base = path.basename(directory);
        var candidate = path.join(directory, base + ".menu");
        var locales = { pl: { label: "", description: "" }, en: { label: "", description: "" } };
        try {
            var stat = fs.statSync(candidate);
            if (!stat.isFile() || stat.size <= 0 || stat.size > 64 * 1024) return locales;
            fs.readFileSync(candidate, "utf8").replace(/^\uFEFF/, "").split(/\r?\n/).forEach(function (line) {
                var header = String(line || "").trim().replace(/^\s*#\s*/, "");
                var translated = localizedHeader(header);
                if (!translated) return;
                locales[translated.language] = {
                    label: shared.cleanText(translated.label, 200),
                    description: shared.cleanText(translated.description, 1000)
                };
            });
        } catch (error) {}
        return locales;
    }

    function targetFor(relativePath) {
        var target = shared.normalizeRelativePath(path, root, relativePath);
        if (!target) return null;
        var extension = path.extname(target).toLowerCase();
        return extensions[extension] ? target : null;
    }

    function getScript(relativePath, includeBody) {
        var target = targetFor(relativePath);
        if (!target) return null;

        var stat;
        try {
            stat = fs.statSync(target);
        } catch (error) {
            return null;
        }
        if (!stat.isFile() || stat.size > maxSize) return null;

        var key = target.toLowerCase();
        var cached = cache[key];
        if (
            cached &&
            cached.size === stat.size &&
            cached.mtimeMs === stat.mtimeMs
        ) {
            var hit = shared.copy(cached.value);
            if (!includeBody) delete hit.body;
            return hit;
        }

        var buffer = fs.readFileSync(target);
        var parsed = parseScript(path, buffer.toString("utf8"), target);
        var result = {
            type: "script",
            name: path.basename(target),
            path: String(relativePath).replace(/\\/g, "/"),
            shell: extensions[path.extname(target).toLowerCase()],
            label: parsed.label,
            description: parsed.description,
            locales: parsed.locales,
            variables: parsed.variables,
            secretVariables: parsed.secretVariables,
            approvalLevels: parsed.approvalLevels,
            requiresApproval: parsed.requiresApproval,
            runAsUser: parsed.runAsUser,
            multiHost: parsed.multiHost,
            hash: crypto.createHash("sha256").update(buffer).digest("hex"),
            size: stat.size,
            mtimeMs: stat.mtimeMs,
            body: parsed.body
        };

        cache[key] = {
            size: stat.size,
            mtimeMs: stat.mtimeMs,
            value: result
        };
        result = shared.copy(result);
        if (!includeBody) delete result.body;
        return result;
    }

    function getSource(relativePath) {
        var target = targetFor(relativePath);
        if (!target) return null;
        var stat;
        try {
            stat = fs.statSync(target);
        } catch (error) {
            return null;
        }
        if (!stat.isFile() || stat.size > maxSize) return null;
        return {
            path: String(relativePath).replace(/\\/g, "/"),
            text: fs.readFileSync(target, "utf8").replace(/^\uFEFF/, "")
        };
    }

    function saveSource(relativePath, source) {
        if (!allowWrite) throw new Error("Script library is read-only.");
        var target = targetFor(relativePath);
        if (!target) throw new Error("Invalid script path.");
        source = String(source == null ? "" : source).replace(/^\uFEFF/, "");
        if (!source.trim()) throw new Error("Script source cannot be empty.");
        if (Buffer.byteLength(source, "utf8") > maxSize) {
            throw new Error("Script exceeds the maximum allowed size.");
        }
        var stat;
        try {
            stat = fs.statSync(target);
        } catch (error) {
            throw new Error("Script not found.");
        }
        if (!stat.isFile()) throw new Error("Script not found.");
        fs.writeFileSync(target, source, "utf8");
        invalidate();
        return getScript(relativePath, true);
    }

    function getDefinition(relativePath) {
        var source = getSource(relativePath);
        if (!source) return null;
        var target = targetFor(relativePath);
        var parsed = parseScript(path, source.text, target);
        return {
            path: source.path,
            label: parsed.label,
            description: parsed.description,
            locales: parsed.locales,
            approvalLevels: parsed.approvalLevels,
            variables: parsed.variableDefinitions,
            secretVariables: parsed.secretDefinitions,
            runAsUser: parsed.runAsUser,
            multiHost: parsed.multiHost
        };
    }

    function saveDefinition(relativePath, definition) {
        if (!allowWrite) throw new Error("Script library is read-only.");
        var source = getSource(relativePath);
        if (!source) throw new Error("Script not found.");
        var target = targetFor(relativePath);
        var current = parseScript(path, source.text, target);
        definition = definition && typeof definition === "object" ? definition : {};

        var requestedLocales = definition.locales && typeof definition.locales === "object" ? definition.locales : {};
        var locales = { pl: {}, en: {} };
        ["pl", "en"].forEach(function (language) {
            var requested = requestedLocales[language] && typeof requestedLocales[language] === "object" ? requestedLocales[language] : {};
            var existing = current.locales && current.locales[language] || {};
            locales[language].label = shared.cleanText(requested.label || existing.label || definition.label || current.label || path.basename(target, path.extname(target)), 200).trim();
            locales[language].description = shared.cleanText(Object.prototype.hasOwnProperty.call(requested, "description") ? requested.description : (existing.description || definition.description || current.description || ""), 1000).trim();
        });
        var levels = normalizeLevels(definition.approvalLevels);
        var variables = normalizeDefinitions(definition.variables, false);
        var secrets = normalizeDefinitions(definition.secretVariables, true);
        var runAsUser = Math.max(0, Math.min(2, Number(definition.runAsUser) || 0));
        var multiHost = definition.multiHost === true;
        var newline = source.text.indexOf("\r\n") >= 0 ? "\r\n" : "\n";
        var header = [
            "#PL " + locales.pl.label + (locales.pl.description ? " | " + locales.pl.description : ""),
            "#EN " + locales.en.label + (locales.en.description ? " | " + locales.en.description : "")
        ];

        levels.forEach(function (level) {
            header.push("# Approval_" + level + ": true");
        });
        if (runAsUser) header.push("# runAsUser: " + runAsUser);
        if (multiHost) header.push("# MultiHost: true");
        variables.forEach(function (item) {
            header.push("# " + item.directive + ": " + item.value);
        });
        secrets.forEach(function (item) {
            header.push("# " + item.directive + ": " + item.value);
        });
        current.extraHeaders.forEach(function (item) {
            header.push("# " + item);
        });

        var next = header.join(newline);
        if (current.body) next += newline + newline + current.body;
        else next += newline;

        saveSource(relativePath, next);
        return {
            script: getScript(relativePath, true),
            definition: getDefinition(relativePath)
        };
    }

    function getTree() {
        if (treeCache.value && treeCache.expiresAt > Date.now()) {
            return shared.copy(treeCache.value);
        }
        ensure();

        function walk(directory, relative, depth) {
            var icon = relative
                ? folderIcon(directory, relative)
                : { path: "", dataUrl: "" };
            var locales = relative
                ? folderMetadata(directory)
                : { pl: { label: "Skrypty", description: "" }, en: { label: "Scripts", description: "" } };
            var node = {
                type: "directory",
                name: relative ? path.basename(directory) : "scripts",
                label: locales.en.label || locales.pl.label || (relative ? path.basename(directory) : "scripts"),
                description: locales.en.description || locales.pl.description || "",
                locales: locales,
                path: relative,
                icon: icon.path,
                iconData: icon.dataUrl,
                children: []
            };
            if (depth > 12) return node;

            var entries = [];
            try {
                entries = fs.readdirSync(directory, { withFileTypes: true });
            } catch (error) {
                node.error = error.message;
                return node;
            }
            entries.sort(function (left, right) {
                if (left.isDirectory() !== right.isDirectory()) {
                    return left.isDirectory() ? -1 : 1;
                }
                return left.name.localeCompare(right.name);
            });

            entries.forEach(function (entry) {
                if (
                    entry.name === ".git" ||
                    entry.name === "node_modules" ||
                    entry.name === ".gitkeep"
                ) return;

                var relativePath = relative
                    ? relative + "/" + entry.name
                    : entry.name;
                var fullPath = path.join(directory, entry.name);
                if (entry.isDirectory()) {
                    node.children.push(walk(fullPath, relativePath, depth + 1));
                } else if (
                    entry.isFile() &&
                    extensions[path.extname(entry.name).toLowerCase()]
                ) {
                    var script = getScript(relativePath, false);
                    if (script) node.children.push(script);
                }
            });
            return node;
        }

        treeCache = {
            value: walk(root, "", 0),
            expiresAt: Date.now() + 5000
        };
        return shared.copy(treeCache.value);
    }

    function getRoots() {
        return (getTree().children || []).filter(function (node) {
            return node.type === "directory";
        });
    }

    function invalidate() {
        cache = Object.create(null);
        treeCache = { value: null, expiresAt: 0 };
    }

    return {
        ensure: ensure,
        getDefinition: getDefinition,
        getRoots: getRoots,
        getScript: getScript,
        getSource: getSource,
        getTree: getTree,
        invalidate: invalidate,
        root: root,
        saveDefinition: saveDefinition,
        saveSource: saveSource
    };
};
