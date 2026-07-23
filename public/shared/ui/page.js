(function () {
    "use strict";

    function storageKey(options) {
        if (options.layoutStorageKey) return String(options.layoutStorageKey);
        var preset = String(options.preset || "standard").toLowerCase();
        return "sirkPlatform.layout." + preset + ".collapsed";
    }

    function isStandalonePortal() {
        try {
            return window.location.pathname.toLowerCase().indexOf("/sirkportal") === 0 ||
                document.getElementById("sirkStandaloneRoot") != null;
        } catch (error) {
            return false;
        }
    }

    window.SharedPage = {
        mount: function (options) {
            options = options || {};
            var host = typeof options.container === "string"
                ? document.querySelector(options.container)
                : options.container;
            var preset = String(options.preset || "standard").toLowerCase();
            var standalone = isStandalonePortal();

            host.innerHTML = "";
            host.className = standalone
                ? "mc-shared-page mc-portal-module-shell mc-portal-module-" + preset
                : "mc-shared-page";
            host.setAttribute("data-module-preset", preset);
            host.setAttribute("data-frontend", standalone ? "sirkportal" : "meshcentral");

            var tabsHost = document.createElement("div");
            tabsHost.className = standalone ? "mc-shared-tabs mc-portal-module-tabs" : "mc-shared-tabs";
            var toolbarHost = document.createElement("div");
            toolbarHost.className = standalone ? "mc-portal-module-toolbar" : "mc-shared-toolbar-host";
            var layoutHost = document.createElement("div");
            layoutHost.className = standalone ? "mc-portal-module-workspace" : "mc-shared-layout-host";

            host.appendChild(tabsHost);
            host.appendChild(toolbarHost);
            host.appendChild(layoutHost);

            var layout = window.SharedLayout.mount({
                container: layoutHost,
                storageKey: storageKey(options)
            });
            if (standalone) {
                layout.root.classList.add("mc-portal-module-layout");
                layout.primary.classList.add("mc-portal-module-primary");
                layout.secondary.classList.add("mc-portal-module-secondary");
                layout.details.classList.add("mc-portal-module-details");
            }

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
                details: layout.details,
                frontend: standalone ? "sirkportal" : "meshcentral"
            };
        }
    };
}());