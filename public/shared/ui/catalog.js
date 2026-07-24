(function () {
    "use strict";

    function createResultsButton(host, active, onClick) {
        var button = document.createElement("button");
        button.type = "button";
        button.className = "mc-shared-nav-item mc-portal-nav-item sirk-management-item mc-catalog-results sirk-result-status sirk-result-status-all";
        button.title = "Results";
        button.setAttribute("aria-label", "Results");

        var icon = document.createElement("span");
        icon.className = "mc-tree-fallback-icon sirk-management-item-icon sirk-result-status-icon mc-portal-nav-icon";
        icon.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v14H4z"/><path d="M8 9h8M8 13h8"/></svg>';
        button.appendChild(icon);

        var label = document.createElement("span");
        label.className = "mc-tree-label mc-portal-nav-label";
        label.textContent = "Results";
        button.appendChild(label);

        button.classList.toggle("active", active === true);
        button.classList.toggle("is-active", active === true);
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

            function addResults() {
                return createResultsButton(navigation, options.resultsActive, function () {
                    if (typeof options.onResults === "function") options.onResults();
                });
            }

            if (options.resultsPosition !== "end") addResults();

            var roots = document.createElement("div");
            roots.className = "mc-catalog-roots";
            navigation.appendChild(roots);

            if (options.resultsPosition === "end") addResults();

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
                scriptActions: options.scriptActions,
                onRootSelect: function (root) {
                    if (typeof options.onRootSelect === "function") options.onRootSelect(root);
                },
                onScript: function (script) {
                    if (typeof options.onScript === "function") options.onScript(script);
                }
            });

            if (options.resultsActive) {
                roots.querySelectorAll(".mc-tree-root.active").forEach(function (button) {
                    button.classList.remove("active", "is-active");
                });
            }
            return state;
        }
    };
}());
