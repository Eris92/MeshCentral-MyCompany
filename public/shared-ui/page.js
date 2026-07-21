(function () {
    "use strict";
    window.SharedPage = {
        mount: function (options) {
            var host = typeof options.container === "string" ? document.querySelector(options.container) : options.container;
            host.innerHTML = ""; host.className = "mc-shared-page";
            var tabsHost = document.createElement("div"), toolbarHost = document.createElement("div"), layoutHost = document.createElement("div");
            host.appendChild(tabsHost); host.appendChild(toolbarHost); host.appendChild(layoutHost);
            var layout = window.SharedLayout.mount({ container: layoutHost });
            var toolbar = window.SharedToolbar.mount({ container: toolbarHost, preset: options.preset || "standard", buttons: options.buttons || {}, handlers: options.handlers || {}, customButtons: options.customButtons || [] });
            var tabs = window.SharedTabs.mount({ container: tabsHost, tabs: options.tabs || [], active: options.activeTab, onSelect: options.onTab });
            return { root: host, tabs: tabs, toolbar: toolbar, layout: layout, primary: layout.primary, secondary: layout.secondary, details: layout.details };
        }
    };
}());
