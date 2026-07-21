(function () {
    "use strict";

    function createResultsButton(host, active, onClick) {
        var button = document.createElement("button");
        button.type = "button";
        button.className = "mc-shared-nav-item mc-catalog-results";
        button.title = "Results";

        var icon = document.createElement("span");
        icon.className = "mc-tree-fallback-icon";
        icon.textContent = "▤";
        button.appendChild(icon);

        var label = document.createElement("span");
        label.className = "mc-tree-label";
        label.textContent = "Results";
        button.appendChild(label);

        button.classList.toggle("active", active === true);
        button.onclick = onClick;
        host.appendChild(button);
        return button;
    }

    window.SharedCatalogView = {
        mount: function (options) {
            options = options || {};
            var host = options.primaryContainer;
            if (!host) throw new Error("Catalog primary container not found.");

            host.innerHTML = "";

            var navigation = document.createElement("div");
            navigation.className = "mc-catalog-navigation";
            host.appendChild(navigation);

            createResultsButton(navigation, options.resultsActive, function () {
                if (typeof options.onResults === "function") {
                    options.onResults();
                }
            });

            var roots = document.createElement("div");
            roots.className = "mc-catalog-roots";
            navigation.appendChild(roots);

            var treeContainer = options.treeContainer || document.createElement("div");
            var state = window.SharedDirectoryTree.mount({
                rootsContainer: roots,
                treeContainer: treeContainer,
                tree: options.tree,
                state: options.state,
                search: options.search || "",
                emptyText: options.emptyText,
                emptyFolderText: options.emptyFolderText,
                filterScript: options.filterScript,
                onRootSelect: function (root) {
                    if (typeof options.onRootSelect === "function") {
                        options.onRootSelect(root);
                    }
                },
                onScript: function (script) {
                    if (typeof options.onScript === "function") {
                        options.onScript(script);
                    }
                }
            });

            if (options.resultsActive) {
                roots.querySelectorAll(".mc-tree-root.active").forEach(function (button) {
                    button.classList.remove("active");
                });
            }

            return state;
        }
    };
}());
