(function () {
    "use strict";

    if (!window.SharedScriptTools || window.__myCompanyFixedEditActions) return;
    window.__myCompanyFixedEditActions = true;

    if (!document.getElementById("mycompany-fixed-edit-actions-style")) {
        var style = document.createElement("style");
        style.id = "mycompany-fixed-edit-actions-style";
        style.textContent =
            ".mc-tree-script-actions{width:132px;min-width:132px;justify-content:flex-end}" +
            ".mc-tree-action-disabled{opacity:.28!important;filter:grayscale(1);cursor:not-allowed!important;pointer-events:none}" +
            ".mc-tree-credential-action:not(.mc-tree-action-disabled){color:#e0a800}";
        (document.head || document.documentElement).appendChild(style);
    }

    var originalCreate = window.SharedScriptTools.create;

    window.SharedScriptTools.create = function (options) {
        options = options || {};
        var tools = originalCreate.call(window.SharedScriptTools, options);
        var originalSyncToolbar = tools.syncToolbar;
        var originalToggleEdit = tools.toggleEdit;
        var originalScriptActions = tools.scriptActions;
        var deepLinkParameter = options.deepLinkParameter || "script";

        function hasCredentials(script) {
            return !!(script && (
                (Array.isArray(script.secretVariables) && script.secretVariables.length) ||
                (Array.isArray(script.secretDefinitions) && script.secretDefinitions.length)
            ));
        }

        function copyLink(script) {
            var url = new URL(window.location.href);
            if (typeof window.xxcurrentView !== "undefined") {
                url.searchParams.set("viewmode", String(window.xxcurrentView));
            }
            url.searchParams.set(deepLinkParameter, String(script.path || ""));
            try {
                window.history.replaceState(window.history.state, document.title, url.href);
            } catch (error) {}

            return tools.copyText(url.href).catch(function () {
                window.prompt("Copy the script link:", url.href);
            });
        }

        tools.syncToolbar = function (toolbar, mode, selectedScript, config) {
            originalSyncToolbar.call(tools, toolbar, mode, selectedScript, config);
            if (!toolbar) return;
            if (typeof toolbar.setVisible === "function") toolbar.setVisible("link", false);
            if (typeof toolbar.setEnabled === "function") toolbar.setEnabled("link", false);
            if (typeof toolbar.setActive === "function") toolbar.setActive("link", false);
        };

        tools.toggleLink = function () {
            return Promise.resolve(false);
        };

        tools.toggleEdit = function (toolbar, onChange) {
            tools.state.linkPickMode = false;
            return originalToggleEdit.call(tools, toolbar, onChange);
        };

        tools.scriptActions = function (script, config) {
            config = config || {};
            var actions = [];

            if (tools.state.editMode) {
                var credentialsAvailable = hasCredentials(script) && config.canEdit === true;
                var originals = originalScriptActions.call(tools, script, config) || [];
                var favoriteAction = originals.find(function (action) {
                    return action && action.key === "favorite";
                });

                actions.push({
                    key: "credentials",
                    icon: "🔑",
                    disabled: !credentialsAvailable,
                    className: credentialsAvailable
                        ? "mc-tree-credential-action"
                        : "mc-tree-action-disabled",
                    title: credentialsAvailable
                        ? "Configure script credentials"
                        : "This script has no SaveSecret variables",
                    onClick: function () {
                        if (credentialsAvailable && typeof config.onCredentials === "function") {
                            config.onCredentials(script);
                        }
                    }
                });

                actions.push({
                    key: "favorite",
                    icon: "★",
                    active: tools.isFavorite(script.path),
                    className: "mc-tree-favorite-action",
                    title: tools.isFavorite(script.path)
                        ? "Remove from favorites"
                        : "Add to favorites",
                    onClick: function () {
                        if (favoriteAction && typeof favoriteAction.onClick === "function") {
                            favoriteAction.onClick(script);
                        }
                    }
                });

                actions.push({
                    key: "link",
                    icon: "🔗",
                    title: "Copy bookmarkable link for this script",
                    onClick: function () {
                        copyLink(script).then(function () {
                            if (typeof config.onLinkCopied === "function") {
                                config.onLinkCopied(script);
                            }
                        });
                    }
                });

                actions.push({
                    key: "edit",
                    icon: "✎",
                    title: "Edit script definition and approval levels",
                    onClick: function () {
                        if (config.canEdit === true && typeof config.onEdit === "function") {
                            config.onEdit(script);
                        }
                    }
                });
            }

            if (tools.state.multiPickMode && config.enableMulti === true) {
                actions.push({
                    key: "multi",
                    icon: "⟳",
                    title: "Run this script on selected devices",
                    onClick: function () {
                        if (typeof config.onMulti === "function") config.onMulti(script);
                    }
                });
            }

            return actions;
        };

        return tools;
    };
}());