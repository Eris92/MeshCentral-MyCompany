"use strict";

var crypto = require("crypto");
var shared = require("./shared.js");

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

    var label = parts.join(",").trim() || name;
    var options = [];

    if (control === "select") {
        var optionParts = label.split("|");

        if (optionParts.length && optionParts[0].indexOf("=") < 0) {
            label = String(optionParts.shift() || "").trim();
        }

        options = optionParts.map(function (item) {
            var pieces = item.split("=");
            var value = String(pieces.shift() || "").trim();

            return {
                value: value,
                label: String(pieces.join("=") || "").trim() || value
            };
        }).filter(function (item) {
            return item.value;
        });

        if (!defaultValue && options.length) {
            defaultValue = options[0].value;
        }
    }

    if (control === "switch") {
        defaultValue = yes(defaultValue) ? "true" : "false";
    }

    return {
        name: name,
        label: shared.cleanText(label, 200),
        required: required === true,
        control: control || "text",
        defaultValue: shared.cleanText(defaultValue, 4000),
        options: options
    };
}

function parseScript(path, text, fileName) {
    var lines = String(text || "")
        .replace(/^\uFEFF/, "")
        .split(/\r?\n/);
    var variables = [];
    var secretVariables = [];
    var approvalFlags = {};
    var label = path.basename(fileName, path.extname(fileName));
    var description = "";
    var runAsUser = 0;
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
        var directive = header.match(
            /^(VariableSelectRequired|VariableSelect|VariableSwitchRequired|VariableSwitch|VariableUserRequired|VariableUser|VariableAssetRequired|VariableAsset|VariableRequired|Variable|SaveSecretRequired|SaveSecret)\s*:\s*(.+)$/i
        );

        if (approval) {
            approvalFlags[Number(approval[1] || 1)] =
                approval[2].toLowerCase() === "true";
        } else if (runAs) {
            runAsUser = Number(runAs[1]);
        } else if (directive) {
            var kind = directive[1].toLowerCase();
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
            var parsed = parseVariable(
                directive[2],
                required,
                control
            );

            if (parsed) {
                (control === "secret"
                    ? secretVariables
                    : variables
                ).push(parsed);
            }
        } else if (!description) {
            var separator = header.indexOf("|");

            if (separator >= 0) {
                label = header.slice(0, separator).trim() || label;
                description = header.slice(separator + 1).trim();
            } else {
                label = header.trim() || label;
            }
        }

        index++;
    }

    var levels = [1, 2, 3].filter(function (level) {
        return approvalFlags[level] === true;
    });

    return {
        approvalLevels: levels,
        body: lines.slice(index).join("\n"),
        description: shared.cleanText(description, 1000),
        label: shared.cleanText(label, 200),
        requiresApproval: levels.length > 0,
        runAsUser: runAsUser,
        secretVariables: secretVariables,
        variables: variables
    };
}

module.exports.createScriptLibrary = function (options) {
    var fs = options.fs;
    var path = options.path;
    var root = options.root;
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
    var treeCache = {
        value: null,
        expiresAt: 0
    };

    function ensure() {
        fs.mkdirSync(root, {
            recursive: true
        });
    }

    function folderIcon(directory, relative) {
        var base = path.basename(directory);
        var extensionsList = Object.keys(iconTypes);

        for (
            var index = 0;
            index < extensionsList.length;
            index++
        ) {
            var extension = extensionsList[index];
            var candidate = path.join(
                directory,
                base + extension
            );

            try {
                var stat = fs.statSync(candidate);

                if (
                    stat.isFile() &&
                    stat.size > 0 &&
                    stat.size <= maxIconSize
                ) {
                    var data = fs.readFileSync(candidate);

                    return {
                        path: (
                            relative
                                ? relative + "/"
                                : ""
                        ) + base + extension,
                        dataUrl:
                            "data:" + iconTypes[extension] +
                            ";base64," + data.toString("base64")
                    };
                }
            } catch (error) {}
        }

        return {
            path: "",
            dataUrl: ""
        };
    }

    function getScript(relativePath, includeBody) {
        var target = shared.normalizeRelativePath(
            path,
            root,
            relativePath
        );

        if (!target) return null;

        var extension = path.extname(target).toLowerCase();
        if (!extensions[extension]) return null;

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
        var parsed = parseScript(
            path,
            buffer.toString("utf8"),
            target
        );
        var result = {
            type: "script",
            name: path.basename(target),
            path: String(relativePath).replace(/\\/g, "/"),
            shell: extensions[extension],
            label: parsed.label,
            description: parsed.description,
            variables: parsed.variables,
            secretVariables: parsed.secretVariables,
            approvalLevels: parsed.approvalLevels,
            requiresApproval: parsed.requiresApproval,
            runAsUser: parsed.runAsUser,
            hash: crypto.createHash("sha256")
                .update(buffer)
                .digest("hex"),
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

    function getTree() {
        if (
            treeCache.value &&
            treeCache.expiresAt > Date.now()
        ) {
            return shared.copy(treeCache.value);
        }

        ensure();

        function walk(directory, relative, depth) {
            var icon = relative
                ? folderIcon(directory, relative)
                : {
                    path: "",
                    dataUrl: ""
                };
            var node = {
                type: "directory",
                name: relative
                    ? path.basename(directory)
                    : "scripts",
                path: relative,
                icon: icon.path,
                iconData: icon.dataUrl,
                children: []
            };

            if (depth > 12) return node;

            var entries = [];

            try {
                entries = fs.readdirSync(directory, {
                    withFileTypes: true
                });
            } catch (error) {
                node.error = error.message;
                return node;
            }

            entries.sort(function (left, right) {
                if (
                    left.isDirectory() !==
                    right.isDirectory()
                ) {
                    return left.isDirectory() ? -1 : 1;
                }

                return left.name.localeCompare(right.name);
            });

            entries.forEach(function (entry) {
                if (
                    entry.name === ".git" ||
                    entry.name === "node_modules" ||
                    entry.name === ".gitkeep"
                ) {
                    return;
                }

                var relativePath = relative
                    ? relative + "/" + entry.name
                    : entry.name;
                var fullPath = path.join(
                    directory,
                    entry.name
                );

                if (entry.isDirectory()) {
                    node.children.push(
                        walk(
                            fullPath,
                            relativePath,
                            depth + 1
                        )
                    );
                } else if (
                    entry.isFile() &&
                    extensions[
                        path.extname(entry.name).toLowerCase()
                    ]
                ) {
                    var script = getScript(
                        relativePath,
                        false
                    );

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
        return (getTree().children || []).filter(
            function (node) {
                return node.type === "directory";
            }
        );
    }

    function invalidate() {
        cache = Object.create(null);
        treeCache = {
            value: null,
            expiresAt: 0
        };
    }

    return {
        ensure: ensure,
        getRoots: getRoots,
        getScript: getScript,
        getTree: getTree,
        invalidate: invalidate,
        root: root
    };
};
