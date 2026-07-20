(function () {
    "use strict";

    var plugin = window.MyScripts;
    if (!plugin || plugin.uiStabilityV4Installed) return;
    plugin.uiStabilityV4Installed = true;

    var originalRenderTree = plugin.renderTree;
    var originalRenderOutputPanel = plugin.renderOutputPanel;
    var preferenceKey = plugin.uiPrefsKey || "myscripts.ui.preferences";
    var initialDeepLinkPath = "";
    var deepLinkOpened = false;
    var lastRenderedRoot = "";
    var toolbarObserver = null;
    var toolbarTimer = null;

    try { initialDeepLinkPath = String(new URL(window.location.href).searchParams.get("script") || ""); } catch (error) { }

    function readPreferences() {
        try {
            var value = JSON.parse(window.localStorage.getItem(preferenceKey) || "{}");
            return value && typeof value === "object" ? value : {};
        } catch (error) {
            return {};
        }
    }

    function writePreferences(update) {
        try {
            var value = readPreferences();
            Object.keys(update || {}).forEach(function (key) { value[key] = update[key]; });
            window.localStorage.setItem(preferenceKey, JSON.stringify(value));
        } catch (error) { }
    }

    function selectedPaths() {
        var value = readPreferences().selectedPathByRoot;
        return value && typeof value === "object" ? value : {};
    }

    function saveSelectedPath(rootPath, scriptPath) {
        rootPath = String(rootPath || "");
        if (!rootPath) return;
        var paths = selectedPaths();
        if (scriptPath) paths[rootPath] = String(scriptPath);
        else delete paths[rootPath];
        writePreferences({ selectedPathByRoot: paths, selectedRoot: rootPath });
    }

    function containsScript(node, path) {
        if (!node || !path) return false;
        if (node.type === "script" && String(node.path) === String(path)) return true;
        var children = node.children || [];
        for (var index = 0; index < children.length; index++) if (containsScript(children[index], path)) return true;
        return false;
    }

    function rootNodes() {
        var children = plugin.state.tree && plugin.state.tree.children || [];
        var roots = children.filter(function (item) { return item && item.type === "directory"; });
        var scripts = children.filter(function (item) { return item && item.type === "script"; });
        if (scripts.length) roots = [{ type: "directory", name: "Root", path: "__root__", children: scripts }].concat(roots);
        return roots;
    }

    function rootForScript(path) {
        var roots = rootNodes();
        for (var index = 0; index < roots.length; index++) if (containsScript(roots[index], path)) return roots[index];
        return null;
    }

    function currentRoot() {
        var roots = rootNodes();
        for (var index = 0; index < roots.length; index++) if (String(roots[index].path) === String(plugin.state.selectedRoot)) return roots[index];
        return null;
    }

    function normalize(value) {
        return String(value || "").trim().toLocaleLowerCase();
    }

    function pathBelongsToSelectedRoot(path) {
        var root = currentRoot();
        return !!(root && containsScript(root, path));
    }

    function restoreRootSelectionBeforeRender() {
        var rootPath = String(plugin.state.selectedRoot || "");
        if (!rootPath || rootPath === lastRenderedRoot) return;
        if (plugin.state.selectedPath && pathBelongsToSelectedRoot(plugin.state.selectedPath)) {
            saveSelectedPath(rootPath, plugin.state.selectedPath);
            return;
        }
        var stored = selectedPaths()[rootPath];
        plugin.state.selectedPath = stored && pathBelongsToSelectedRoot(stored) ? stored : "";
    }

    function rememberCurrentSelection() {
        var rootPath = String(plugin.state.selectedRoot || "");
        var path = String(plugin.state.selectedPath || "");
        if (rootPath && path && pathBelongsToSelectedRoot(path)) saveSelectedPath(rootPath, path);
    }

    function findToolbarButton(toolbar, id, text, titlePart) {
        var direct = id ? document.getElementById(id) : null;
        if (direct) return direct;
        var buttons = toolbar ? toolbar.querySelectorAll("button") : [];
        for (var index = 0; index < buttons.length; index++) {
            var title = String(buttons[index].title || "").toLowerCase();
            if ((text && String(buttons[index].textContent || "").trim() === text) || (titlePart && title.indexOf(titlePart) >= 0)) return buttons[index];
        }
        return null;
    }

    function stabilizeToolbar() {
        var toolbar = document.querySelector("#MyScriptsMainPanel .myscripts-script-toolbar");
        if (!toolbar) return;

        var collapse = findToolbarButton(toolbar, "MyScriptsCollapseToggle", "◀", "folders") || findToolbarButton(toolbar, "", "▶", "folders");
        var favorite = findToolbarButton(toolbar, "MyScriptsFavoritesToggle", "★", "favorite");
        var link = findToolbarButton(toolbar, "MyScriptsLinkButton", "🔗", "link");
        var manage = findToolbarButton(toolbar, "MyScriptsManageButton", "⚙", "edit scripts");
        var searchToggle = findToolbarButton(toolbar, "MyScriptsSearchToggle", "⌕", "search");
        var search = toolbar.querySelector(".myscripts-search");

        if (collapse) collapse.id = "MyScriptsCollapseToggle";
        if (favorite) favorite.id = "MyScriptsFavoritesToggle";
        if (link) link.id = "MyScriptsLinkButton";
        if (manage) manage.id = "MyScriptsManageButton";
        if (searchToggle) searchToggle.id = "MyScriptsSearchToggle";

        var desired = [collapse, favorite, link, manage, searchToggle, search].filter(Boolean);
        var current = Array.prototype.filter.call(toolbar.children, function (item) { return desired.indexOf(item) >= 0; });
        var correct = current.length === desired.length && current.every(function (item, index) { return item === desired[index]; });
        if (!correct) desired.forEach(function (item) { toolbar.appendChild(item); });

        if (search) search.hidden = plugin.state.searchVisible !== true;
        [collapse, favorite, link, manage, searchToggle].forEach(function (button) {
            if (button) button.classList.add("myscripts-toolbar-button", "myscripts-toolbar-button-stable");
        });
    }

    function queueToolbar() {
        if (toolbarTimer) window.clearTimeout(toolbarTimer);
        toolbarTimer = window.setTimeout(stabilizeToolbar, 0);
    }

    function expandScriptRow(row) {
        var parent = row;
        while (parent && parent.id !== "MyScriptsContent") {
            if (parent.classList && parent.classList.contains("myscripts-folder-body")) {
                parent.hidden = false;
                var section = parent.parentElement;
                var arrow = section && section.querySelector(".myscripts-folder-header .myscripts-folder-arrow");
                if (arrow) arrow.style.transform = "none";
            }
            parent = parent.parentElement;
        }
    }

    function findScriptRow(path) {
        var rows = document.querySelectorAll("#MyScriptsContent .myscripts-script[data-script-path]");
        for (var index = 0; index < rows.length; index++) if (String(rows[index].getAttribute("data-script-path") || "") === String(path)) return rows[index];
        return null;
    }

    function openDeepLink() {
        if (deepLinkOpened || !initialDeepLinkPath || !plugin.state.tree) return;
        var script = plugin.findScript(plugin.state.tree, initialDeepLinkPath);
        if (!script) return;
        var root = rootForScript(script.path);
        if (!root) return;

        if (String(plugin.state.selectedRoot) !== String(root.path)) {
            plugin.state.selectedRoot = root.path;
            plugin.state.selectedPath = script.path;
            saveSelectedPath(root.path, script.path);
            plugin.renderTree();
            return;
        }

        plugin.state.selectedPath = script.path;
        saveSelectedPath(root.path, script.path);
        if (typeof originalRenderOutputPanel === "function") originalRenderOutputPanel.call(plugin);

        var row = findScriptRow(script.path);
        var button = row && row.querySelector(".myscripts-script-button");
        if (!button) {
            window.setTimeout(openDeepLink, 80);
            return;
        }

        deepLinkOpened = true;
        expandScriptRow(row);
        try { row.scrollIntoView({ block: "nearest", inline: "nearest" }); } catch (error) { }
        window.setTimeout(function () { button.click(); }, 0);
    }

    function ensureMyJiraCss() {
        if (document.getElementById("myscripts-embedded-myjira-css")) return;
        var endpoint = new URL("pluginadmin.ashx", window.location.href);
        endpoint.searchParams.set("pin", "myjira");
        endpoint.searchParams.set("asset", "plugin.css");
        endpoint.searchParams.set("v", "embedded-1");
        var style = document.createElement("link");
        style.id = "myscripts-embedded-myjira-css";
        style.rel = "stylesheet";
        style.href = endpoint.href;
        (document.head || document.documentElement).appendChild(style);
    }

    function hideStandaloneJiraMenus() {
        ["MainMenuMyJira", "LeftMenuMyJira"].forEach(function (id) {
            var item = document.getElementById(id);
            if (item) item.style.display = "none";
        });
    }

    function renderJiraWorkspace() {
        var root = currentRoot();
        if (!root || normalize(root.name) !== "jira") return false;

        var layout = document.querySelector("#MyScriptsContent .myscripts-directory-layout");
        var directory = document.querySelector("#MyScriptsContent .myscripts-directory");
        var output = document.querySelector("#MyScriptsContent .myscripts-output-panel");
        if (!layout || !directory) return false;

        layout.classList.add("myscripts-special-layout", "myscripts-special-layout-active", "myscripts-jira-layout");
        directory.classList.add("myscripts-special-workspace", "myscripts-jira-workspace");
        directory.innerHTML = "";
        if (output) output.hidden = true;

        var host = document.createElement("div");
        host.id = "MyScriptsEmbeddedJira";
        directory.appendChild(host);
        ensureMyJiraCss();
        hideStandaloneJiraMenus();

        if (!window.MyJira || typeof window.MyJira.initialize !== "function" || typeof window.MyJira.build !== "function") {
            host.innerHTML = '<div class="myscripts-status myscripts-status-error">My Jira is not available. Install or enable the My Jira plugin backend.</div>';
            return true;
        }

        var oldBody = document.getElementById("MyJiraBody");
        if (oldBody && !host.contains(oldBody)) oldBody.innerHTML = "";

        Promise.resolve(window.MyJira.initialize()).then(function () {
            hideStandaloneJiraMenus();
            if (!(window.MyJira.state && window.MyJira.state.access && window.MyJira.state.access.allowed)) {
                host.innerHTML = '<div class="myscripts-status myscripts-status-error">You do not have access to My Jira.</div>';
                return;
            }
            window.MyJira.build(host);
            if (typeof window.MyJira.loadCurrent === "function") window.MyJira.loadCurrent(true);
        }).catch(function (error) {
            host.textContent = error && error.message || "Could not load My Jira.";
            host.className = "myscripts-status myscripts-status-error";
        });
        return true;
    }

    plugin.renderOutputPanel = function () {
        if (plugin.state.selectedPath && !pathBelongsToSelectedRoot(plugin.state.selectedPath)) plugin.state.selectedPath = "";
        if (typeof originalRenderOutputPanel === "function") return originalRenderOutputPanel.call(plugin);
    };

    plugin.renderTree = function () {
        restoreRootSelectionBeforeRender();
        var result = originalRenderTree.call(plugin);

        if (!lastRenderedRoot && plugin.state.selectedRoot) {
            var stored = selectedPaths()[plugin.state.selectedRoot];
            if (!plugin.state.selectedPath && stored && pathBelongsToSelectedRoot(stored)) {
                plugin.state.selectedPath = stored;
                if (typeof plugin.renderOutputPanel === "function") plugin.renderOutputPanel();
            }
        }

        lastRenderedRoot = String(plugin.state.selectedRoot || "");
        rememberCurrentSelection();
        stabilizeToolbar();
        renderJiraWorkspace();
        window.setTimeout(openDeepLink, 0);
        return result;
    };

    document.addEventListener("click", function (event) {
        var scriptButton = event.target && event.target.closest ? event.target.closest("#MyScriptsContent .myscripts-script-button") : null;
        if (scriptButton) {
            window.setTimeout(function () {
                rememberCurrentSelection();
                if (typeof plugin.renderOutputPanel === "function") plugin.renderOutputPanel();
            }, 0);
        }

        var rootButton = event.target && event.target.closest ? event.target.closest("#MyScriptsRoots .myscripts-root") : null;
        if (rootButton) window.setTimeout(function () { stabilizeToolbar(); }, 0);

        var toolbarButton = event.target && event.target.closest ? event.target.closest("#MyScriptsMainPanel .myscripts-script-toolbar button") : null;
        if (toolbarButton) window.setTimeout(stabilizeToolbar, 0);
    }, true);

    document.addEventListener("DOMContentLoaded", hideStandaloneJiraMenus);

    var mainPanel = document.getElementById("MyScriptsMainPanel");
    if (mainPanel && typeof MutationObserver !== "undefined") {
        toolbarObserver = new MutationObserver(queueToolbar);
        toolbarObserver.observe(mainPanel, { childList: true, subtree: true });
    }

    stabilizeToolbar();
    hideStandaloneJiraMenus();
}());
