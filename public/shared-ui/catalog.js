(function () {
    "use strict";

    function createResultsButton(host, active, onClick) {
        var button = document.createElement("button");
        button.type = "button";
        button.className = "mc-shared-nav-item mc-catalog-results";
        button.textContent = "▤ Results";
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
            createResultsButton(host, options.resultsActive, function () {
                if (typeof options.onResults === "function") {
                    options.onResults();
                }
            });

            var separator = document.createElement("div");
            separator.className = "mc-catalog-separator";
            host.appendChild(separator);

            var roots = document.createElement("div");
            roots.className = "mc-catalog-roots";
            host.appendChild(roots);

            var treeContainer = options.treeContainer || document.createElement("div");
            return window.SharedDirectoryTree.mount({
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
        }
    };
}());
