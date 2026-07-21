(function () {
    "use strict";

    var tree = null;
    var selectedRoot = "";

    function roots() {
        return (tree && tree.children || []).filter(function (item) {
            return item.type === "directory";
        });
    }

    function find(node, path) {
        if (!node) return null;
        if (String(node.path || "") === String(path || "")) return node;
        var children = node.children || [];
        for (var i = 0; i < children.length; i++) {
            var value = find(children[i], path);
            if (value) return value;
        }
        return null;
    }

    function items(folder, search) {
        var rows = [];

        function walk(node) {
            (node.children || []).forEach(function (child) {
                if (child.type === "script") rows.push(child);
                else walk(child);
            });
        }

        if (search) walk(folder);
        else rows = folder.children || [];

        return rows.filter(function (item) {
            return !search || [
                item.label,
                item.name,
                item.description,
                item.path
            ].join(" ").toLowerCase().indexOf(search.toLowerCase()) >= 0;
        });
    }

    var module = window.MyCompanyModuleShell.create({
        key: "myscripts",
        title: "My Scripts",
        menuTitle: "My Scripts",
        order: 160,
        preset: "myscripts",
        buttons: {
            settings: false
        },
        tabs: [
            { key: "scripts", title: "Scripts" },
            { key: "results", title: "Results" }
        ],
        defaultTab: "scripts",
        render: function (shell) {
            if (shell.state.tab === "results") {
                shell.state.page.details.appendChild(shell.card(
                    "Results",
                    "Script results are retained by the individual script workflow."
                ));
                return;
            }

            return shell.api("scripts").then(function (result) {
                tree = result.tree;
                var list = roots();

                if (!selectedRoot && list.length) {
                    selectedRoot = list[0].path;
                }

                shell.nav(
                    shell.state.page.primary,
                    list.map(function (folder) {
                        return {
                            key: folder.path,
                            title: folder.name,
                            icon: folder.iconData ? "▣" : "▰"
                        };
                    }),
                    selectedRoot,
                    function (item) {
                        selectedRoot = item.key;
                        shell.render();
                    }
                );

                var folder = find(tree, selectedRoot) || tree;
                var rows = items(folder, shell.state.search);

                shell.nav(
                    shell.state.page.secondary,
                    rows.map(function (item) {
                        return {
                            key: item.path,
                            title: item.label || item.name,
                            icon: item.type === "directory" ? "▰" : "▶",
                            source: item
                        };
                    }),
                    "",
                    function (item) {
                        var source = item.source;
                        if (source.type === "directory") {
                            selectedRoot = source.path;
                            shell.render();
                            return;
                        }
                        shell.api("script", { path: source.path })
                            .then(function (scriptResult) {
                                shell.json(shell.state.page.details, scriptResult.script);
                            })
                            .catch(function (error) {
                                shell.error(shell.state.page.details, error);
                            });
                    }
                );

                shell.state.page.details.appendChild(shell.card(
                    folder.name || "Scripts",
                    folder.path || result.scriptsRoot || ""
                ));
            });
        }
    });

    window.MyCompanyModules.myscripts = module;
}());
