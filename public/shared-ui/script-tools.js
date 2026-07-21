(function () {
    "use strict";

    function text(value) {
        return String(value == null ? "" : value);
    }

    function copyText(value) {
        value = text(value);
        if (
            navigator.clipboard &&
            typeof navigator.clipboard.writeText === "function" &&
            window.isSecureContext
        ) {
            return navigator.clipboard.writeText(value);
        }
        return new Promise(function (resolve, reject) {
            var field = document.createElement("textarea");
            field.value = value;
            field.setAttribute("readonly", "readonly");
            field.style.position = "fixed";
            field.style.left = "-10000px";
            field.style.top = "0";
            document.body.appendChild(field);
            field.focus();
            field.select();
            try {
                if (!document.execCommand("copy")) {
                    throw new Error("Copy command failed.");
                }
                resolve();
            } catch (error) {
                reject(error);
            } finally {
                field.remove();
            }
        });
    }

    function uniqueStrings(values) {
        var seen = Object.create(null);
        return (Array.isArray(values) ? values : []).map(text).filter(function (item) {
            if (!item || seen[item]) return false;
            seen[item] = true;
            return true;
        });
    }

    function findRootAndParents(tree, scriptPath) {
        var result = { root: "", parents: [] };
        var roots = window.SharedDirectoryTree.roots(tree);

        function walk(node, parents) {
            if (!node) return false;
            if (node.type === "script") return node.path === scriptPath;
            var nextParents = parents.slice();
            if (node.path && node.path !== "__root__") nextParents.push(node.path);
            var children = node.children || [];
            for (var index = 0; index < children.length; index++) {
                if (walk(children[index], nextParents)) {
                    result.parents = nextParents;
                    return true;
                }
            }
            return false;
        }

        for (var index = 0; index < roots.length; index++) {
            if (walk(roots[index], [])) {
                result.root = roots[index].path;
                break;
            }
        }
        return result;
    }

    window.SharedScriptTools = {
        create: function (options) {
            options = options || {};
            var storageKey = options.storageKey || "mycompany.scripts.preferences";
            var deepLinkParameter = options.deepLinkParameter || "script";
            var state = {
                favorites: [],
                favoritesOnly: false,
                editMode: false,
                linkPickMode: false,
                multiPickMode: false,
                deepLinkApplied: false
            };

            function readPreferences() {
                try {
                    var stored = JSON.parse(window.localStorage.getItem(storageKey) || "{}");
                    if (Array.isArray(stored)) {
                        return { favorites: stored };
                    }
                    return stored && typeof stored === "object" ? stored : {};
                } catch (error) {
                    return {};
                }
            }

            function savePreferences(extra) {
                try {
                    var current = readPreferences();
                    current.favorites = uniqueStrings(state.favorites);
                    current.favoritesOnly = state.favoritesOnly === true;
                    Object.keys(extra || {}).forEach(function (key) {
                        current[key] = extra[key];
                    });
                    window.localStorage.setItem(storageKey, JSON.stringify(current));
                } catch (error) {}
            }

            var preferences = readPreferences();
            state.favorites = uniqueStrings(preferences.favorites);
            state.favoritesOnly = preferences.favoritesOnly === true;

            function isFavorite(path) {
                return state.favorites.indexOf(text(path)) >= 0;
            }

            function toggleFavorite(path) {
                path = text(path);
                if (!path) return false;
                var index = state.favorites.indexOf(path);
                if (index >= 0) state.favorites.splice(index, 1);
                else state.favorites.push(path);
                savePreferences();
                return isFavorite(path);
            }

            function selectedLink(path) {
                var url = new URL(window.location.href);
                url.searchParams.set(deepLinkParameter, text(path));
                return url.href;
            }

            function copyScriptLink(path) {
                if (!path) return Promise.resolve(false);
                var url = selectedLink(path);
                try {
                    window.history.replaceState(window.history.state, document.title, url);
                } catch (error) {}
                return copyText(url).catch(function () {
                    window.prompt("Copy the script link:", url);
                }).then(function () {
                    return true;
                });
            }

            function updateButtonTitle(toolbar, key, title) {
                var button = toolbar && toolbar.buttons && toolbar.buttons[key];
                if (!button) return;
                button.title = title;
                button.setAttribute("aria-label", title);
            }

            function stopPickModes(except) {
                if (except !== "link") state.linkPickMode = false;
                if (except !== "multi") state.multiPickMode = false;
            }

            return {
                state: state,

                isFavorite: isFavorite,

                filterScript: function (script) {
                    return !state.favoritesOnly || isFavorite(script.path);
                },

                saveTreeState: function (treeState) {
                    savePreferences({
                        selectedRoot: text(treeState && treeState.selectedRoot)
                    });
                },

                restoreTreeState: function (treeState) {
                    var stored = readPreferences();
                    if (stored.selectedRoot) {
                        treeState.selectedRoot = text(stored.selectedRoot);
                    }
                },

                applyDeepLink: function (tree, treeState) {
                    if (state.deepLinkApplied || !tree) return;
                    state.deepLinkApplied = true;
                    try {
                        var path = new URL(window.location.href)
                            .searchParams.get(deepLinkParameter);
                        if (!path || !window.SharedDirectoryTree.find(tree, path)) return;
                        var location = findRootAndParents(tree, path);
                        treeState.selectedScript = path;
                        if (location.root) treeState.selectedRoot = location.root;
                        (location.parents || []).forEach(function (folder) {
                            treeState.expanded[folder] = true;
                        });
                    } catch (error) {}
                },

                syncToolbar: function (toolbar, mode, selectedScript, config) {
                    if (!toolbar) return;
                    config = config || {};
                    var scriptsMode = mode !== "results";
                    toolbar.setActive("favorites", state.favoritesOnly && scriptsMode);
                    toolbar.setActive("manage", state.editMode && scriptsMode);
                    toolbar.setActive("link", state.linkPickMode && scriptsMode);
                    toolbar.setActive("multi", state.multiPickMode && scriptsMode);
                    toolbar.setEnabled("favorites", scriptsMode);
                    toolbar.setEnabled("manage", scriptsMode && config.canEdit === true);
                    toolbar.setEnabled("link", scriptsMode);
                    toolbar.setEnabled("multi", scriptsMode && config.enableMulti === true);
                    toolbar.setVisible("manage", config.canEdit === true);
                    toolbar.setVisible("multi", config.enableMulti === true);
                    updateButtonTitle(
                        toolbar,
                        "favorites",
                        state.favoritesOnly ? "Show all scripts" : "Show favorites"
                    );
                    updateButtonTitle(
                        toolbar,
                        "manage",
                        state.editMode ? "Close edit mode" : "Edit scripts"
                    );
                    updateButtonTitle(
                        toolbar,
                        "link",
                        state.linkPickMode
                            ? "Close link mode"
                            : selectedScript
                                ? "Copy link to selected script"
                                : "Show link icons beside scripts"
                    );
                    updateButtonTitle(
                        toolbar,
                        "multi",
                        state.multiPickMode
                            ? "Close multi-device mode"
                            : "Show multi-device icons beside scripts"
                    );
                },

                toggleFavorites: function (toolbar, onChange) {
                    state.favoritesOnly = !state.favoritesOnly;
                    savePreferences();
                    if (toolbar) toolbar.setActive("favorites", state.favoritesOnly);
                    if (typeof onChange === "function") onChange();
                },

                toggleEdit: function (toolbar, onChange) {
                    state.editMode = !state.editMode;
                    stopPickModes("edit");
                    if (toolbar) {
                        toolbar.setActive("manage", state.editMode);
                        toolbar.setActive("link", false);
                        toolbar.setActive("multi", false);
                    }
                    if (typeof onChange === "function") onChange();
                },

                toggleLink: function (toolbar, selectedScript, onChange, onCopied) {
                    if (selectedScript) {
                        state.linkPickMode = false;
                        return copyScriptLink(selectedScript).then(function () {
                            if (toolbar) toolbar.setActive("link", true);
                            window.setTimeout(function () {
                                if (toolbar) toolbar.setActive("link", false);
                            }, 900);
                            if (typeof onCopied === "function") onCopied(selectedScript);
                            return true;
                        });
                    }
                    state.linkPickMode = !state.linkPickMode;
                    stopPickModes(state.linkPickMode ? "link" : "");
                    if (toolbar) {
                        toolbar.setActive("link", state.linkPickMode);
                        toolbar.setActive("multi", false);
                    }
                    if (typeof onChange === "function") onChange();
                    return Promise.resolve(false);
                },

                toggleMulti: function (toolbar, onChange) {
                    state.multiPickMode = !state.multiPickMode;
                    stopPickModes(state.multiPickMode ? "multi" : "");
                    if (toolbar) {
                        toolbar.setActive("multi", state.multiPickMode);
                        toolbar.setActive("link", false);
                    }
                    if (typeof onChange === "function") onChange();
                },

                copyScriptLink: function (toolbar, script, onCopied) {
                    var path = script && script.path || script;
                    return copyScriptLink(path).then(function () {
                        if (toolbar) toolbar.setActive("link", true);
                        window.setTimeout(function () {
                            if (toolbar) toolbar.setActive("link", false);
                        }, 900);
                        if (typeof onCopied === "function") onCopied(path);
                    });
                },

                scriptActions: function (script, config) {
                    config = config || {};
                    var actions = [];
                    if (state.linkPickMode) {
                        actions.push({
                            key: "link",
                            icon: "🔗",
                            title: "Copy bookmarkable link for this script",
                            onClick: function () {
                                copyScriptLink(script.path).then(function () {
                                    if (typeof config.onLinkCopied === "function") {
                                        config.onLinkCopied(script);
                                    }
                                });
                            }
                        });
                    }
                    if (state.editMode) {
                        actions.push({
                            key: "favorite",
                            icon: "★",
                            active: isFavorite(script.path),
                            className: "mc-tree-favorite-action",
                            title: isFavorite(script.path)
                                ? "Remove from favorites"
                                : "Add to favorites",
                            onClick: function () {
                                toggleFavorite(script.path);
                                if (typeof config.onFavoriteChanged === "function") {
                                    config.onFavoriteChanged(script);
                                }
                            }
                        });
                        if (config.canEdit === true) {
                            actions.push({
                                key: "edit",
                                icon: "✎",
                                title: "Edit script source",
                                onClick: function () {
                                    if (typeof config.onEdit === "function") {
                                        config.onEdit(script);
                                    }
                                }
                            });
                        }
                    }
                    if (state.multiPickMode && config.enableMulti === true) {
                        actions.push({
                            key: "multi",
                            icon: "⟳",
                            title: "Run this script on selected devices",
                            onClick: function () {
                                if (typeof config.onMulti === "function") {
                                    config.onMulti(script);
                                }
                            }
                        });
                    }
                    return actions;
                }
            };
        }
    };
}());
