(function () {
    "use strict";

    var tree = null;
    var mode = "scripts";
    var status = "";
    var treeState = { selectedRoot: "", selectedScript: "", expanded: {} };
    var outputs = Object.create(null);
    var tools = window.SharedScriptTools.create({ storageKey: "mycompany.myscripts.preferences", deepLinkParameter: "myscript" });
    tools.restoreTreeState(treeState);

    function admin(shell) { return !!(shell.state.bootstrap && shell.state.bootstrap.access && shell.state.bootstrap.access.siteAdmin); }
    function sync(shell) {
        tools.syncToolbar(shell.state.page && shell.state.page.toolbar, mode, treeState.selectedScript, { canEdit: admin(shell), enableMulti: false });
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
            ? "No favorite scripts. Enable Edit and add a script to Favorites."
            : "Select a script to run it.");
    }
    function confirmExecution(script) {
        if (!script || script.confirmExecution !== true) return true;
        return window.confirm("Run \"" + (script.label || script.name || script.path || "this script") + "\" now?");
    }

    function requestOutput(request) {
        request = request || {};
        var result = request.result || {};
        if (result.output != null && result.output !== "") return String(result.output);
        if (result.rawOutput != null && result.rawOutput !== "") return String(result.rawOutput);
        if (result.message != null && result.message !== "") return String(result.message);
        if (request.status === "pending") return "Waiting for approval.";
        if (request.status === "executing") return "Executing...";
        if (request.status === "failed") return "Script execution failed.";
        return "No output.";
    }
    function renderResult(host, request) {
        request = request || {};
        host.innerHTML = "";
        if (request.status === "pending" || request.status === "executing") {
            var waiting = document.createElement("pre");
            waiting.className = "mc-shared-output";
            waiting.textContent = requestOutput(request);
            host.appendChild(waiting);
            return;
        }
        if (request.status === "failed") host.classList.add("mc-shared-error");
        else host.classList.remove("mc-shared-error");
        window.SharedResultsView.mountResult(host, requestOutput(request), { title: request.title || "Result" });
    }

    function variableEditor(script) {
        var wrapper = document.createElement("div");
        wrapper.className = "mc-script-run-variables";
        var controls = [];
        (script.variables || []).forEach(function (variable) {
            var row = document.createElement("label");
            row.className = "mc-script-form-row";
            var label = document.createElement("span");
            label.className = "mc-script-form-label";
            label.textContent = (variable.label || variable.name) + (variable.required ? " *" : "");
            row.appendChild(label);
            var control;
            if (variable.control === "select") {
                control = document.createElement("select");
                (variable.options || []).forEach(function (choice) {
                    var option = document.createElement("option");
                    option.value = String(choice.value == null ? "" : choice.value);
                    option.textContent = choice.label || option.value;
                    control.appendChild(option);
                });
                control.value = String(variable.defaultValue == null ? "" : variable.defaultValue);
            } else if (variable.control === "switch") {
                control = document.createElement("input");
                control.type = "checkbox";
                control.checked = /^(1|true|yes|tak)$/i.test(String(variable.defaultValue || ""));
            } else {
                control = document.createElement("input");
                control.type = "text";
                control.value = String(variable.defaultValue == null ? "" : variable.defaultValue);
                control.placeholder = variable.label || variable.name;
            }
            control.classList.add("mc-definition-input");
            row.appendChild(control);
            wrapper.appendChild(row);
            controls.push({ variable: variable, control: control });
        });
        return {
            element: wrapper,
            values: function () {
                var result = {};
                controls.forEach(function (item) {
                    result[item.variable.name] = item.variable.control === "switch" ? item.control.checked : item.control.value;
                });
                return result;
            },
            validate: function () {
                for (var index = 0; index < controls.length; index++) {
                    var item = controls[index];
                    var value = item.variable.control === "switch" ? item.control.checked : item.control.value;
                    if (item.variable.required && !String(value == null ? "" : value).trim()) {
                        item.control.focus();
                        throw new Error((item.variable.label || item.variable.name) + " is required.");
                    }
                }
            }
        };
    }

    function submit(shell, script, button, variables, resultHost) {
        try { variables.validate(); }
        catch (error) {
            resultHost.innerHTML = "";
            resultHost.appendChild(shell.element("div", "mc-shared-error", error.message || String(error)));
            return;
        }
        if (!confirmExecution(script)) {
            resultHost.innerHTML = "";
            resultHost.appendChild(shell.element("pre", "mc-shared-output", "Execution cancelled."));
            return;
        }
        if (button) button.disabled = true;
        resultHost.innerHTML = "";
        resultHost.appendChild(shell.element("pre", "mc-shared-output", "Executing script..."));
        shell.post("request", {
            scriptPath: script.path,
            variableValues: variables.values(),
            confirmedExecution: script.confirmExecution === true,
            note: ""
        }).then(function (response) {
            var request = response.request || {};
            outputs[script.path] = request;
            renderResult(resultHost, request);
        }).catch(function (error) {
            var request = { status: "failed", title: script.label || script.name, result: { message: error.message || String(error) } };
            outputs[script.path] = request;
            renderResult(resultHost, request);
        }).then(function () {
            if (button) button.disabled = false;
            sync(shell);
        });
    }

    function show(shell, item, executeOnSelect) {
        shell.api("script", { path: item.path }).then(function (response) {
            var script = response.script;
            var host = shell.state.page.details;
            host.innerHTML = "";
            var card = shell.card(script.label || script.name, script.description || script.path);
            var variables = variableEditor(script);
            if ((script.variables || []).length) card.appendChild(variables.element);
            var button = shell.element("button", "btn btn-primary", script.requiresApproval ? "Request" : "Run");
            button.type = "button";
            card.appendChild(button);
            var resultHost = document.createElement("div");
            resultHost.className = "mc-script-live-result";
            card.appendChild(resultHost);
            button.onclick = function () { submit(shell, script, button, variables, resultHost); };
            if (outputs[script.path]) renderResult(resultHost, outputs[script.path]);
            else resultHost.appendChild(shell.element("pre", "mc-shared-output", executeOnSelect ? "Starting..." : "Select Run or Request to see the result."));
            host.appendChild(card);
            sync(shell);
            if (executeOnSelect === true && (!Array.isArray(script.variables) || script.variables.length === 0)) {
                window.setTimeout(function () { button.click(); }, 0);
            }
        }).catch(function (error) { shell.error(shell.state.page.details, error); });
    }

    function actions(shell, script) {
        return tools.scriptActions(script, {
            canEdit: admin(shell), enableMulti: false,
            onEdit: function (item) {
                treeState.selectedScript = item.path;
                tools.openDefinitionEditor(shell, item, function (result) {
                    if (result && result.tree) tree = result.tree;
                    tools.state.editMode = false;
                    shell.render();
                });
            },
            onCredentials: function (item) {
                treeState.selectedScript = item.path;
                tools.openCredentialsEditor(shell, item, function () { note(shell, "Credentials saved", "Encrypted credentials for this script were updated."); });
            },
            onFavoriteChanged: function (item) {
                if (tools.state.favoritesOnly && !tools.isFavorite(item.path)) treeState.selectedScript = "";
                shell.render();
            },
            onLinkCopied: function () {}
        });
    }

    function primary(shell, host) {
        window.SharedCatalogView.mount({
            primaryContainer: shell.state.page.primary,
            treeContainer: host,
            tree: tree,
            state: treeState,
            search: shell.state.search,
            resultsActive: mode === "results",
            emptyText: tools.state.favoritesOnly ? "No favorite scripts found." : "No scripts found.",
            filterScript: tools.filterScript,
            scriptActions: function (script) { return actions(shell, script); },
            onResults: function () { mode = "results"; treeState.selectedScript = ""; shell.render(); },
            onRootSelect: function () {
                mode = "scripts";
                treeState.selectedScript = "";
                tools.saveTreeState(treeState);
                setTimeout(shell.render, 0);
            },
            onScript: function (script) { mode = "scripts"; show(shell, script, true); }
        });
    }

    function results(shell) {
        primary(shell, document.createElement("div"));
        window.SharedResultsView.mountStatus(shell.state.page.secondary, { selected: status, onSelect: function (value) { status = value; shell.render(); } });
        sync(shell);
        return shell.api("results", { status: status, q: shell.state.search, page: 1, perPage: 200 }).then(function (response) {
            window.SharedResultsView.mountTable(shell.state.page.details, { title: "Script results", kind: "scripts", rows: response.rows || [], emptyText: "No script results match the selected status." });
            sync(shell);
        });
    }
    function scripts(shell) {
        primary(shell, shell.state.page.secondary);
        if (!treeState.selectedScript) { empty(shell); return; }
        var script = window.SharedDirectoryTree.find(tree, treeState.selectedScript);
        if (script && tools.filterScript(script)) show(shell, script, false);
        else { treeState.selectedScript = ""; empty(shell); }
    }
    function refresh(shell) {
        var toolbar = shell.state.page && shell.state.page.toolbar;
        if (toolbar) toolbar.setEnabled("refresh", false);
        shell.post("refresh", {}).then(function (response) {
            tree = response.tree || tree;
            if (treeState.selectedScript && !window.SharedDirectoryTree.find(tree, treeState.selectedScript)) treeState.selectedScript = "";
            shell.render();
        }).catch(function (error) { note(shell, "Refresh failed", error.message || String(error), true); }).then(function () {
            if (toolbar) toolbar.setEnabled("refresh", true);
        });
    }

    var module = window.MyCompanyModuleShell.create({
        key: "myscripts", title: "My Scripts", menuTitle: "My Scripts", order: 160, preset: "myscripts",
        buttons: {
            collapse: true,
            favorites: { side: "left", order: 20, onClick: function (toolbar) { tools.toggleFavorites(toolbar, function () { treeState.selectedScript = ""; module.api.render(); }); } },
            link: false,
            manage: { title: "Edit", side: "left", order: 40, onClick: function (toolbar) { tools.toggleEdit(toolbar, module.api.render); } },
            refresh: { side: "left", order: 50, onClick: function () { refresh(module.api); } },
            multi: false,
            search: { side: "left", order: 70 }, clear: false, settings: false
        },
        tabs: [], defaultTab: "scripts",
        render: function (shell) {
            return shell.api("scripts").then(function (response) {
                tree = response.tree;
                tools.applyDeepLink(tree, treeState);
                return mode === "results" ? results(shell) : scripts(shell);
            });
        }
    });

    window.MyCompanyModules.myscripts = module;
}());
