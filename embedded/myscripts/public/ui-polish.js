(function () {
    "use strict";

    var plugin = window.MyScripts;
    if (!plugin || plugin.uiPolishInstalled) return;
    plugin.uiPolishInstalled = true;

    var originalBuildContent = plugin.buildContent;
    var originalRenderTree = plugin.renderTree;

    function byId(id) {
        return document.getElementById(id);
    }

    function toolbarFavorite(toolbar) {
        var buttons = toolbar ? toolbar.querySelectorAll("button.myscripts-toolbar-button") : [];
        for (var index = 0; index < buttons.length; index++) {
            var title = String(buttons[index].title || "").toLowerCase();
            if (title.indexOf("favorite") >= 0) return buttons[index];
        }
        return null;
    }

    function normalizeToolbar() {
        var toolbar = document.querySelector("#MyScriptsMainPanel .myscripts-script-toolbar");
        if (!toolbar) return;

        var collapse = byId("MyScriptsCollapseToggle") || toolbar.querySelector("button.myscripts-toolbar-button");
        var favorite = toolbarFavorite(toolbar);
        var link = byId("MyScriptsLinkButton");
        var manage = byId("MyScriptsManageButton");
        var searchToggle = byId("MyScriptsSearchToggle");
        var search = toolbar.querySelector(".myscripts-search");

        [collapse, favorite, link, manage, searchToggle].forEach(function (item) {
            if (!item) return;
            item.classList.add("myscripts-toolbar-button-uniform");
            toolbar.appendChild(item);
        });
        if (search) toolbar.appendChild(search);
    }

    function containsScript(node, path) {
        if (!node) return false;
        if (node.type === "script" && node.path === path) return true;
        var children = node.children || [];
        for (var index = 0; index < children.length; index++) {
            if (containsScript(children[index], path)) return true;
        }
        return false;
    }

    function rootForScript(tree, path) {
        var children = tree && tree.children || [];
        var rootScript = false;
        for (var index = 0; index < children.length; index++) {
            var child = children[index];
            if (child.type === "script" && child.path === path) rootScript = true;
            if (child.type === "directory" && containsScript(child, path)) return child.path;
        }
        return rootScript ? "__root__" : "";
    }

    function prepareDeepLink() {
        if (!plugin.state.tree) return null;
        var path = "";
        try { path = String(new URL(window.location.href).searchParams.get("script") || ""); }
        catch (error) { return null; }
        if (!path || plugin.state.deepLinkAppliedPath === path) return null;

        plugin.state.deepLinkAppliedPath = path;
        var script = plugin.findScript(plugin.state.tree, path);
        if (!script) {
            window.setTimeout(function () {
                plugin.setStatus("The script from the link was not found: " + path, "myscripts-status-error");
            }, 0);
            return null;
        }

        plugin.state.scriptFilter = "";
        plugin.state.selectedPath = script.path;
        plugin.state.selectedRoot = rootForScript(plugin.state.tree, script.path) || plugin.state.selectedRoot;
        return script;
    }

    function scriptRows() {
        return document.querySelectorAll("#MyScriptsContent .myscripts-script[data-script-path]");
    }

    function findScriptRow(path) {
        var rows = scriptRows();
        for (var index = 0; index < rows.length; index++) {
            if (String(rows[index].getAttribute("data-script-path") || "") === path) return rows[index];
        }
        return null;
    }

    function exposeSelectedScript(script, fromLink) {
        var rows = scriptRows();
        for (var index = 0; index < rows.length; index++) rows[index].classList.remove("myscripts-script-selected");
        if (!script) return;

        var row = findScriptRow(script.path);
        if (!row) return;
        row.classList.add("myscripts-script-selected");

        var parent = row.parentElement;
        while (parent && parent.id !== "MyScriptsContent") {
            if (parent.classList && parent.classList.contains("myscripts-folder-body")) {
                parent.hidden = false;
                var section = parent.parentElement;
                var arrow = section && section.querySelector(":scope > .myscripts-folder-header .myscripts-folder-arrow");
                if (arrow) arrow.style.transform = "none";
            }
            parent = parent.parentElement;
        }

        if (fromLink) {
            window.setTimeout(function () {
                try { row.scrollIntoView({ block: "nearest", inline: "nearest" }); } catch (error) { }
                plugin.setStatus("Script selected from link: " + (script.label || script.name), "myscripts-status-ok");
            }, 0);
        }
    }

    function normalizeFavorites() {
        Array.prototype.forEach.call(document.querySelectorAll("#MyScriptsContent .myscripts-favorite-button"), function (star) {
            var active = String(star.title || "").toLowerCase().indexOf("remove") >= 0;
            star.textContent = "★";
            star.classList.toggle("active", active);
            star.setAttribute("aria-pressed", active ? "true" : "false");
        });

        var toolbar = document.querySelector("#MyScriptsMainPanel .myscripts-script-toolbar");
        var favorite = toolbarFavorite(toolbar);
        if (favorite) favorite.setAttribute("aria-pressed", favorite.classList.contains("active") ? "true" : "false");
    }

    plugin.buildContent = function (body) {
        originalBuildContent.call(plugin, body);
        normalizeToolbar();
    };

    plugin.renderTree = function () {
        var linked = prepareDeepLink();
        originalRenderTree.call(plugin);
        normalizeToolbar();
        normalizeFavorites();
        var selected = plugin.state.selectedPath ? plugin.findScript(plugin.state.tree, plugin.state.selectedPath) : null;
        exposeSelectedScript(selected, !!linked);
    };
}());
