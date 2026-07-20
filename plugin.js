"use strict";

var core = require("./core");
var modules = require("./modules");

module.exports.mycompany = function (parent) {
    var obj = {};
    var service = core.createRuntime(parent, obj);
    var loadedModules = modules.createAll(service);

    obj.parent = parent;
    obj.meshServer = parent && parent.parent;
    obj.exports = ["onWebUIStartupEnd", "goPageStart", "goPageEnd"];

    obj.server_startup = function () {
        return service.initialize().then(function () {
            return Promise.all(loadedModules.map(function (item) {
                return typeof item.initialize === "function" ? item.initialize() : null;
            }));
        });
    };

    obj.onWebUIStartupEnd = function () {
        if (typeof window === "undefined" || typeof document === "undefined") return;
        if (window.MyCompany && window.MyCompany.initialized) return;

        var app = window.MyCompany = window.MyCompany || {};
        app.initialized = true;
        app.activeModule = "scripts";

        function createButton(label, moduleName) {
            var button = document.createElement("button");
            button.type = "button";
            button.textContent = label;
            button.className = "btn btn-secondary btn-sm";
            button.style.marginRight = "8px";
            button.onclick = function () { app.showModule(moduleName); };
            button.setAttribute("data-mycompany-module", moduleName);
            return button;
        }

        app.ensureWorkspace = function () {
            var host = document.getElementById("MyCompanyWorkspace");
            if (host) return host;

            host = document.createElement("div");
            host.id = "MyCompanyWorkspace";
            host.style.display = "none";
            host.style.position = "fixed";
            host.style.left = "0";
            host.style.right = "0";
            host.style.top = "48px";
            host.style.bottom = "0";
            host.style.zIndex = "900";
            host.style.background = "var(--bs-body-bg, #fff)";
            host.style.color = "var(--bs-body-color, #222)";
            host.style.overflow = "auto";
            host.style.padding = "18px 22px";

            var header = document.createElement("div");
            header.style.display = "flex";
            header.style.alignItems = "center";
            header.style.justifyContent = "space-between";
            header.style.marginBottom = "16px";

            var title = document.createElement("h2");
            title.textContent = "My Company";
            title.style.margin = "0";
            header.appendChild(title);

            var close = document.createElement("button");
            close.type = "button";
            close.className = "btn btn-secondary btn-sm";
            close.textContent = "Back to MeshCentral";
            close.onclick = app.close;
            header.appendChild(close);
            host.appendChild(header);

            var nav = document.createElement("div");
            nav.id = "MyCompanyNavigation";
            nav.style.marginBottom = "18px";
            nav.appendChild(createButton("Scripts", "scripts"));
            nav.appendChild(createButton("Commands", "commands"));
            nav.appendChild(createButton("Approvals", "approvals"));
            nav.appendChild(createButton("Move Requests", "move"));
            nav.appendChild(createButton("Settings", "settings"));
            host.appendChild(nav);

            var content = document.createElement("div");
            content.id = "MyCompanyContent";
            content.style.border = "1px solid #c8c8c8";
            content.style.borderRadius = "6px";
            content.style.padding = "18px";
            content.style.minHeight = "260px";
            host.appendChild(content);

            document.body.appendChild(host);
            return host;
        };

        app.showModule = function (moduleName) {
            app.activeModule = moduleName || "scripts";
            var labels = {
                scripts: ["Scripts", "Module prepared for migration of My Scripts files."],
                commands: ["Commands", "Module prepared for migration of My Commands files."],
                approvals: ["Approvals", "Shared approval queue and provider configuration."],
                move: ["Move Requests", "Requests for moving devices between MeshCentral groups."],
                settings: ["Settings", "Module visibility, credentials and integration settings."]
            };
            var current = labels[app.activeModule] || labels.scripts;
            var workspace = app.ensureWorkspace();
            var content = document.getElementById("MyCompanyContent");
            content.innerHTML = "";

            var heading = document.createElement("h3");
            heading.textContent = current[0];
            content.appendChild(heading);

            var note = document.createElement("p");
            note.textContent = current[1];
            content.appendChild(note);

            var status = document.createElement("div");
            status.className = "alert alert-info";
            status.textContent = "MyCompany UI is loaded correctly. The next migration stage will connect the existing module backend and files.";
            content.appendChild(status);

            Array.prototype.forEach.call(document.querySelectorAll("#MyCompanyNavigation [data-mycompany-module]"), function (button) {
                var selected = button.getAttribute("data-mycompany-module") === app.activeModule;
                button.className = selected ? "btn btn-primary btn-sm" : "btn btn-secondary btn-sm";
                button.style.marginRight = "8px";
            });
            workspace.style.display = "block";
            try { window.history.replaceState(null, "", "?viewmode=106&mycompany=" + encodeURIComponent(app.activeModule)); } catch (error) { }
            return false;
        };

        app.open = function (event) {
            if (event) { event.preventDefault(); event.stopPropagation(); }
            app.showModule(app.activeModule || "scripts");
            return false;
        };

        app.close = function () {
            var workspace = document.getElementById("MyCompanyWorkspace");
            if (workspace) workspace.style.display = "none";
            try { if (typeof window.go === "function") window.go(1); } catch (error) { }
            return false;
        };

        app.ensureMenus = function () {
            var mainAnchor = document.getElementById("MainMenuMyDevices");
            if (mainAnchor && mainAnchor.parentNode && !document.getElementById("MainMenuMyCompany")) {
                var main = mainAnchor.cloneNode(false);
                main.id = "MainMenuMyCompany";
                main.textContent = "My Company";
                main.title = "My Company";
                main.href = "#";
                main.onclick = app.open;
                main.onmouseup = app.open;
                mainAnchor.parentNode.insertBefore(main, mainAnchor.nextSibling);
            }

            var leftAnchor = document.getElementById("LeftMenuMyDevices");
            if (leftAnchor && leftAnchor.parentNode && !document.getElementById("LeftMenuMyCompany")) {
                var left = leftAnchor.cloneNode(true);
                left.id = "LeftMenuMyCompany";
                left.title = "My Company";
                left.setAttribute("aria-label", "My Company");
                left.href = "#";
                left.onclick = app.open;
                left.onmouseup = app.open;
                var text = left.querySelector("span:not(.lbtg)");
                if (text) text.textContent = "My Company";
                leftAnchor.parentNode.insertBefore(left, leftAnchor.nextSibling);
            }
        };

        app.ensureWorkspace();
        app.ensureMenus();
        window.setTimeout(app.ensureMenus, 1000);
        window.setTimeout(app.ensureMenus, 3000);

        try {
            var query = new URL(window.location.href).searchParams;
            if (query.get("viewmode") === "106" || query.get("mycompany")) app.showModule(query.get("mycompany") || "scripts");
        } catch (error) { }
    };

    obj.goPageStart = function () { };
    obj.goPageEnd = function () { };

    return obj;
};