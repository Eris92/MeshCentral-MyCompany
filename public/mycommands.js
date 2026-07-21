(function () {
    "use strict";

    var sourceTree = null;
    var catalog = [];
    var tree = null;
    var mode = "commands";
    var status = "";
    var treeState = { selectedRoot: "", selectedScript: "", expanded: {} };
    var outputs = Object.create(null);
    var pollSequence = 0;
    var tools = window.SharedScriptTools.create({ storageKey: "mycompany.mycommands.preferences", deepLinkParameter: "mycommand" });
    tools.restoreTreeState(treeState);

    function node(shell) {
        return shell.state.nodeId || window.MyCompanyRuntime.state.nodeId || window.selectedNode || "";
    }

    function stringValue(value) {
        if (value == null) return "";
        if (typeof value === "string") return value;
        try { return JSON.stringify(value, null, 2); }
        catch (error) { return String(value); }
    }

    function isAdmin(shell) {
        return !!(shell.state.bootstrap && shell.state.bootstrap.access && shell.state.bootstrap.access.siteAdmin);
    }

    function sync(shell) {
        tools.syncToolbar(shell.state.page && shell.state.page.toolbar, mode, treeState.selectedScript, { canEdit: isAdmin(shell), enableMulti: true });
    }

    function note(shell, title, message, error) {
        var host = shell.state.page.details;
        host.innerHTML = "";
        var card = shell.card(title, message);
        if (error) card.classList.add("mc-shared-error");
        host.appendChild(card);
        sync(shell);
    }

    function empty(shell) {
        note(shell, "Output", tools.state.favoritesOnly && !tools.state.favorites.length
            ? "No favorite command scripts. Enable Edit and add a script to Favorites."
            : "Select a command or script to see its result.");
    }

    function commandPath(category, command) {
        return "@command/" + category.key + "/" + command.id;
    }

    function buildTree() {
        var children = [];
        children.push({
            type: "directory",
            name: "Scripts",
            path: "@menu/scripts",
            icon: "📁",
            children: sourceTree && Array.isArray(sourceTree.children) ? sourceTree.children : []
        });

        (catalog || []).forEach(function (category) {
            children.push({
                type: "directory",
                name: category.title,
                path: "@menu/" + category.key,
                icon: category.icon || "▣",
                children: (category.commands || []).map(function (command) {
                    return {
                        type: "script",
                        kind: "command",
                        name: command.label,
                        label: command.label,
                        description: command.description || "",
                        path: commandPath(category, command),
                        commandId: command.id,
                        variables: command.variables || [],
                        approvalLevels: command.approvalLevels || [],
                        requiresApproval: command.requiresApproval === true,
                        runAsUser: command.runAsUser,
                        icon: "▶"
                    };
                })
            });
        });

        return { type: "directory", name: "Commands", path: "", children: children };
    }

    function valueControls(shell, item, card) {
        var variables = Array.isArray(item.variables) ? item.variables : [];
        var controls = [];
        if (!variables.length) return function () { return {}; };

        var section = document.createElement("div");
        section.className = "mc-script-runtime-variables";
        var heading = document.createElement("h3");
        heading.textContent = "Variables";
        section.appendChild(heading);

        variables.forEach(function (variable) {
            var row = document.createElement("label");
            row.className = "mc-script-form-row";
            var label = document.createElement("span");
            label.className = "mc-script-form-label";
            label.textContent = (variable.label || variable.name) + (variable.required ? " *" : "");
            row.appendChild(label);

            var input;
            if (variable.control === "switch") {
                input = document.createElement("input");
                input.type = "checkbox";
                input.checked = /^(1|true|yes|tak|on)$/i.test(String(variable.defaultValue || ""));
            } else if (variable.control === "select") {
                input = document.createElement("select");
                (variable.options || []).forEach(function (entry) {
                    var option = document.createElement("option");
                    option.value = String(entry.value == null ? entry : entry.value);
                    option.textContent = String(entry.label || entry.value || entry);
                    input.appendChild(option);
                });
                input.value = String(variable.defaultValue || "");
            } else {
                input = document.createElement("input");
                input.type = "text";
                input.value = String(variable.defaultValue || "");
            }
            input.name = variable.name;
            row.appendChild(input);
            section.appendChild(row);
            controls.push({ variable: variable, input: input });
        });

        card.appendChild(section);
        return function () {
            var values = {};
            controls.forEach(function (item) {
                values[item.variable.name] = item.variable.control === "switch"
                    ? item.input.checked
                    : item.input.value;
            });
            return values;
        };
    }

    function renderOutput(host, value) {
        host.innerHTML = "";
        if (window.SharedResultsView && typeof window.SharedResultsView.mountResult === "function") {
            window.SharedResultsView.mountResult(host, value || "No output.");
            return;
        }
        var pre = document.createElement("pre");
        pre.className = "mc-shared-output";
        pre.textContent = stringValue(value) || "No output.";
        host.appendChild(pre);
    }

    function renderWaiting(host, value) {
        host.innerHTML = "";
        var pre = document.createElement("pre");
        pre.className = "mc-shared-output";
        pre.textContent = value;
        host.appendChild(pre);
    }

    function pollOutput(shell, item, responseId, outputHost, sequence, attempt) {
        if (sequence !== pollSequence || treeState.selectedScript !== item.path) return;
        shell.api("output", { id: responseId }).then(function (response) {
            if (sequence !== pollSequence || treeState.selectedScript !== item.path) return;
            if (response.ready) {
                var value = response.output || (response.status ? "Command completed: " + response.status : "Command completed without output.");
                outputs[item.path] = value;
                renderOutput(outputHost, value);
                return;
            }
            if (attempt >= 300) {
                renderWaiting(outputHost, "Command was sent, but the output timeout was reached. Check Results later.");
                return;
            }
            renderWaiting(outputHost, "Waiting for agent output...");
            window.setTimeout(function () { pollOutput(shell, item, responseId, outputHost, sequence, attempt + 1); }, 1000);
        }).catch(function (error) {
            if (sequence !== pollSequence) return;
            renderWaiting(outputHost, error.message || String(error));
        });
    }

    function execute(shell, item, button, values, outputHost) {
        button.disabled = true;
        renderWaiting(outputHost, "Submitting command...");
        var payload = {
            nodeId: node(shell),
            nodeName: window.currentNode && window.currentNode.name || "",
            variableValues: values || {},
            note: ""
        };
        if (item.kind === "command") payload.commandId = item.commandId;
        else payload.scriptPath = item.path;

        shell.post("execute", payload).then(function (response) {
            var request = response.request || {};
            if (request.status === "pending") {
                outputs[item.path] = "Waiting for approval.";
                renderWaiting(outputHost, outputs[item.path]);
                return;
            }

            var result = request.result || {};
            if (result.id) {
                var immediate = result.output || result.message || "Waiting for agent output...";
                outputs[item.path] = immediate;
                renderWaiting(outputHost, immediate);
                pollSequence++;
                pollOutput(shell, item, result.id, outputHost, pollSequence, 0);
                return;
            }

            var value = result.output || result.message || request.status || "Command submitted.";
            outputs[item.path] = stringValue(value);
            renderOutput(outputHost, outputs[item.path]);
        }).catch(function (error) {
            outputs[item.path] = error.message || String(error);
            renderWaiting(outputHost, outputs[item.path]);
            outputHost.classList.add("mc-shared-error");
        }).then(function () {
            button.disabled = false;
        });
    }

    function showDefinition(shell, item) {
        var host = shell.state.page.details;
        host.innerHTML = "";
        var card = shell.card(item.label || item.name, item.description || item.path);
        var collectValues = valueControls(shell, item, card);
        var button = shell.element("button", "btn btn-primary", item.requiresApproval ? "Request" : "Run");
        button.type = "button";
        card.appendChild(button);
        var outputHost = document.createElement("div");
        outputHost.className = "mc-command-inline-result";
        if (outputs[item.path]) renderOutput(outputHost, outputs[item.path]);
        else renderWaiting(outputHost, "Select Run or Request to see the result.");
        card.appendChild(outputHost);
        button.onclick = function () { execute(shell, item, button, collectValues(), outputHost); };
        host.appendChild(card);
        sync(shell);
    }

    function show(shell, item) {
        pollSequence++;
        if (item.kind === "command") {
            showDefinition(shell, item);
            return;
        }
        shell.api("script", { path: item.path }).then(function (response) {
            showDefinition(shell, response.script);
        }).catch(function (error) {
            shell.error(shell.state.page.details, error);
        });
    }

    function multi(shell, script) {
        treeState.selectedScript = script.path;
        tools.openMultiExecution(shell, script, node(shell), function (ids) {
            return shell.post("multi-execute", {
                nodeIds: ids,
                scriptPath: script.path,
                label: script.label || script.name,
                variableValues: {},
                note: ""
            }).then(function (response) {
                note(shell, "Multi-device result", JSON.stringify({ total: response.total, submitted: response.submitted, pending: response.pending, failed: response.failed }, null, 2), response.failed > 0);
                return response;
            });
        });
    }

    function actions(shell, item) {
        if (item.kind === "command") return [];
        return tools.scriptActions(item, {
            canEdit: isAdmin(shell),
            enableMulti: item.multiHost === true,
            onEdit: function (script) {
                treeState.selectedScript = script.path;
                tools.openDefinitionEditor(shell, script, function (result) {
                    if (result && result.tree) sourceTree = result.tree;
                    tree = buildTree();
                    tools.state.editMode = false;
                    shell.render();
                });
            },
            onCredentials: function (script) {
                treeState.selectedScript = script.path;
                tools.openCredentialsEditor(shell, script, function () {
                    note(shell, "Credentials saved", "Encrypted credentials for this command script were updated.");
                });
            },
            onMulti: function (script) { multi(shell, script); },
            onFavoriteChanged: function (script) {
                if (tools.state.favoritesOnly && !tools.isFavorite(script.path)) treeState.selectedScript = "";
                shell.render();
            },
            onLinkCopied: function () {}
        });
    }

    function filterItem(item) {
        if (item.kind === "command") return tools.state.favoritesOnly !== true;
        return tools.filterScript(item);
    }

    function primary(shell, treeHost) {
        window.SharedCatalogView.mount({
            primaryContainer: shell.state.page.primary,
            treeContainer: treeHost,
            tree: tree,
            state: treeState,
            search: shell.state.search,
            resultsActive: mode === "results",
            resultsPosition: "end",
            emptyText: tools.state.favoritesOnly ? "No favorite command scripts found." : "No commands found.",
            filterScript: filterItem,
            scriptActions: function (item) { return actions(shell, item); },
            onResults: function () {
                mode = "results";
                treeState.selectedScript = "";
                shell.render();
            },
            onRootSelect: function () {
                mode = "commands";
                treeState.selectedScript = "";
                tools.saveTreeState(treeState);
                window.setTimeout(shell.render, 0);
            },
            onScript: function (item) {
                mode = "commands";
                show(shell, item);
            }
        });
    }

    function results(shell) {
        primary(shell, document.createElement("div"));
        window.SharedResultsView.mountStatus(shell.state.page.secondary, {
            selected: status,
            onSelect: function (value) { status = value; shell.render(); }
        });
        sync(shell);
        return shell.api("results", { status: status, q: shell.state.search, page: 1, perPage: 200 }).then(function (response) {
            window.SharedResultsView.mountTable(shell.state.page.details, {
                title: "Command results",
                kind: "commands",
                rows: response.rows || [],
                emptyText: "No command results match the selected status."
            });
            sync(shell);
        });
    }

    function commands(shell) {
        primary(shell, shell.state.page.secondary);
        if (!treeState.selectedScript) {
            empty(shell);
            return;
        }
        var item = window.SharedDirectoryTree.find(tree, treeState.selectedScript);
        if (item && filterItem(item)) show(shell, item);
        else {
            treeState.selectedScript = "";
            empty(shell);
        }
    }

    function refresh(shell) {
        var toolbar = shell.state.page && shell.state.page.toolbar;
        if (toolbar) toolbar.setEnabled("refresh", false);
        shell.post("refresh", {}).then(function (response) {
            sourceTree = response.tree || sourceTree;
            catalog = response.catalog || catalog;
            tree = buildTree();
            if (treeState.selectedScript && !window.SharedDirectoryTree.find(tree, treeState.selectedScript)) treeState.selectedScript = "";
            shell.render();
        }).catch(function (error) {
            note(shell, "Refresh failed", error.message || String(error), true);
        }).then(function () {
            if (toolbar) toolbar.setEnabled("refresh", true);
        });
    }

    var module = window.MyCompanyModuleShell.create({
        key: "mycommands",
        title: "My Commands",
        menuTitle: "My Commands",
        showInMenu: false,
        order: 150,
        preset: "mycommands",
        deviceTab: { title: "Commands", pageId: "mycompany-mycommands-device-page", topTabId: "MainDevMyCompany-Commands" },
        buttons: {
            collapse: { side: "left", order: 10 },
            favorites: { side: "left", order: 20, onClick: function (toolbar) { tools.toggleFavorites(toolbar, function () { treeState.selectedScript = ""; module.api.render(); }); } },
            link: false,
            manage: { title: "Edit", side: "left", order: 40, onClick: function (toolbar) { tools.toggleEdit(toolbar, module.api.render); } },
            refresh: { side: "left", order: 50, onClick: function () { refresh(module.api); } },
            multi: { title: "Multi-device execution", side: "left", order: 60, onClick: function (toolbar) { tools.toggleMulti(toolbar, module.api.render); } },
            search: { side: "left", order: 70 },
            clear: false,
            settings: false
        },
        tabs: [],
        defaultTab: "commands",
        render: function (shell) {
            return shell.api("scripts").then(function (response) {
                sourceTree = response.tree;
                catalog = response.catalog || [];
                tree = buildTree();
                tools.applyDeepLink(tree, treeState);
                return mode === "results" ? results(shell) : commands(shell);
            });
        }
    });

    window.MyCompanyModules.mycommands = module;
}());