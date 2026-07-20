"use strict";

var createMyCompany = require("./plugin.js").mycompany;

module.exports.mycompany = function (parent) {
    var obj = createMyCompany(parent);

    // Embedded modules are registered in parent.plugins only so backend modules
    // can discover each other. Their browser hooks are exported by MyCompany
    // under embedded*Startup names and must not be invoked a second time.
    ["myscripts", "mycommands", "approvalcenter", "moverequest"].forEach(function (shortName) {
        if (parent && parent.exports) parent.exports[shortName] = [];
        if (parent && parent.plugins && parent.plugins[shortName]) parent.plugins[shortName].exports = [];
    });

    // Preserve the main serialized startup under a separate exported name.
    // The wrapper below runs it first and then installs the admin-only panel.
    obj.myCompanyMainStartup = obj.onWebUIStartupEnd;
    if (obj.exports.indexOf("myCompanyMainStartup") < 0) obj.exports.push("myCompanyMainStartup");

    obj.onWebUIStartupEnd = function () {
        if (typeof window === "undefined" || typeof document === "undefined") return;

        var api = window.pluginHandler && window.pluginHandler.mycompany;
        if (api && typeof api.myCompanyMainStartup === "function") api.myCompanyMainStartup();

        function hideSettingsTab() {
            var style = document.getElementById("mycompany-hide-settings-tab");
            if (!style) {
                style = document.createElement("style");
                style.id = "mycompany-hide-settings-tab";
                style.textContent = '[data-mycompany-module="settings"],[data-mycompany-persistent-module="settings"]{display:none!important}';
                (document.head || document.documentElement).appendChild(style);
            }
        }

        function openScripts(event) {
            if (event) {
                if (event.preventDefault) event.preventDefault();
                if (event.stopPropagation) event.stopPropagation();
            }
            if (window.MyCompany && typeof window.MyCompany.showModule === "function") {
                return window.MyCompany.showModule("scripts");
            }
            return false;
        }

        function patchMainMenu() {
            hideSettingsTab();
            if (window.MyCompany) window.MyCompany.open = openScripts;
            ["MainMenuMyCompany", "LeftMenuMyCompany"].forEach(function (id) {
                var item = document.getElementById(id);
                if (!item) return;
                item.onclick = openScripts;
                item.onmouseup = openScripts;
            });
        }

        function moduleReady(key) {
            if (key === "scripts") return !!(window.MyScripts && typeof window.MyScripts.open === "function");
            if (key === "commands") return !!(window.MyCommands && typeof window.MyCommands.openStandalone === "function");
            if (key === "approvals") return !!(window.ApprovalCenter && typeof window.ApprovalCenter.open === "function");
            if (key === "move") return !!(window.MoveRequest && typeof window.MoveRequest.initialize === "function");
            return false;
        }

        function renderAdminPanel() {
            if (!window.pluginHandler || typeof window.pluginHandler.registerPluginTab !== "function") return false;
            if (!document.getElementById("p19headers") || !document.getElementById("p19pages")) return false;

            window.pluginHandler.registerPluginTab({ tabId: "MyCompanyAdminPanel", tabTitle: "My Company" });
            var host = document.getElementById("MyCompanyAdminPanel");
            if (!host) return false;

            host.innerHTML = "";
            host.style.padding = "16px";

            var heading = document.createElement("h2");
            heading.textContent = "My Company";
            host.appendChild(heading);

            var description = document.createElement("p");
            description.textContent = "Standalone embedded module status";
            host.appendChild(description);

            [
                ["Scripts", "scripts"],
                ["Commands", "commands"],
                ["Approvals", "approvals"],
                ["Move Requests", "move"]
            ].forEach(function (item) {
                var row = document.createElement("div");
                row.style.padding = "10px 0";
                row.style.borderBottom = "1px solid rgba(127,127,127,.3)";

                var title = document.createElement("strong");
                title.textContent = item[0];
                row.appendChild(title);

                var status = document.createElement("div");
                status.textContent = moduleReady(item[1]) ? "Embedded and initialized" : "Embedded - UI is initializing";
                status.style.opacity = ".8";
                row.appendChild(status);
                host.appendChild(row);
            });

            var actions = document.createElement("div");
            actions.style.marginTop = "16px";

            var openButton = document.createElement("button");
            openButton.type = "button";
            openButton.className = "btn btn-primary";
            openButton.textContent = "Open My Company";
            openButton.onclick = openScripts;
            actions.appendChild(openButton);

            var refreshButton = document.createElement("button");
            refreshButton.type = "button";
            refreshButton.className = "btn btn-secondary";
            refreshButton.style.marginLeft = "8px";
            refreshButton.textContent = "Refresh status";
            refreshButton.onclick = renderAdminPanel;
            actions.appendChild(refreshButton);

            host.appendChild(actions);
            return true;
        }

        [0, 250, 1000, 2500].forEach(function (delay) {
            window.setTimeout(function () {
                patchMainMenu();
                renderAdminPanel();
            }, delay);
        });

        if (!window.__myCompanyAdminObserver) {
            window.__myCompanyAdminObserver = new MutationObserver(function () {
                window.clearTimeout(window.__myCompanyAdminObserverTimer);
                window.__myCompanyAdminObserverTimer = window.setTimeout(function () {
                    patchMainMenu();
                    renderAdminPanel();
                }, 50);
            });
            window.__myCompanyAdminObserver.observe(document.documentElement, { childList: true, subtree: true });
        }
    };

    return obj;
};
