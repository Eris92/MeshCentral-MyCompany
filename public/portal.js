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

    function mountModule(key, host, title) {
        if (!host) return;
        if (!moduleEnabled(key)) {
            host.innerHTML = '<div class="sirk-card"><h3>' + title + '</h3><p>Moduł jest wyłączony albo użytkownik nie ma dostępu.</p></div>';
            return;
        }
        var module = window.MyCompanyModules && window.MyCompanyModules[key];
        if (!module || typeof module.mount !== "function") {
            host.innerHTML = '<div class="sirk-card"><h3>' + title + '</h3><p>Moduł nie udostępnia punktu montowania.</p></div>';
            return;
        }
        if (host.getAttribute("data-mycompany-mounted") === key) return;
        host.setAttribute("data-mycompany-mounted", key);
        module.mount(host, "sirk-portal-" + key);
    }

    function mountSettings(host) {
        if (!host) return;
        if (!siteAdmin()) {
            host.innerHTML = '<div class="sirk-card"><h3>Ustawienia</h3><p>Panel administracyjny jest dostępny tylko dla Site Admin.</p></div>';
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

    function renameNavigation(root) {
        var labels = {
            overview: "Przegląd",
            devices: "Urządzenia",
            approvals: "Akceptacje",
            automation: "Zarządzanie",
            monitoring: "Monitoring",
            mesh: "Mesh",
            administration: "Ustawienia"
        };
        Object.keys(labels).forEach(function (view) {
            var button = root.querySelector('[data-sirk-view="' + view + '"]');
            if (!button) return;
            var span = button.querySelector("span");
            if (span) span.textContent = labels[view];
            else button.textContent = labels[view];
            if (view === "administration" && !siteAdmin()) button.hidden = true;
        });
    }

    function mountView(view) {
        var root = document.getElementById("sirkPortalRoot");
        if (!root) return;
        if (view === "automation") {
            mountModule("myscripts", root.querySelector('[data-view="automation"]'), "Zarządzanie");
        } else if (view === "approvals") {
            mountModule("approvalcenter", root.querySelector('[data-view="approvals"]'), "Akceptacje");
        } else if (view === "administration") {
            mountSettings(root.querySelector('[data-view="administration"]'));
        }
    }

    function adaptPortal() {
        var root = document.getElementById("sirkPortalRoot");
        if (!root) return false;
        root.setAttribute("data-mycompany-portal", "1");
        root.setAttribute("data-sirk-vendor-version", vendorVersion);
        renameNavigation(root);

        if (!root.__myCompanyPortalAdapterBound) {
            root.__myCompanyPortalAdapterBound = true;
            root.addEventListener("click", function (event) {
                var button = event.target.closest("[data-sirk-view]");
                if (!button) return;
                var view = button.getAttribute("data-sirk-view");
                window.setTimeout(function () { mountView(view); }, 0);
            });
        }

        var selected = root.querySelector("[data-sirk-view].is-active");
        if (selected) mountView(selected.getAttribute("data-sirk-view"));
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

    function initialize(state) {
        bootstrapState = state || {};
        if (window.top !== window.self) return Promise.resolve();
        return loadVendor().then(waitForPortal).then(function () {
            if (window.SirKPortal && typeof window.SirKPortal.open === "function") {
                var preferred = bootstrapState.config && bootstrapState.config.defaultView || "overview";
                var map = { management: "automation", settings: "administration" };
                window.SirKPortal.open(map[preferred] || preferred);
                window.setTimeout(function () { mountView(map[preferred] || preferred); }, 0);
            }
        });
    }

    window.MyCompanyModules.portal = {
        initialize: initialize,
        open: function (view) {
            var map = { management: "automation", settings: "administration" };
            if (window.SirKPortal && typeof window.SirKPortal.open === "function") {
                window.SirKPortal.open(map[view] || view || "overview");
                window.setTimeout(function () { mountView(map[view] || view || "overview"); }, 0);
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
