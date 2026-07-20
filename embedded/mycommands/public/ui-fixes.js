(function () {
    "use strict";

    var plugin = window.MyCommands;
    if (!plugin || plugin.uiFixesInstalled) return;
    plugin.uiFixesInstalled = true;

    var originalRenderDevicePage = plugin.renderDevicePage;
    var originalRenderScriptTree = plugin.renderScriptTree;

    function removeStandaloneMenuEntries() {
        [
            "MainMenuMyCommands",
            "LeftMenuMyCommands",
            "MainMenuMyCompany",
            "LeftMenuMyCompany"
        ].forEach(function (id) {
            var element = document.getElementById(id);
            if (element && element.parentNode) element.parentNode.removeChild(element);
        });
    }

    function forceMenuDisabled() {
        plugin.state.ui = plugin.state.ui || {};
        plugin.state.ui.showInMenu = false;
        removeStandaloneMenuEntries();
    }

    var originalEnsureMenus = plugin.ensureMenus;
    plugin.ensureMenus = function () {
        forceMenuDisabled();
        return false;
    };

    var originalSyncIntegrations = plugin.syncIntegrations;
    plugin.syncIntegrations = function () {
        forceMenuDisabled();
        var result = typeof originalSyncIntegrations === "function" ? originalSyncIntegrations.apply(plugin, arguments) : undefined;
        forceMenuDisabled();
        return result;
    };

    var originalBuildSettings = plugin.buildSettings;
    plugin.buildSettings = function () {
        var root = originalBuildSettings.apply(plugin, arguments);
        var menuInput = root && root.querySelector("#MyCommandsShowInMenu");
        if (menuInput) {
            var menuLabel = menuInput.parentNode;
            menuInput.checked = false;
            menuInput.type = "hidden";
            root.appendChild(menuInput);
            if (menuLabel && menuLabel.parentNode) menuLabel.parentNode.removeChild(menuLabel);
        }
        return root;
    };

    var originalLoadSettings = plugin.loadSettings;
    plugin.loadSettings = function () {
        var result = originalLoadSettings.apply(plugin, arguments);
        [0, 100, 500].forEach(function (delay) {
            window.setTimeout(function () {
                var menuInput = document.getElementById("MyCommandsShowInMenu");
                if (menuInput) menuInput.checked = false;
                forceMenuDisabled();
            }, delay);
        });
        return result;
    };

    var originalSaveSettings = plugin.saveSettings;
    plugin.saveSettings = function () {
        var menuInput = document.getElementById("MyCommandsShowInMenu");
        if (menuInput) menuInput.checked = false;
        forceMenuDisabled();
        return originalSaveSettings.apply(plugin, arguments);
    };

    function findSearchToggle(toolbar) {
        if (!toolbar) return null;
        var buttons = toolbar.querySelectorAll("button.mycommands-toolbar-button");
        for (var index = 0; index < buttons.length; index++) {
            var title = String(buttons[index].title || "").toLowerCase();
            if (title.indexOf("search") >= 0 || String(buttons[index].textContent || "").trim() === "⌕") return buttons[index];
        }
        return buttons.length > 1 ? buttons[1] : null;
    }

    function syncToolbarOrder() {
        var toolbar = document.querySelector("#MyCommandsContent .mycommands-script-toolbar");
        if (!toolbar) return;
        var searchHost = toolbar.querySelector(".mycommands-script-search");
        var searchToggle = findSearchToggle(toolbar);
        if (searchToggle) {
            searchToggle.id = "MyCommandsSearchToggle";
            if (searchHost) toolbar.insertBefore(searchToggle, searchHost);
            else toolbar.appendChild(searchToggle);
        }
    }

    plugin.renderDevicePage = function () {
        if (plugin.state.category !== "scripts") return originalRenderDevicePage.call(plugin);

        var root = document.getElementById("mycommands-device-page");
        if (!root) return;
        root.className = "mycommands-root mycommands-scripts-page";
        root.setAttribute("data-meshcentral-plugin-pin", "mycommands");
        root.setAttribute("data-meshcentral-plugin-click", "Commands scripts page");
        root.innerHTML = "";

        plugin.createTabs(root);

        var content = document.createElement("div");
        content.id = "MyCommandsContent";
        content.className = "mycommands-content mycommands-scripts-content";
        root.appendChild(content);

        plugin.renderCategory();

        var layout = content.querySelector(".mycommands-script-layout");
        if (!layout) {
            layout = document.createElement("div");
            layout.className = "mycommands-script-layout";
            content.appendChild(layout);
        }

        var result = document.createElement("section");
        result.id = "MyCommandsResult";
        result.className = "mycommands-result-panel mycommands-script-result-panel";
        layout.appendChild(result);

        syncToolbarOrder();
        plugin.updateScriptToolbar();
        plugin.renderResult();
    };

    plugin.renderScriptTree = function () {
        originalRenderScriptTree.call(plugin);
        syncToolbarOrder();

        var roots = document.getElementById("MyCommandsScriptRoots");
        if (roots) {
            Array.prototype.forEach.call(roots.querySelectorAll(".mycommands-root-button"), function (button) {
                button.classList.add("mycommands-sidebar-item");
                button.title = button.title || String(button.textContent || "").trim();
                button.setAttribute("aria-label", button.title);
            });
        }

        var tree = document.getElementById("MyCommandsScriptTree");
        if (tree) tree.classList.add("mycommands-directory");
    };

    var originalUpdateScriptToolbar = plugin.updateScriptToolbar;
    plugin.updateScriptToolbar = function () {
        originalUpdateScriptToolbar.call(plugin);
        syncToolbarOrder();
    };

    [0, 100, 500, 1500, 3000].forEach(function (delay) {
        window.setTimeout(forceMenuDisabled, delay);
    });
}());
