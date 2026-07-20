(function () {
    "use strict";

    var plugin = window.MyScripts;
    if (!plugin || plugin.uiLayoutV3Installed) return;
    plugin.uiLayoutV3Installed = true;

    var preferenceKey = plugin.uiPrefsKey || "myscripts.ui.preferences";
    var originalSaveUiPrefs = plugin.saveUiPrefs;
    var originalRenderTree = plugin.renderTree;
    var originalUpdateTreeToolbar = plugin.updateTreeToolbar;
    var originalBuildSettings = plugin.buildSettings;
    var originalLoadSettings = plugin.loadSettings;
    var settingsObserver = null;

    function readPreferences() {
        try {
            var value = JSON.parse(window.localStorage.getItem(preferenceKey) || "{}");
            return value && typeof value === "object" ? value : {};
        } catch (error) {
            return {};
        }
    }

    function writePreferences() {
        try {
            var value = readPreferences();
            value.folderMenuCollapsed = plugin.state.folderMenuCollapsed === true;
            value.searchVisible = plugin.state.searchVisible === true;
            value.favoritesOnly = plugin.state.favoritesOnly === true;
            value.selectedRoot = String(plugin.state.selectedRoot || "");
            value.folderMenuWidth = Math.max(150, Math.min(280, Number(value.folderMenuWidth) || 190));
            window.localStorage.setItem(preferenceKey, JSON.stringify(value));
        } catch (error) { }
    }

    function restorePreferences() {
        var value = readPreferences();
        if (typeof value.folderMenuCollapsed === "boolean") plugin.state.folderMenuCollapsed = value.folderMenuCollapsed;
        if (typeof value.searchVisible === "boolean") plugin.state.searchVisible = value.searchVisible;
        if (typeof value.favoritesOnly === "boolean") plugin.state.favoritesOnly = value.favoritesOnly;
        if (value.selectedRoot) plugin.state.selectedRoot = String(value.selectedRoot);
    }

    function visibleActionCount() {
        var count = 0;
        if (plugin.state.manageMode === true && plugin.state.access && plugin.state.access.siteAdmin) count += 2;
        if (plugin.state.linkPickMode === true) count += 1;
        return count;
    }

    function applyLayoutState() {
        var panel = document.getElementById("MyScriptsMainPanel");
        if (!panel) return;

        var preferences = readPreferences();
        var folderWidth = Math.max(150, Math.min(280, Number(preferences.folderMenuWidth) || 190));
        var actions = visibleActionCount();
        var actionWidth = actions > 0 ? (actions * 34) + (actions * 5) : 0;

        panel.style.setProperty("--myscripts-folder-width", folderWidth + "px");
        panel.style.setProperty("--myscripts-action-count", String(actions));
        panel.style.setProperty("--myscripts-actions-width", actionWidth + "px");
        panel.classList.toggle("myscripts-favorites-only", plugin.state.favoritesOnly === true);
        panel.classList.toggle("myscripts-folder-menu-collapsed", plugin.state.folderMenuCollapsed === true);

        var favorites = document.getElementById("MyScriptsFavoritesToggle");
        if (favorites) {
            favorites.classList.toggle("active", plugin.state.favoritesOnly === true);
            favorites.setAttribute("aria-pressed", plugin.state.favoritesOnly ? "true" : "false");
            favorites.title = plugin.state.favoritesOnly ? "Show all scripts" : "Show favorites";
            favorites.setAttribute("aria-label", favorites.title);
        }
    }

    function enhanceFolderPermissions(panel) {
        panel = panel || document.getElementById("MyScriptsSettingsPanel");
        if (!panel) return;

        var rows = panel.querySelector("#MyScriptsFolderPermissions");
        if (!rows) return;

        var section = rows.closest ? rows.closest(".myscripts-settings-section") : null;
        if (section) section.setAttribute("data-myscripts-folder-permissions", "1");

        var checkboxes = rows.querySelectorAll('input[data-group-option="1"]');
        rows.setAttribute("data-mesh-group-count", String(checkboxes.length));

        Array.prototype.forEach.call(rows.querySelectorAll(".myscripts-folder-permission-row"), function (row) {
            row.classList.add("myscripts-folder-permission-row-v3");
            var folderLabel = row.firstElementChild;
            if (folderLabel) folderLabel.classList.add("myscripts-folder-name-v3");

            var groupHost = row.querySelector(".myscripts-folder-permission-groups");
            if (!groupHost) return;
            groupHost.setAttribute("role", "group");
            groupHost.setAttribute("aria-label", "MeshCentral user groups for " + String(folderLabel && folderLabel.textContent || "folder"));

            Array.prototype.forEach.call(groupHost.querySelectorAll(".myscripts-group-checkbox"), function (label) {
                label.classList.add("myscripts-mesh-group-option");
                var checkbox = label.querySelector('input[data-group-option="1"]');
                var text = label.querySelector("span");
                if (checkbox) {
                    label.title = (text ? text.textContent : checkbox.value) + " — " + checkbox.value;
                    checkbox.setAttribute("data-mesh-user-group-id", checkbox.value);
                }
            });
        });

        var empty = rows.querySelector(".myscripts-no-mesh-groups");
        if (!checkboxes.length) {
            if (!empty) {
                empty = document.createElement("div");
                empty.className = "myscripts-no-mesh-groups myscripts-status-error";
                empty.textContent = "No MeshCentral user groups were found. Create a user group in MeshCentral and reopen Settings.";
                rows.insertBefore(empty, rows.firstChild);
            }
        } else if (empty) {
            empty.remove();
        }
    }

    function observeSettings(panel) {
        if (!panel || typeof MutationObserver === "undefined") return;
        if (settingsObserver) settingsObserver.disconnect();
        settingsObserver = new MutationObserver(function () { enhanceFolderPermissions(panel); });
        settingsObserver.observe(panel, { childList: true, subtree: true });
    }

    restorePreferences();

    plugin.saveUiPrefs = function () {
        if (typeof originalSaveUiPrefs === "function") originalSaveUiPrefs.call(plugin);
        writePreferences();
    };

    plugin.renderTree = function () {
        var result = originalRenderTree.call(plugin);
        applyLayoutState();
        writePreferences();
        return result;
    };

    plugin.updateTreeToolbar = function () {
        var result = originalUpdateTreeToolbar.call(plugin);
        applyLayoutState();
        return result;
    };

    plugin.buildSettings = function (panel) {
        var result = originalBuildSettings.call(plugin, panel);
        observeSettings(panel);
        enhanceFolderPermissions(panel);
        return result;
    };

    plugin.loadSettings = function () {
        var result = originalLoadSettings.call(plugin);
        window.setTimeout(function () { enhanceFolderPermissions(); }, 0);
        window.setTimeout(function () { enhanceFolderPermissions(); }, 150);
        window.setTimeout(function () { enhanceFolderPermissions(); }, 500);
        return result;
    };

    document.addEventListener("click", function (event) {
        var target = event.target && event.target.closest ? event.target.closest("#MyScriptsFavoritesToggle, #MyScriptsCollapseToggle") : null;
        if (!target) return;
        window.setTimeout(function () {
            applyLayoutState();
            writePreferences();
        }, 0);
    }, true);

    applyLayoutState();
}());
