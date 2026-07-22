(function () {
    "use strict";

    function storageKey(options) {
        if (options.layoutStorageKey) return String(options.layoutStorageKey);
        var preset = String(options.preset || "standard").toLowerCase();
        return "mycompany.layout." + preset + ".collapsed";
    }

    window.SharedPage = {
        mount: function (options) {
            options = options || {};
            var host = typeof options.container === "string"
                ? document.querySelector(options.container)
                : options.container;
            var preset = String(options.preset || "standard").toLowerCase();

            host.innerHTML = "";
            host.className = "mc-shared-page mc-portal-module-shell mc-portal-module-" + preset;
            host.setAttribute("data-module-preset", preset);

            var tabsHost = document.createElement("div");
            tabsHost.className = "mc-portal-module-tabs";
            var toolbarHost = document.createElement("div");
            toolbarHost.className = "mc-portal-module-toolbar";
            var layoutHost = document.createElement("div");
            layoutHost.className = "mc-portal-module-workspace";

            host.appendChild(tabsHost);
            host.appendChild(toolbarHost);
            host.appendChild(layoutHost);

            var layout = window.SharedLayout.mount({
                container: layoutHost,
                storageKey: storageKey(options)
            });
            layout.root.classList.add("mc-portal-module-layout");
            layout.primary.classList.add("mc-portal-module-primary");
            layout.secondary.classList.add("mc-portal-module-secondary");
            layout.details.classList.add("mc-portal-module-details");

            var toolbar = window.SharedToolbar.mount({
                container: toolbarHost,
                preset: options.preset || "standard",
                buttons: options.buttons || {},
                handlers: options.handlers || {},
                customButtons: options.customButtons || []
            });
            var tabs = window.SharedTabs.mount({
                container: tabsHost,
                tabs: options.tabs || [],
                active: options.activeTab,
                onSelect: options.onTab
            });
            return {
                root: host,
                tabs: tabs,
                toolbar: toolbar,
                layout: layout,
                primary: layout.primary,
                secondary: layout.secondary,
                details: layout.details
            };
        }
    };
}());
