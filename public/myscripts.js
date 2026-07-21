(function () {
    "use strict";

    var tree = null;
    var treeState = {
        selectedRoot: "",
        selectedScript: "",
        expanded: {}
    };
    var uiState = {
        manageMode: false,
        favoritesOnly: false,
        favorites: loadFavorites(),
        deepLinkApplied: false
    };
    var outputByPath = Object.create(null);
    var favoritesKey = "mycompany.myscripts.favorites";

    function loadFavorites() {
        try {
            var value = JSON.parse(
                window.localStorage.getItem("mycompany.myscripts.favorites") || "[]"
            );
            return Array.isArray(value) ? value.map(String) : [];
        } catch (error) {
            return [];
        }
    }

    function saveFavorites() {
        try {
            window.localStorage.setItem(
                favoritesKey,
                JSON.stringify(uiState.favorites)
            );
        } catch (error) {}
    }

    function isFavorite(path) {
        return uiState.favorites.indexOf(String(path || "")) >= 0;
    }

    function toggleFavorite(path) {
        path = String(path || "");
        if (!path) return false;
        var index = uiState.favorites.indexOf(path);
        if (index >= 0) uiState.favorites.splice(index, 1);
        else uiState.favorites.push(path);
        saveFavorites();
        return isFavorite(path);
    }

    function outputText(value) {
        if (value == null) return "";
        if (typeof value === "string") return value;
        try { return JSON.stringify(value, null, 2); }
        catch (error) { return String(value); }
    }

    function copyText(value) {
        value = String(value || "");
        if (
            navigator.clipboard &&
            typeof navigator.clipboard.writeText === "function"
        ) {
            return navigator.clipboard.writeText(value);
        }

        return new Promise(function (resolve, reject) {
            var field = document.createElement("textarea");
            field.value = value;
            field.style.position = "fixed";
            field.style.opacity = "0";
            document.body.appendChild(field);
            field.focus();
            field.select();
            try {
                if (!document.execCommand("copy")) {
                    throw new Error("Copy failed.");
                }
                resolve();
            } catch (error) {
                reject(error);
            } finally {
                field.remove();
            }
        });
    }

    function scriptLink(path) {
        var url = new URL(window.location.href);
        url.searchParams.set("myscript", String(path || ""));
        return url.href;
    }

    function findRootForScript(treeValue, scriptPath) {
        var roots = treeValue && treeValue.children || [];
        for (var index = 0; index < roots.length; index++) {
            var root = roots[index];
            if (
                root.type === "directory" &&
                window.SharedDirectoryTree.find(root, scriptPath)
            ) {
                return root.path;
            }
        }
        return "";
    }

    function applyDeepLink() {
        if (uiState.deepLinkApplied || !tree) return;
        uiState.deepLinkApplied = true;
        try {
            var path = new URL(window.location.href).searchParams.get("myscript");
            if (!path || !window.SharedDirectoryTree.find(tree, path)) return;
            treeState.selectedScript = path;
            treeState.selectedRoot = findRootForScript(tree, path);
        } catch (error) {}
    }

    function syncToolbar(shell) {
        var toolbar = shell.state.page && shell.state.page.toolbar;
        if (!toolbar) return;
        var scriptsTab = shell.state.tab === "scripts";
        toolbar.setActive("manage", uiState.manageMode && scriptsTab);
        toolbar.setActive("favorites", uiState.favoritesOnly && scriptsTab);
        toolbar.setEnabled("manage", scriptsTab);
        toolbar.setEnabled("favorites", scriptsTab);
        toolbar.setEnabled("link", scriptsTab && !!treeState.selectedScript);
    }

    function showPlaceholder(shell) {
        shell.state.page.details.innerHTML = "";
        shell.state.page.details.appendChild(shell.card(
            "Output",
            uiState.favoritesOnly && !uiState.favorites.length
                ? "No favorite scripts. Select a script, enable Manage and add it to Favorites."
                : "Select a script to see its result."
        ));
        syncToolbar(shell);
    }

    function showOutput(shell, script, title, value, className) {
        var host = shell.state.page.details;
        host.innerHTML = "";
        var card = shell.card(
            title || script.label || script.name,
            script.description || script.path
        );
        if (className) card.classList.add(className);
        card.appendChild(shell.element(
            "pre",
            "mc-shared-output",
            outputText(value) || "No output."
        ));
        host.appendChild(card);
        syncToolbar(shell);
    }

    function submit(shell, script, button) {
        button.disabled = true;
        showOutput(shell, script, "Executing", "Submitting script...");

        shell.post("request", {
            scriptPath: script.path,
            label: script.label || script.name,
            description: script.description || "",
            approvalLevels: script.approvalLevels || [],
            note: ""
        }).then(function (result) {
            var request = result.request || {};
            var message = request.result && request.result.message;
            if (!message) {
                message = request.status === "pending"
                    ? "Waiting for approval."
                    : request.status === "executing"
                        ? "Executing..."
                        : request.status || "Request submitted.";
            }
            outputByPath[script.path] = outputText(message);
            showOutput(
                shell,
                script,
                request.status === "pending"
                    ? "Waiting for approval"
                    : "Result",
                outputByPath[script.path]
            );
        }).catch(function (error) {
            outputByPath[script.path] = error.message || String(error);
            showOutput(
                shell,
                script,
                "Error",
                outputByPath[script.path],
                "mc-shared-error"
            );
        }).then(function () {
            button.disabled = false;
        });
    }

    function addManageActions(shell, card, script) {
        if (!uiState.manageMode) return;

        var actions = document.createElement("div");
        actions.className = "mc-script-manage-actions";

        var favorite = shell.element(
            "button",
            "btn btn-secondary btn-sm",
            isFavorite(script.path) ? "★ Remove favorite" : "☆ Add favorite"
        );
        favorite.type = "button";
        favorite.onclick = function () {
            var selected = toggleFavorite(script.path);
            favorite.textContent = selected
                ? "★ Remove favorite"
                : "☆ Add favorite";
            if (uiState.favoritesOnly && !selected) {
                treeState.selectedScript = "";
                shell.render();
            }
        };
        actions.appendChild(favorite);

        var copyPath = shell.element(
            "button",
            "btn btn-secondary btn-sm",
            "Copy path"
        );
        copyPath.type = "button";
        copyPath.onclick = function () {
            copyText(script.path).then(function () {
                copyPath.textContent = "Copied";
                window.setTimeout(function () {
                    if (copyPath.isConnected) copyPath.textContent = "Copy path";
                }, 1000);
            });
        };
        actions.appendChild(copyPath);

        card.appendChild(actions);
        card.appendChild(shell.element(
            "pre",
            "mc-script-metadata",
            outputText({
                path: script.path,
                shell: script.shell,
                approvalLevels: script.approvalLevels || [],
                runAsUser: script.runAsUser,
                variables: script.variables || [],
                secretVariables: script.secretVariables || []
            })
        ));
    }

    function renderScript(shell, scriptSummary) {
        shell.api("script", { path: scriptSummary.path }).then(function (result) {
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
            run.onclick = function () {
                submit(shell, script, run);
            };
            card.appendChild(run);
            addManageActions(shell, card, script);
            card.appendChild(shell.element(
                "pre",
                "mc-shared-output",
                outputByPath[script.path] ||
                    "Select Run or Request to see the result."
            ));
            host.appendChild(card);
            syncToolbar(shell);
        }).catch(function (error) {
            shell.error(shell.state.page.details, error);
        });
    }

    function renderResults(shell) {
        syncToolbar(shell);
        return shell.api("results", {
            q: shell.state.search,
            page: 1,
            perPage: 100
        }).then(function (result) {
            var host = shell.state.page.details;
            host.innerHTML = "";
            var rows = result.rows || [];
            if (!rows.length) {
                host.appendChild(shell.card(
                    "Results",
                    "No script requests or results."
                ));
                return;
            }
            rows.forEach(function (request) {
                var message = request.result && request.result.message ||
                    (request.status === "pending"
                        ? "Waiting for approval."
                        : request.status || "");
                var card = shell.card(
                    request.title || "Script",
                    (request.requester && request.requester.name || "") +
                        " · " +
                        request.status
                );
                card.appendChild(shell.element(
                    "pre",
                    "mc-shared-output",
                    outputText(message)
                ));
                host.appendChild(card);
            });
        });
    }

    function refreshScripts(shell) {
        return shell.post("refresh", {}).then(function (result) {
            tree = result.tree || null;
            shell.render();
        }).catch(function (error) {
            shell.error(shell.state.page.details, error);
        });
    }

    function clearView(toolbar) {
        var shell = module.api;
        shell.state.search = "";
        toolbar.clearSearch(false);
        treeState.selectedScript = "";
        outputByPath = Object.create(null);
        showPlaceholder(shell);
        shell.render();
    }

    function copySelectedLink(toolbar) {
        var path = treeState.selectedScript;
        if (!path) return;
        copyText(scriptLink(path)).then(function () {
            toolbar.setActive("link", true);
            window.setTimeout(function () {
                toolbar.setActive("link", false);
            }, 1000);
        }).catch(function (error) {
            module.api.error(module.api.state.page.details, error);
        });
    }

    function toggleManage(toolbar) {
        uiState.manageMode = !uiState.manageMode;
        toolbar.setActive("manage", uiState.manageMode);
        module.api.render();
    }

    function toggleFavorites(toolbar) {
        uiState.favoritesOnly = !uiState.favoritesOnly;
        toolbar.setActive("favorites", uiState.favoritesOnly);
        treeState.selectedScript = "";
        module.api.render();
    }

    var module = window.MyCompanyModuleShell.create({
        key: "myscripts",
        title: "My Scripts",
        menuTitle: "My Scripts",
        order: 160,
        preset: "myscripts",
        buttons: {
            settings: false,
            refresh: {
                onClick: function () {
                    refreshScripts(module.api);
                }
            },
            clear: {
                onClick: function (toolbar) {
                    clearView(toolbar);
                }
            },
            link: {
                onClick: function (toolbar) {
                    copySelectedLink(toolbar);
                }
            },
            manage: {
                onClick: function (toolbar) {
                    toggleManage(toolbar);
                }
            },
            favorites: {
                onClick: function (toolbar) {
                    toggleFavorites(toolbar);
                }
            }
        },
        tabs: [
            { key: "scripts", title: "Scripts" },
            { key: "results", title: "Results" }
        ],
        defaultTab: "scripts",
        render: function (shell) {
            syncToolbar(shell);

            if (shell.state.tab === "results") {
                shell.state.page.primary.innerHTML = "";
                shell.state.page.secondary.innerHTML = "";
                return renderResults(shell);
            }

            return shell.api("scripts").then(function (result) {
                tree = result.tree;
                applyDeepLink();

                window.SharedDirectoryTree.mount({
                    rootsContainer: shell.state.page.primary,
                    treeContainer: shell.state.page.secondary,
                    tree: tree,
                    state: treeState,
                    search: shell.state.search,
                    emptyText: uiState.favoritesOnly
                        ? "No favorite scripts found."
                        : "No scripts found.",
                    filterScript: function (script) {
                        return !uiState.favoritesOnly || isFavorite(script.path);
                    },
                    onRootSelect: function () {
                        treeState.selectedScript = "";
                        showPlaceholder(shell);
                    },
                    onScript: function (script) {
                        renderScript(shell, script);
                    }
                });

                if (treeState.selectedScript) {
                    var selected = window.SharedDirectoryTree.find(
                        tree,
                        treeState.selectedScript
                    );
                    if (
                        selected &&
                        (!uiState.favoritesOnly || isFavorite(selected.path))
                    ) {
                        renderScript(shell, selected);
                    } else {
                        treeState.selectedScript = "";
                        showPlaceholder(shell);
                    }
                } else {
                    showPlaceholder(shell);
                }
            });
        }
    });

    window.MyCompanyModules.myscripts = module;
}());
