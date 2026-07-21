(function () {
    "use strict";

    var tree = null;
    var mode = "scripts";
    var status = "";
    var treeState = {
        selectedRoot: "",
        selectedScript: "",
        expanded: {}
    };
    var outputs = Object.create(null);
    var tools = window.SharedScriptTools.create({
        storageKey: "mycompany.myscripts.preferences",
        deepLinkParameter: "myscript"
    });
    tools.restoreTreeState(treeState);

    function text(value) {
        if (value == null) return "";
        if (typeof value === "string") return value;
        try { return JSON.stringify(value, null, 2); }
        catch (error) { return String(value); }
    }

    function canEdit(shell) {
        return !!(
            shell.state.bootstrap &&
            shell.state.bootstrap.access &&
            shell.state.bootstrap.access.siteAdmin
        );
    }

    function syncToolbar(shell) {
        tools.syncToolbar(
            shell.state.page && shell.state.page.toolbar,
            mode,
            treeState.selectedScript,
            { canEdit: canEdit(shell), enableMulti: false }
        );
    }

    function showNotice(shell, title, message, error) {
        var host = shell.state.page.details;
        host.innerHTML = "";
        var card = shell.card(title, message);
        if (error) card.classList.add("mc-shared-error");
        host.appendChild(card);
        syncToolbar(shell);
    }

    function placeholder(shell) {
        showNotice(
            shell,
            "Output",
            tools.state.favoritesOnly && !tools.state.favorites.length
                ? "No favorite scripts. Enable Edit and add a script to Favorites."
                : "Select a script to see its result."
        );
    }

    function output(shell, script, title, value, error) {
        var host = shell.state.page.details;
        host.innerHTML = "";
        var card = shell.card(
            title || script.label || script.name,
            script.description || script.path
        );
        if (error) card.classList.add("mc-shared-error");
        card.appendChild(shell.element(
            "pre",
            "mc-shared-output",
            text(value) || "No output."
        ));
        host.appendChild(card);
        syncToolbar(shell);
    }

    function submit(shell, script, button) {
        button.disabled = true;
        output(shell, script, "Executing", "Submitting script...");
        shell.post("request", {
            scriptPath: script.path,
            label: script.label || script.name,
            description: script.description || "",
            approvalLevels: script.approvalLevels || [],
            note: ""
        }).then(function (result) {
            var request = result.request || {};
            var message = request.result && request.result.message ||
                (request.status === "pending"
                    ? "Waiting for approval."
                    : request.status === "executing"
                        ? "Executing..."
                        : request.status || "Request submitted.");
            outputs[script.path] = text(message);
            output(
                shell,
                script,
                request.status === "pending" ? "Waiting for approval" : "Result",
                outputs[script.path]
            );
        }).catch(function (error) {
            outputs[script.path] = error.message || String(error);
            output(shell, script, "Error", outputs[script.path], true);
        }).then(function () {
            button.disabled = false;
        });
    }

    function openEditor(shell, summary) {
        treeState.selectedScript = summary.path;
        shell.api("source", { path: summary.path }).then(function (result) {
            var source = result.source || {};
            var host = shell.state.page.details;
            host.innerHTML = "";
            var card = shell.card("Edit: " + (summary.label || summary.name), source.path);
            card.classList.add("mc-script-editor-card");

            var editor = document.createElement("textarea");
            editor.className = "mc-script-editor";
            editor.spellcheck = false;
            editor.value = source.text || "";
            card.appendChild(editor);

            var actions = document.createElement("div");
            actions.className = "mc-script-manage-actions";
            var save = shell.element("button", "btn btn-primary btn-sm", "Save");
            save.type = "button";
            save.onclick = function () {
                save.disabled = true;
                shell.post("source", {
                    path: source.path,
                    text: editor.value
                }).then(function (response) {
                    tree = response.tree || tree;
                    tools.state.editMode = false;
                    shell.render();
                }).catch(function (error) {
                    save.disabled = false;
                    showNotice(shell, "Save failed", error.message || String(error), true);
                });
            };
            var cancel = shell.element("button", "btn btn-secondary btn-sm", "Cancel");
            cancel.type = "button";
            cancel.onclick = function () {
                tools.state.editMode = false;
                shell.render();
            };
            actions.appendChild(save);
            actions.appendChild(cancel);
            card.appendChild(actions);
            host.appendChild(card);
            window.setTimeout(function () { editor.focus(); }, 0);
            syncToolbar(shell);
        }).catch(function (error) {
            showNotice(shell, "Editor error", error.message || String(error), true);
        });
    }

    function scriptView(shell, summary) {
        shell.api("script", { path: summary.path }).then(function (result) {
            var script = result.script;
            var host = shell.state.page.details;
            host.innerHTML = "";
            var card = shell.card(
                script.label || script.name,
                script.description || script.path
            );
            var run = shell.element(
                "button",
                "btn btn-primary",
                script.requiresApproval ? "Request" : "Run"
            );
            run.type = "button";
            run.onclick = function () { submit(shell, script, run); };
            card.appendChild(run);
            card.appendChild(shell.element(
                "pre",
                "mc-shared-output",
                outputs[script.path] || "Select Run or Request to see the result."
            ));
            host.appendChild(card);
            syncToolbar(shell);
        }).catch(function (error) {
            shell.error(shell.state.page.details, error);
        });
    }

    function scriptActions(shell, script) {
        return tools.scriptActions(script, {
            canEdit: canEdit(shell),
            enableMulti: false,
            onEdit: function (item) {
                openEditor(shell, item);
            },
            onFavoriteChanged: function (item) {
                if (tools.state.favoritesOnly && !tools.isFavorite(item.path)) {
                    treeState.selectedScript = "";
                }
                shell.render();
            },
            onLinkCopied: function () {
                showNotice(shell, "Link copied", "The bookmarkable script link was copied.");
            }
        });
    }

    function primary(shell, treeHost) {
        window.SharedCatalogView.mount({
            primaryContainer: shell.state.page.primary,
            treeContainer: treeHost,
            tree: tree,
            state: treeState,
            search: shell.state.search,
            resultsActive: mode === "results",
            emptyText: tools.state.favoritesOnly
                ? "No favorite scripts found."
                : "No scripts found.",
            filterScript: tools.filterScript,
            scriptActions: function (script) {
                return scriptActions(shell, script);
            },
            onResults: function () {
                mode = "results";
                treeState.selectedScript = "";
                shell.render();
            },
            onRootSelect: function () {
                mode = "scripts";
                treeState.selectedScript = "";
                tools.saveTreeState(treeState);
                window.setTimeout(shell.render, 0);
            },
            onScript: function (script) {
                mode = "scripts";
                scriptView(shell, script);
            }
        });
    }

    function resultsView(shell) {
        primary(shell, document.createElement("div"));
        window.SharedResultsView.mountStatus(shell.state.page.secondary, {
            selected: status,
            onSelect: function (value) {
                status = value;
                shell.render();
            }
        });
        syncToolbar(shell);
        return shell.api("results", {
            status: status,
            q: shell.state.search,
            page: 1,
            perPage: 200
        }).then(function (result) {
            window.SharedResultsView.mountTable(shell.state.page.details, {
                title: "Script results",
                kind: "scripts",
                rows: result.rows || [],
                emptyText: "No script results match the selected status."
            });
            syncToolbar(shell);
        });
    }

    function scriptsView(shell) {
        primary(shell, shell.state.page.secondary);
        if (!treeState.selectedScript) {
            placeholder(shell);
            return;
        }
        var selected = window.SharedDirectoryTree.find(tree, treeState.selectedScript);
        if (selected && tools.filterScript(selected)) scriptView(shell, selected);
        else {
            treeState.selectedScript = "";
            placeholder(shell);
        }
    }

    function refresh(shell) {
        var toolbar = shell.state.page && shell.state.page.toolbar;
        if (toolbar) toolbar.setEnabled("refresh", false);
        shell.post("refresh", {}).then(function (result) {
            tree = result.tree || tree;
            if (
                treeState.selectedScript &&
                !window.SharedDirectoryTree.find(tree, treeState.selectedScript)
            ) {
                treeState.selectedScript = "";
            }
            shell.render();
        }).catch(function (error) {
            showNotice(shell, "Refresh failed", error.message || String(error), true);
        }).then(function () {
            if (toolbar) toolbar.setEnabled("refresh", true);
        });
    }

    var module = window.MyCompanyModuleShell.create({
        key: "myscripts",
        title: "My Scripts",
        menuTitle: "My Scripts",
        order: 160,
        preset: "myscripts",
        buttons: {
            collapse: { side: "left", order: 10 },
            favorites: {
                side: "left",
                order: 20,
                onClick: function (toolbar) {
                    tools.toggleFavorites(toolbar, function () {
                        treeState.selectedScript = "";
                        module.api.render();
                    });
                }
            },
            link: {
                side: "left",
                order: 30,
                onClick: function (toolbar) {
                    tools.toggleLink(
                        toolbar,
                        treeState.selectedScript,
                        module.api.render,
                        function () {
                            showNotice(module.api, "Link copied", "The bookmarkable script link was copied.");
                        }
                    );
                }
            },
            manage: {
                title: "Edit",
                side: "left",
                order: 40,
                onClick: function (toolbar) {
                    tools.toggleEdit(toolbar, module.api.render);
                }
            },
            refresh: {
                side: "left",
                order: 50,
                onClick: function () { refresh(module.api); }
            },
            multi: false,
            search: { side: "left", order: 70 },
            clear: false,
            settings: false
        },
        tabs: [],
        defaultTab: "scripts",
        render: function (shell) {
            return shell.api("scripts").then(function (result) {
                tree = result.tree;
                tools.applyDeepLink(tree, treeState);
                return mode === "results" ? resultsView(shell) : scriptsView(shell);
            });
        }
    });

    window.MyCompanyModules.myscripts = module;
}());
