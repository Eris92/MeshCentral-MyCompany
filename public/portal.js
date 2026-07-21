(function () {
    "use strict";

    if (window.__myCompanyPortalModuleLoaded) return;
    window.__myCompanyPortalModuleLoaded = true;

    var core = window.MyCompanyCore;
    var bootstrapState = null;
    var vendorVersion = "0.3.17";
    var vendorScripts = [
        "sirk-preflight-0.3.13.js",
        "sirk-portal.js",
        "sirk-remote-modules-0.3.13.js",
        "sirk-portal-patch-0.2.8.js",
        "sirk-ui-icons-0.3.4.js",
        "sirk-layout-0.3.1.js",
        "sirk-management-workspace-0.3.6.js",
        "sirk-ui-runtime-0.3.15.js",
        "sirk-device-layout-0.3.13.js",
        "sirk-controls-0.3.17.js"
    ];

    function vendorAsset(name) {
        return core.assetUrl("", "vendor/sirk-portal/" + name);
    }

    function loadStyle() {
        if (document.getElementById("mycompany-sirk-portal-vendor-style")) return;
        var link = document.createElement("link");
        link.id = "mycompany-sirk-portal-vendor-style";
        link.rel = "stylesheet";
        link.href = vendorAsset("sirk-portal.css");
        (document.head || document.documentElement).appendChild(link);
    }

    function loadVendor() {
        loadStyle();
        var chain = Promise.resolve();
        vendorScripts.forEach(function (name) {
            chain = chain.then(function () {
                return core.loadScript("mycompany-sirk-vendor-" + name.replace(/[^a-z0-9]/gi, "-"), vendorAsset(name));
            });
        });
        return chain;
    }

    function moduleEnabled(key) {
        var state = window.MyCompanyRuntime && window.MyCompanyRuntime.state && window.MyCompanyRuntime.state.bootstrap;
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
        host.classList.add("mycompany-portal-module-host", "mycompany-portal-module-" + key);
        if (!moduleEnabled(key)) {
            moduleError(host, title, "Moduł jest wyłączony albo użytkownik nie ma dostępu.");
            return;
        }
        var module = window.MyCompanyModules && window.MyCompanyModules[key];
        if (!module || typeof module.mount !== "function") {
            moduleError(host, title, "Moduł nie udostępnia punktu montowania.");
            return;
        }
        if (host.getAttribute("data-mycompany-mounted") === key && host.querySelector(".mc-shared-page")) return;
        host.innerHTML = "";
        host.setAttribute("data-mycompany-mounted", key);
        module.mount(host, "sirk-portal-" + key);
        var page = host.querySelector(".mc-shared-page");
        if (page) {
            page.classList.add("sirk-mycompany-module", "sirk-mycompany-module-" + key);
            page.setAttribute("data-sirk-module", key);
        }
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
        frame.title = "MyCompany settings";
        var url = new URL("pluginadmin.ashx", window.location.href);
        url.searchParams.set("pin", "MyCompany");
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
            return;
        }
        var icon = button.querySelector("svg,.sirk-nav-icon,.sirk-menu-icon");
        button.textContent = "";
        if (icon) button.appendChild(icon);
        var created = document.createElement("span");
        created.className = "sirk-menu-label";
        created.textContent = text;
        button.appendChild(created);
    }

    function firstButton(root, view) {
        var buttons = root.querySelectorAll('[data-sirk-view="' + view + '"]');
        return buttons.length ? buttons[0] : null;
    }

    function hideDuplicateButtons(root, view, keep) {
        root.querySelectorAll('[data-sirk-view="' + view + '"]').forEach(function (button) {
            if (button !== keep) button.hidden = true;
        });
    }

    function normalizeNavigation(root) {
        var labels = {
            overview: "Przegląd",
            devices: "Urządzenia",
            approvals: "Akceptacje",
            management: "Zarządzanie",
            monitoring: "Monitoring",
            mesh: "Mesh",
            administration: "Ustawienia"
        };

        Object.keys(labels).forEach(function (view) {
            var button = firstButton(root, view);
            if (!button) return;
            buttonLabel(button, labels[view]);
            hideDuplicateButtons(root, view, button);
            if (view === "administration" && !siteAdmin()) button.hidden = true;
        });

        root.querySelectorAll('[data-sirk-view="automation"]').forEach(function (button) {
            button.hidden = true;
            button.setAttribute("aria-hidden", "true");
        });
    }

    function managementHost(root) {
        var host = root.querySelector('[data-view="management"]');
        if (!host) {
            var main = root.querySelector(".sirk-main");
            if (!main) return null;
            host = document.createElement("section");
            host.className = "sirk-view";
            host.setAttribute("data-view", "management");
            main.appendChild(host);
        }
        host.classList.add("mycompany-management-host");
        host.setAttribute("data-sirk-management-version", "mycompany");
        return host;
    }

    function mountView(view) {
        var root = document.getElementById("sirkPortalRoot");
        if (!root) return;
        if (view === "management" || view === "automation") {
            mountModule("myscripts", managementHost(root), "Zarządzanie");
        } else if (view === "approvals") {
            mountModule("approvalcenter", root.querySelector('[data-view="approvals"]'), "Akceptacje");
        } else if (view === "administration") {
            mountSettings(root.querySelector('[data-view="administration"]'));
        }
    }

    function selectedView(root) {
        var selected = root.querySelector("[data-sirk-view].is-active");
        return selected && selected.getAttribute("data-sirk-view") || "";
    }

    function adaptPortal() {
        var root = document.getElementById("sirkPortalRoot");
        if (!root) return false;
        root.setAttribute("data-mycompany-portal", "1");
        root.setAttribute("data-sirk-vendor-version", vendorVersion);
        normalizeNavigation(root);

        if (!root.__myCompanyPortalAdapterBound) {
            root.__myCompanyPortalAdapterBound = true;
            root.addEventListener("click", function (event) {
                var button = event.target.closest("[data-sirk-view]");
                if (!button) return;
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
                    var view = selectedView(root);
                    if (view) mountView(view);
                }, 40);
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
        var map = { automation: "management", settings: "administration" };
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

    window.MyCompanyModules.portal = {
        initialize: initialize,
        open: function (view) {
            var target = normalizeView(view);
            if (window.SirKPortal && typeof window.SirKPortal.open === "function") {
                window.SirKPortal.open(target);
                window.setTimeout(function () {
                    adaptPortal();
                    mountView(target);
                }, 0);
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
