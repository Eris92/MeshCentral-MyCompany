(function () {
    "use strict";

    var plugin = window.MyScripts;
    if (!plugin || plugin.uiFinalInstalled) return;
    plugin.uiFinalInstalled = true;

    var originalBuildContent = plugin.buildContent;
    var originalRenderTree = plugin.renderTree;
    var originalUpdateTreeToolbar = plugin.updateTreeToolbar;

    function toolbar() {
        return document.querySelector("#MyScriptsMainPanel .myscripts-script-toolbar");
    }

    function findButton(predicate) {
        var host = toolbar();
        if (!host) return null;
        var buttons = host.querySelectorAll("button");
        for (var index = 0; index < buttons.length; index++) {
            if (predicate(buttons[index])) return buttons[index];
        }
        return null;
    }

    function collapseButton() {
        return document.getElementById("MyScriptsCollapseToggle") || findButton(function (item) {
            var title = String(item.title || "").toLowerCase();
            return title.indexOf("collapse folders") >= 0 || title.indexOf("expand folders") >= 0 || ["◀", "▶"].indexOf(String(item.textContent || "").trim()) >= 0;
        });
    }

    function favoriteButton() {
        return findButton(function (item) {
            return String(item.title || "").toLowerCase().indexOf("favorite") >= 0;
        });
    }

    function searchButton() {
        return document.getElementById("MyScriptsSearchToggle") || findButton(function (item) {
            var title = String(item.title || "").toLowerCase();
            return title.indexOf("search") >= 0 || ["⌕", "🔎", "🔍"].indexOf(String(item.textContent || "").trim()) >= 0;
        });
    }

    function normalizeToolbar() {
        var host = toolbar();
        if (!host) return;

        var collapse = collapseButton();
        var favorite = favoriteButton();
        var link = document.getElementById("MyScriptsLinkButton");
        var manage = document.getElementById("MyScriptsManageButton");
        var searchToggle = searchButton();
        var searchHost = host.querySelector(".myscripts-search");

        if (collapse) collapse.id = "MyScriptsCollapseToggle";
        if (searchToggle) searchToggle.id = "MyScriptsSearchToggle";

        [collapse, favorite, link, manage, searchToggle, searchHost].forEach(function (item) {
            if (item) host.appendChild(item);
        });
    }

    function normalizeCollapsedLayout() {
        var layout = document.querySelector("#MyScriptsMainPanel .myscripts-layout");
        var roots = document.getElementById("MyScriptsRoots");
        if (!layout || !roots) return;
        var collapsed = plugin.state.folderMenuCollapsed === true;
        layout.classList.toggle("myscripts-layout-collapsed", collapsed);
        roots.classList.toggle("myscripts-roots-collapsed", collapsed);
    }

    function normalizeSpecialWorkspace() {
        var layout = document.querySelector("#MyScriptsContent .myscripts-directory-layout");
        var workspace = document.querySelector("#MyScriptsContent .myscripts-special-workspace");
        if (!layout) return;
        layout.classList.toggle("myscripts-special-layout-active", !!workspace);
    }

    plugin.buildContent = function (body) {
        originalBuildContent.call(plugin, body);
        normalizeToolbar();
        normalizeCollapsedLayout();
    };

    plugin.updateTreeToolbar = function () {
        originalUpdateTreeToolbar.call(plugin);
        normalizeToolbar();
        normalizeCollapsedLayout();
    };

    plugin.renderTree = function () {
        originalRenderTree.call(plugin);
        normalizeToolbar();
        normalizeCollapsedLayout();
        normalizeSpecialWorkspace();
    };

    document.addEventListener("click", function () {
        window.setTimeout(function () {
            normalizeToolbar();
            normalizeCollapsedLayout();
            normalizeSpecialWorkspace();
        }, 0);
    }, true);
}());
