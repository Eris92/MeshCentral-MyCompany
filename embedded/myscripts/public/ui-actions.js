(function () {
    "use strict";

    var plugin = window.MyScripts;
    if (!plugin || plugin.uiActionsInstalled) return;
    plugin.uiActionsInstalled = true;

    var originalRenderTree = plugin.renderTree;
    var originalBuildSettings = plugin.buildSettings;
    var originalLoadSettings = plugin.loadSettings;
    var observer = null;
    var refreshTimer = null;

    function actionButton(text, title, className, handler) {
        var button = document.createElement("button");
        button.type = "button";
        button.className = "btn btn-secondary btn-sm " + className;
        button.textContent = text;
        button.title = title;
        button.setAttribute("aria-label", title);
        button.addEventListener("click", function (event) {
            event.preventDefault();
            event.stopPropagation();
            handler(button.dataset.scriptPath || "");
        });
        return button;
    }

    function flattenScripts(node, result) {
        result = result || [];
        if (!node) return result;
        if (node.type === "script") result.push(node);
        (node.children || []).forEach(function (child) { flattenScripts(child, result); });
        return result;
    }

    function scriptForRow(row) {
        var path = String(row.getAttribute("data-script-path") || "");
        if (path) return plugin.findScript(plugin.state.tree, path);

        var main = row.querySelector(".myscripts-script-button");
        var label = String(main && main.textContent || "").replace(/⏳|🔑/g, "").trim();
        var scripts = flattenScripts(plugin.state.tree, []);

        for (var index = 0; index < scripts.length; index++) {
            if (String(scripts[index].label || scripts[index].name || "").trim() === label) {
                row.setAttribute("data-script-path", scripts[index].path);
                return scripts[index];
            }
        }
        return null;
    }

    function isFavorite(path) {
        return Array.isArray(plugin.state.favorites) && plugin.state.favorites.indexOf(String(path || "")) >= 0;
    }

    function saveFavorites() {
        try {
            localStorage.setItem(plugin.favoritesKey || "myscripts.favorites.v2", JSON.stringify(plugin.state.favorites || []));
        } catch (error) { }
    }

    function toggleFavorite(path) {
        path = String(path || "");
        plugin.state.favorites = Array.isArray(plugin.state.favorites) ? plugin.state.favorites : [];
        var index = plugin.state.favorites.indexOf(path);
        if (index >= 0) plugin.state.favorites.splice(index, 1);
        else plugin.state.favorites.push(path);
        saveFavorites();
        plugin.renderTree();
    }

    function buildLink(path) {
        var url = new URL(window.location.href);
        var viewMode = Number(plugin.state.config && plugin.state.config.viewMode) || 101;
        url.searchParams.set("viewmode", String(viewMode));
        url.searchParams.set("script", String(path || ""));
        url.searchParams.delete("vars");
        return url.href;
    }

    function copyLink(path) {
        var url = buildLink(path);
        try { window.history.replaceState(window.history.state, document.title, url); } catch (error) { }

        var copy = navigator.clipboard && navigator.clipboard.writeText && window.isSecureContext
            ? navigator.clipboard.writeText(url)
            : Promise.reject(new Error("Clipboard unavailable"));

        copy.then(function () {
            plugin.setStatus("Link copied. You can save this page as a browser bookmark.", "myscripts-status-ok");
        }).catch(function () {
            window.prompt("Copy the script link:", url);
        });
    }

    function findToolbarButton(host, text, titlePart) {
        var buttons = host ? host.querySelectorAll("button") : [];
        for (var index = 0; index < buttons.length; index++) {
            var title = String(buttons[index].title || "").toLowerCase();
            if (String(buttons[index].textContent || "").trim() === text || title.indexOf(titlePart) >= 0) return buttons[index];
        }
        return null;
    }

    function normalizeToolbar() {
        var host = document.querySelector("#MyScriptsMainPanel .myscripts-script-toolbar");
        if (!host) return;

        var collapse = document.getElementById("MyScriptsCollapseToggle") || findToolbarButton(host, "◀", "folders") || findToolbarButton(host, "▶", "folders");
        var favorite = findToolbarButton(host, "★", "favorites");
        var link = document.getElementById("MyScriptsLinkButton");
        var manage = document.getElementById("MyScriptsManageButton");
        var search = document.getElementById("MyScriptsSearchToggle") || findToolbarButton(host, "⌕", "search");
        var field = host.querySelector(".myscripts-search");

        if (favorite) {
            favorite.id = "MyScriptsFavoritesToggle";
            favorite.classList.add("myscripts-toolbar-button");
        }
        if (search) search.id = "MyScriptsSearchToggle";

        var desired = [collapse, favorite, link, manage, search, field].filter(Boolean);
        var current = Array.prototype.filter.call(host.children, function (item) {
            return desired.indexOf(item) >= 0;
        });
        var correct = current.length === desired.length && current.every(function (item, index) {
            return item === desired[index];
        });
        if (!correct) desired.forEach(function (item) { host.appendChild(item); });
    }

    function setActionVisible(button, visible) {
        if (!button) return;
        button.hidden = false;
        button.classList.toggle("myscripts-action-hidden", !visible);
        button.disabled = !visible;
        button.tabIndex = visible ? 0 : -1;
        button.setAttribute("aria-hidden", visible ? "false" : "true");
    }

    function claimAction(row, actionHost, selector, text, title, className, handler) {
        var items = row.querySelectorAll(selector);
        var button = items.length ? items[0] : null;
        for (var index = 1; index < items.length; index++) items[index].remove();
        if (!button) button = actionButton(text, title, className, handler);
        if (button.parentNode !== actionHost) actionHost.appendChild(button);
        return button;
    }

    function placeActions(actionHost, main, favorite, linkButton, edit) {
        var expected = [main, favorite, linkButton, edit];
        var current = Array.prototype.filter.call(actionHost.children, function (item) {
            return expected.indexOf(item) >= 0;
        });
        var correct = current.length === expected.length && current.every(function (item, index) {
            return item === expected[index];
        });
        if (!correct) expected.forEach(function (item) { actionHost.appendChild(item); });
    }

    function moveSettingsStatus(panel) {
        panel = panel || document.getElementById("MyScriptsSettingsPanel");
        if (!panel) return;
        var status = document.getElementById("MyScriptsSettingsStatus");
        var zabbix = panel.querySelector('[data-myscripts-zabbix-section="1"]');
        if (status && zabbix && status.previousElementSibling !== zabbix) panel.insertBefore(status, zabbix.nextSibling);
    }

    function refreshActions() {
        var root = document.getElementById("MyScriptsMainPanel");
        if (!root) return;

        root.classList.toggle("myscripts-manage-mode", plugin.state.manageMode === true);
        root.classList.toggle("myscripts-link-pick-mode", plugin.state.linkPickMode === true);
        normalizeToolbar();

        Array.prototype.forEach.call(root.querySelectorAll(".myscripts-script"), function (row) {
            var script = scriptForRow(row);
            var actionHost = row.querySelector(".myscripts-script-action");
            var main = actionHost && actionHost.querySelector(".myscripts-script-button");
            if (!script || !actionHost || !main) return;

            var path = script.path;
            row.classList.add("myscripts-actions-normalized");

            var favorite = claimAction(row, actionHost, ".myscripts-favorite-button", "★", "Add to favorites", "myscripts-favorite-button", function (scriptPath) {
                toggleFavorite(scriptPath);
            });
            favorite.dataset.scriptPath = path;
            favorite.title = isFavorite(path) ? "Remove from favorites" : "Add to favorites";
            favorite.setAttribute("aria-label", favorite.title);
            favorite.classList.toggle("active", isFavorite(path));
            setActionVisible(favorite, plugin.state.manageMode === true);

            var linkButton = claimAction(row, actionHost, ".myscripts-inline-link-button", "🔗", "Copy script link", "myscripts-inline-link-button", function (scriptPath) {
                plugin.state.selectedPath = scriptPath;
                copyLink(scriptPath);
            });
            linkButton.dataset.scriptPath = path;
            setActionVisible(linkButton, plugin.state.linkPickMode === true);

            var edit = claimAction(row, actionHost, ".myscripts-inline-edit-button", "✎", "Edit script definition", "myscripts-inline-edit-button", function (scriptPath) {
                plugin.state.selectedPath = scriptPath;
                plugin.openDefinitionEditor();
            });
            edit.dataset.scriptPath = path;
            setActionVisible(edit, plugin.state.manageMode === true && plugin.state.access && plugin.state.access.siteAdmin);

            placeActions(actionHost, main, favorite, linkButton, edit);
        });
    }

    function queueRefresh() {
        if (refreshTimer) window.clearTimeout(refreshTimer);
        refreshTimer = window.setTimeout(refreshActions, 0);
    }

    plugin.renderTree = function () {
        originalRenderTree.call(plugin);
        refreshActions();
    };

    plugin.buildSettings = function (panel) {
        originalBuildSettings.call(plugin, panel);
        moveSettingsStatus(panel);
    };

    plugin.loadSettings = function () {
        var result = originalLoadSettings.call(plugin);
        moveSettingsStatus();
        window.setTimeout(moveSettingsStatus, 0);
        return result;
    };

    document.addEventListener("click", function (event) {
        var target = event.target && event.target.closest ? event.target.closest("#MyScriptsManageButton, #MyScriptsLinkButton, #MyScriptsSearchToggle") : null;
        if (!target) return;
        window.setTimeout(refreshActions, 0);
        window.setTimeout(refreshActions, 50);
    }, true);

    var panel = document.getElementById("MyScriptsMainPanel");
    if (panel && typeof MutationObserver !== "undefined") {
        observer = new MutationObserver(queueRefresh);
        observer.observe(panel, { childList: true, subtree: true });
    }

    refreshActions();
    moveSettingsStatus();
}());
