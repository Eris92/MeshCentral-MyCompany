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
        app.active = false;
        app.opening = false;
        app.activeModule = "scripts";
        app.nativeState = null;

        function createButton(label, moduleName) {
            var button = document.createElement("button");
            button.type = "button";
            button.textContent = label;
            button.className = "btn btn-secondary btn-sm";
            button.style.marginRight = "8px";
            button.style.marginBottom = "8px";
            button.onclick = function () { app.showModule(moduleName); };
            button.setAttribute("data-mycompany-module", moduleName);
            return button;
        }

        function hideElement(element) {
            if (!element) return null;
            var state = { element: element, display: element.style.display };
            element.style.display = "none";
            return state;
        }

        function restoreElement(state) {
            if (state && state.element) state.element.style.display = state.display;
        }

        app.ensureWorkspace = function () {
            var page = document.getElementById("p1");
            var titleHost = document.getElementById("p1title");
            if (!page || !titleHost) return null;

            var host = document.getElementById("MyCompanyWorkspace");
            if (!host) {
                host = document.createElement("div");
                host.id = "MyCompanyWorkspace";
                host.style.display = "none";
                host.style.boxSizing = "border-box";
                host.style.width = "100%";
                host.style.height = "calc(100vh - 104px)";
                host.style.minHeight = "0";
                host.style.overflow = "auto";
                host.style.padding = "8px 12px 18px";

                var nav = document.createElement("div");
                nav.id = "MyCompanyNavigation";
                nav.style.display = "flex";
                nav.style.flexWrap = "wrap";
                nav.style.alignItems = "center";
                nav.style.marginBottom = "10px";
                nav.appendChild(createButton("Scripts", "scripts"));
                nav.appendChild(createButton("Commands", "commands"));
                nav.appendChild(createButton("Approvals", "approvals"));
                nav.appendChild(createButton("Move Requests", "move"));
                nav.appendChild(createButton("Settings", "settings"));
                host.appendChild(nav);

                var content = document.createElement("div");
                content.id = "MyCompanyContent";
                content.style.border = "1px solid rgba(127,127,127,.65)";
                content.style.borderRadius = "5px";
                content.style.padding = "18px";
                content.style.minHeight = "260px";
                content.style.boxSizing = "border-box";
                host.appendChild(content);
                page.appendChild(host);
            }
            return host;
        };

        app.showNativePage = function () {
            var page = document.getElementById("p1");
            var titleHost = document.getElementById("p1title");
            var workspace = app.ensureWorkspace();
            if (!page || !titleHost || !workspace) return null;

            var heading = titleHost.querySelector("h1") || titleHost.querySelector(".fs-4") || titleHost.querySelector("h2");
            if (!app.nativeState) {
                var hidden = [];
                for (var child = page.firstElementChild; child; child = child.nextElementSibling) {
                    if (child !== titleHost && child !== workspace) hidden.push(hideElement(child));
                }
                app.nativeState = {
                    heading: heading,
                    headingText: heading ? heading.textContent : "",
                    hidden: hidden,
                    toolbar: hideElement(titleHost.querySelector('[id="devListToolbarViewIcons"]'))
                };
            }
            if (heading) heading.textContent = "My Company";
            workspace.style.display = "block";
            page.style.display = "";
            return page;
        };

        app.restoreNativePage = function () {
            var state = app.nativeState;
            if (!state) return;
            if (state.heading) state.heading.textContent = state.headingText;
            (state.hidden || []).forEach(restoreElement);
            restoreElement(state.toolbar);
            var workspace = document.getElementById("MyCompanyWorkspace");
            if (workspace) workspace.style.display = "none";
            app.nativeState = null;
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
            if (!app.showNativePage()) return false;

            var content = document.getElementById("MyCompanyContent");
            content.innerHTML = "";
            var heading = document.createElement("h3");
            heading.textContent = current[0];
            heading.style.marginTop = "0";
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
                button.style.marginBottom = "8px";
            });
            app.active = true;
            window.xxcurrentView = 106;
            try { window.history.replaceState(null, "", "?viewmode=106&mycompany=" + encodeURIComponent(app.activeModule)); } catch (error) { }
            return false;
        };

        app.open = function (event) {
            if (event && (event.which === 3 || event.button === 2)) return false;
            if (app.opening) return false;
            app.opening = true;
            try {
                if (typeof window.go === "function") window.go(1);
                app.showModule(app.activeModule || "scripts");
                if (event && event.preventDefault) event.preventDefault();
                if (event && event.stopPropagation) event.stopPropagation();
                return false;
            } finally { app.opening = false; }
        };

        app.close = function () {
            app.restoreNativePage();
            app.active = false;
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

    obj.goPageStart = function () {
        if (typeof window !== "undefined" && window.MyCompany && window.MyCompany.active) window.MyCompany.close();
    };
    obj.goPageEnd = function () {
        if (typeof window !== "undefined" && window.MyCompany) window.MyCompany.ensureMenus();
    };

    return obj;
};