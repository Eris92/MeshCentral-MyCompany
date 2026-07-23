(function () {
    "use strict";

    if (window.__sirkPlatformPortalModuleLoaded) return;
    window.__sirkPlatformPortalModuleLoaded = true;

    var core = window.SirkPlatformCore;
    var bootstrapState = null;
    var forcedView = "";
    var vendorVersion = "0.3.17";
    var sidebarStorageKey = "sirkPortal.sidebarCollapsed";
    var vendorScripts = [
        "sirk-preflight-0.3.13.js",
        "sirk-portal.js",
        "sirk-remote-modules-0.3.13.js",
        "sirk-portal-patch-0.2.8.js",
        "sirk-ui-icons-0.3.4.js",
        "sirk-layout-0.3.1.js",
        "sirk-ui-runtime-0.3.15.js",
        "sirk-device-layout-0.3.13.js",
        "sirk-controls-0.3.17.js"
    ];

    function vendorAsset(name) {
        return core.assetUrl("", "vendor/sirk-portal/" + name);
    }

    function ensureStyle(id, href) {
        var existing = document.getElementById(id);
        if (existing) {
            if (existing.href !== href) existing.href = href;
            return existing;
        }
        var link = document.createElement("link");
        link.id = id;
        link.rel = "stylesheet";
        link.href = href;
        (document.head || document.documentElement).appendChild(link);
        return link;
    }

    function loadStyle() {
        ensureStyle("sirk-platform-sirk-portal-vendor-style", vendorAsset("sirk-portal.css"));
        ensureStyle("sirk-platform-sirk-portal-adapter-style", core.assetUrl("", "portal.css"));
    }

    function loadVendor() {
        loadStyle();
        var chain = Promise.resolve();
        vendorScripts.forEach(function (name) {
            chain = chain.then(function () {
                return core.loadScript("sirk-platform-sirk-vendor-" + name.replace(/[^a-z0-9]/gi, "-"), vendorAsset(name));
            });
        });
        return chain.then(function () {
            return core.loadScript("sirk-platform-portal-management", core.assetUrl("", "portal-management.js"));
        });
    }

    function moduleEnabled(key) {
        var state = window.SirkPlatformRuntime && window.SirkPlatformRuntime.state && window.SirkPlatformRuntime.state.bootstrap;
        var value = state && state.modules && state.modules[key];
        return !!(value && value.enabled && value.ready !== false && value.access && value.access.allowed !== false);
    }

    function siteAdmin() {
        return !!(bootstrapState && bootstrapState.access && bootstrapState.access.siteAdmin);
    }

    function moduleError(host, title, message) {
        if (!host) return;
        host.innerHTML = '<div class="sirk-card"><h3>' + title + '</h3><p>' + message + '</p></div>';
    }

    function mountModule(key, host, title) {
        if (!host) return;
        if (!moduleEnabled(key)) {
            moduleError(host, title, "Moduł jest wyłączony albo użytkownik nie ma dostępu.");
            return;
        }
        var module = window.SirkPlatformModules && window.SirkPlatformModules[key];
        if (!module || typeof module.mount !== "function") {
            moduleError(host, title, "Moduł nie udostępnia punktu montowania.");
            return;
        }
        if (host.getAttribute("data-sirk-platform-mounted") === key && host.querySelector(":scope > .mc-shared-page")) return;
        host.innerHTML = "";
        host.setAttribute("data-sirk-platform-mounted", key);
        module.mount(host, "sirk-portal-" + key);
    }

    function mountSettings(host) {
        if (!host) return;
        if (!siteAdmin()) {
            moduleError(host, "Ustawienia", "Panel administracyjny jest dostępny tylko dla Site Admin.");
            return;
        }
        if (host.querySelector("iframe.sirk-settings-frame")) return;
        host.innerHTML = "";
        var frame = document.createElement("iframe");
        frame.className = "sirk-settings-frame";
        frame.title = "SirkPlatform settings";
        var url = new URL("pluginadmin.ashx", window.location.href);
        url.searchParams.set("pin", "SirkPlatform");
        frame.src = url.href;
        host.appendChild(frame);
    }

    function buttonLabel(button, text) {
        if (!button) return;
        var label = button.querySelector(".sirk-menu-label");
        if (!label) {
            var spans = button.querySelectorAll("span");
            if (spans.length) label = spans[spans.length - 1];
        }
        if (label) {
            label.textContent = text;
            label.classList.add("sirk-menu-label");
            return;
        }
        var created = document.createElement("span");
        created.className = "sirk-menu-label";
        created.textContent = text;
        button.appendChild(created);
    }

    function managementIcon() {
        return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="2"/><circle cx="15" cy="17" r="2"/></svg>';
    }

    function findManagementNavigation(root) {
        var direct = root.querySelector('[data-sirk-platform-management-nav="1"], [data-sirk-view="management"]');
        if (direct) return direct;
        var candidates = root.querySelectorAll(".sirk-nav button,.sirk-sidebar button,[role=\"navigation\"] button");
        for (var index = 0; index < candidates.length; index++) {
            var value = String(candidates[index].textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
            if (value === "zarządzanie" || value === "management") return candidates[index];
        }
        return null;
    }

    function ensureManagementNavigation(root) {
        var button = findManagementNavigation(root);
        if (button) {
            button.setAttribute("data-sirk-view", "management");
            button.setAttribute("data-sirk-platform-management-nav", "1");
            buttonLabel(button, "Zarządzanie");
            return button;
        }
        var automation = root.querySelector('[data-sirk-view="automation"]');
        var nav = automation && automation.parentNode || root.querySelector(".sirk-nav");
        if (!nav) return null;
        button = document.createElement("button");
        button.type = "button";
        button.setAttribute("data-sirk-view", "management");
        button.setAttribute("data-sirk-platform-management-nav", "1");
        button.innerHTML = '<span class="sirk-menu-icon" aria-hidden="true">' + managementIcon() + '</span><span class="sirk-menu-label">Zarządzanie</span>';
        if (automation && automation.nextSibling) nav.insertBefore(button, automation.nextSibling);
        else nav.appendChild(button);
        return button;
    }

    function hideLegacyManagementSubmenu(button) {
        if (!button) return;
        var parent = button.parentElement;
        var next = button.nextElementSibling;
        if (next && /defender|jira|entra|zabbix|inne/i.test(String(next.textContent || ""))) {
            next.hidden = true;
            next.setAttribute("aria-hidden", "true");
            next.setAttribute("data-sirk-platform-hidden-management-submenu", "1");
        }
        if (!parent) return;
        var candidates = parent.querySelectorAll('[data-sirk-parent="management"],[data-parent-view="management"],.sirk-submenu,.sirk-nav-submenu');
        Array.prototype.forEach.call(candidates, function (item) {
            if (item.contains(button)) return;
            if (/defender|jira|entra|zabbix|inne/i.test(String(item.textContent || ""))) {
                item.hidden = true;
                item.setAttribute("aria-hidden", "true");
                item.setAttribute("data-sirk-platform-hidden-management-submenu", "1");
            }
        });
    }

    function normalizeNavigation(root) {
        var management = ensureManagementNavigation(root);
        hideLegacyManagementSubmenu(management);
        var labels = {
            overview: "Przegląd",
            devices: "Urządzenia",
            approvals: "Akceptacje",
            automation: "Automatyzacja",
            management: "Zarządzanie",
            monitoring: "Monitoring",
            administration: "Ustawienia"
        };
        Object.keys(labels).forEach(function (view) {
            var buttons = root.querySelectorAll('[data-sirk-view="' + view + '"]');
            if (!buttons.length) return;
            var keep = view === "management" && management ? management : buttons[0];
            buttonLabel(keep, labels[view]);
            for (var index = 0; index < buttons.length; index++) {
                if (buttons[index] !== keep) {
                    buttons[index].hidden = true;
                    buttons[index].setAttribute("aria-hidden", "true");
                }
            }
            if (view === "administration" && !siteAdmin()) keep.hidden = true;
        });
    }

    function managementHost(root) {
        var host = root.querySelector('[data-view="management"]');
        if (!host) {
            var main = root.querySelector(".sirk-main,.sirk-content,.sirk-portal-main");
            if (!main) return null;
            host = document.createElement("section");
            host.className = "sirk-view";
            host.hidden = true;
            host.setAttribute("data-view", "management");
            main.appendChild(host);
        }
        host.classList.add("sirk-platform-management-host");
        return host;
    }

    function mountManagement(root, force) {
        var host = managementHost(root);
        if (!host) return;
        if (!moduleEnabled("myscripts")) {
            moduleError(host, "Zarządzanie", "MyScripts jest wyłączony albo użytkownik nie ma dostępu.");
            return;
        }
        if (!window.SirkPlatformPortalManagement || typeof window.SirkPlatformPortalManagement.mount !== "function") {
            moduleError(host, "Zarządzanie", "Renderer Zarządzania nie został załadowany.");
            return;
        }
        if (!force && host.getAttribute("data-sirk-platform-native-management") === "1" && host.querySelector(".sirk-management-shell")) return;
        host.setAttribute("data-sirk-platform-native-management", "1");
        window.SirkPlatformPortalManagement.mount(host);
    }

    function setActiveNavigation(root, view) {
        var buttons = root.querySelectorAll("[data-sirk-view]");
        Array.prototype.forEach.call(buttons, function (button) {
            var active = button.getAttribute("data-sirk-view") === view;
            button.classList.toggle("is-active", active);
            button.setAttribute("aria-current", active ? "page" : "false");
        });
    }

    function showOnlyView(root, view) {
        var host = view === "management" ? managementHost(root) : root.querySelector('[data-view="' + view + '"]');
        var views = root.querySelectorAll("[data-view]");
        Array.prototype.forEach.call(views, function (item) {
            var visible = item === host;
            item.hidden = !visible;
            item.style.display = visible ? "" : "none";
            item.classList.toggle("is-active", visible);
        });
        if (host) {
            host.hidden = false;
            host.style.display = "";
        }
        setActiveNavigation(root, view);
        return host;
    }

    function activateManagement(root) {
        forcedView = "management";
        normalizeNavigation(root);
        showOnlyView(root, "management");
        mountManagement(root, false);
    }

    function readSidebarCollapsed() {
        try { return window.localStorage.getItem(sidebarStorageKey) === "1"; }
        catch (error) { return false; }
    }

    function saveSidebarCollapsed(value) {
        try { window.localStorage.setItem(sidebarStorageKey, value ? "1" : "0"); }
        catch (error) {}
    }

    function applySidebarCollapsed(root, collapsed) {
        var sidebar = root.querySelector(".sirk-sidebar,.sirk-nav,.sirk-portal-sidebar");
        root.classList.toggle("sirk-platform-sidebar-collapsed", collapsed);
        root.classList.toggle("is-sidebar-collapsed", collapsed);
        root.setAttribute("data-sidebar-collapsed", collapsed ? "1" : "0");
        if (sidebar) {
            sidebar.classList.toggle("is-collapsed", collapsed);
            sidebar.classList.toggle("sirk-sidebar-collapsed", collapsed);
            sidebar.setAttribute("data-collapsed", collapsed ? "1" : "0");
        }
        saveSidebarCollapsed(collapsed);
    }

    function findSidebarToggle(root) {
        return root.querySelector([
            '[data-sirk-action="collapse"]',
            '[data-action="collapse"]',
            '[data-sidebar-toggle]',
            '.sirk-sidebar-toggle',
            '.sirk-collapse-toggle',
            'button[title*="Collapse" i]',
            'button[aria-label*="Collapse" i]',
            'button[title*="Zwiń" i]',
            'button[aria-label*="Zwiń" i]'
        ].join(","));
    }

    function bindSidebarToggle(root) {
        if (root.__sirkPlatformSidebarToggleBound) return;
        root.__sirkPlatformSidebarToggleBound = true;
        applySidebarCollapsed(root, readSidebarCollapsed());
        root.addEventListener("click", function (event) {
            var toggle = event.target.closest([
                '[data-sirk-action="collapse"]',
                '[data-action="collapse"]',
                '[data-sidebar-toggle]',
                '.sirk-sidebar-toggle',
                '.sirk-collapse-toggle',
                'button[title*="Collapse" i]',
                'button[aria-label*="Collapse" i]',
                'button[title*="Zwiń" i]',
                'button[aria-label*="Zwiń" i]'
            ].join(","));
            if (!toggle || !root.contains(toggle)) return;
            window.setTimeout(function () {
                var collapsed = !root.classList.contains("sirk-platform-sidebar-collapsed");
                applySidebarCollapsed(root, collapsed);
            }, 0);
        }, true);
        var toggle = findSidebarToggle(root);
        if (toggle) toggle.setAttribute("data-sirk-platform-sidebar-toggle", "1");
    }

    function mountView(view) {
        var root = document.getElementById("sirkPortalRoot");
        if (!root) return;
        if (view === "management") activateManagement(root);
        else {
            forcedView = "";
            if (view === "approvals") mountModule("approvalcenter", root.querySelector('[data-view="approvals"]'), "Akceptacje");
            else if (view === "administration") mountSettings(root.querySelector('[data-view="administration"]'));
        }
    }

    function selectedView(root) {
        if (forcedView) return forcedView;
        var selected = root.querySelector("[data-sirk-view].is-active");
        return selected && selected.getAttribute("data-sirk-view") || "";
    }

    function adaptPortal() {
        var root = document.getElementById("sirkPortalRoot");
        if (!root) return false;
        loadStyle();
        root.setAttribute("data-sirk-platform-portal", "1");
        root.setAttribute("data-sirk-vendor-version", vendorVersion);
        normalizeNavigation(root);
        bindSidebarToggle(root);

        if (!root.__sirkPlatformPortalAdapterBound) {
            root.__sirkPlatformPortalAdapterBound = true;
            root.addEventListener("click", function (event) {
                var button = event.target.closest('[data-sirk-platform-management-nav="1"],[data-sirk-view="management"]');
                if (!button || !root.contains(button)) return;
                event.preventDefault();
                event.stopPropagation();
                if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
                activateManagement(root);
            }, true);
            root.addEventListener("click", function (event) {
                var button = event.target.closest("[data-sirk-view]");
                if (!button || button.getAttribute("data-sirk-view") === "management") return;
                forcedView = "";
                var view = button.getAttribute("data-sirk-view");
                window.setTimeout(function () {
                    normalizeNavigation(root);
                    mountView(view);
                }, 0);
            });
            var pending = 0;
            new MutationObserver(function () {
                window.clearTimeout(pending);
                pending = window.setTimeout(function () {
                    normalizeNavigation(root);
                    applySidebarCollapsed(root, readSidebarCollapsed());
                    if (forcedView === "management") {
                        showOnlyView(root, "management");
                        mountManagement(root, false);
                        return;
                    }
                    var view = selectedView(root);
                    if (view) mountView(view);
                }, 50);
            }).observe(root, { childList: true, subtree: true });
        }
        var active = selectedView(root);
        if (active) mountView(active);
        return true;
    }

    function waitForPortal() {
        return new Promise(function (resolve, reject) {
            var attempts = 0;
            var timer = window.setInterval(function () {
                attempts++;
                if (adaptPortal()) {
                    window.clearInterval(timer);
                    resolve();
                } else if (attempts > 100) {
                    window.clearInterval(timer);
                    reject(new Error("SirK Portal 0.3.17 root was not created."));
                }
            }, 100);
        });
    }

    function normalizeView(view) {
        var map = { settings: "administration" };
        return map[view] || view || "overview";
    }

    function initialize(state) {
        bootstrapState = state || {};
        if (window.top !== window.self) return Promise.resolve();
        return loadVendor().then(waitForPortal).then(function () {
            if (window.SirKPortal && typeof window.SirKPortal.open === "function") {
                var preferred = normalizeView(bootstrapState.config && bootstrapState.config.defaultView || "overview");
                window.SirKPortal.open(preferred);
                window.setTimeout(function () {
                    adaptPortal();
                    mountView(preferred);
                }, 0);
            }
        });
    }

    window.SirkPlatformModules.portal = {
        initialize: initialize,
        open: function (view) {
            var target = normalizeView(view);
            if (window.SirKPortal && typeof window.SirKPortal.open === "function") {
                window.SirKPortal.open(target);
                window.setTimeout(function () { adaptPortal(); mountView(target); }, 0);
            }
        },
        openMesh: function () {
            if (window.SirKPortal && typeof window.SirKPortal.openMesh === "function") window.SirKPortal.openMesh();
        },
        onNativePageStart: function () {},
        onNativePageEnd: function () {},
        onDeviceRefreshEnd: function () {
            if (window.SirKPortal && typeof window.SirKPortal.refreshDevices === "function") window.SirKPortal.refreshDevices();
        }
    };
}());
