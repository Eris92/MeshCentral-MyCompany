(function () {
    "use strict";

    if (window.__myCompanyStandaloneNavigationLoaded) return;
    window.__myCompanyStandaloneNavigationLoaded = true;

    function asset(name) {
        var base = String(window.__MYCOMPANY_ASSET_BASE__ || "").replace(/\/$/, "");
        var version = encodeURIComponent(String(window.__MYCOMPANY_PORTAL_VERSION__ || ""));
        return base ? base + "/" + name + "?v=" + version : "";
    }

    function loadStyle(id, name) {
        var source = asset(name);
        if (!source || document.getElementById(id)) return;
        var link = document.createElement("link");
        link.id = id;
        link.rel = "stylesheet";
        link.href = source;
        (document.head || document.documentElement).appendChild(link);
    }

    function loadScript(id, name) {
        var source = asset(name);
        if (!source || document.getElementById(id)) return;
        var script = document.createElement("script");
        script.id = id;
        script.src = source;
        script.async = false;
        (document.head || document.documentElement).appendChild(script);
    }

    function loadUiContract() {
        loadStyle("mycompany-portal-ui-contract-style", "vendor/sirk-portal/portal-ui-contract.css");
        loadStyle("mycompany-portal-cleanup-style", "portal-cleanup.css");
        loadScript("mycompany-portal-ui-contract-script", "vendor/sirk-portal/portal-ui-contract.js");
        loadScript("mycompany-portal-cleanup-script", "portal-cleanup.js");
    }

    function normalizeDeviceWorkspace() {
        var content = document.getElementById("sirkStandaloneContent");
        var workspace = content && content.querySelector(":scope > .sirk-device-workspace");
        if (!workspace) return;

        var header = workspace.querySelector(":scope > .sirk-device-compact-header");
        var tabs = workspace.querySelector(":scope > .sirk-device-tabs,:scope > .sirk-device-compact-tabs");
        if (!header || !tabs) return;

        [".sirk-device-compact-back", ".sirk-device-compact-icon", ".sirk-device-compact-main"].forEach(function (selector) {
            var element = header.querySelector(selector);
            if (element) element.remove();
        });

        tabs.className = "sirk-device-compact-tabs";
        tabs.removeAttribute("role");
        if (tabs.parentNode !== header) header.insertBefore(tabs, header.firstChild);
        header.setAttribute("data-compact-tabs-mounted", "1");
    }

    function observeDeviceWorkspace() {
        var content = document.getElementById("sirkStandaloneContent");
        if (!content) return;
        var scheduled = false;
        var observer = new MutationObserver(function () {
            if (scheduled) return;
            scheduled = true;
            window.requestAnimationFrame(function () {
                scheduled = false;
                normalizeDeviceWorkspace();
            });
        });
        observer.observe(content, { childList: true, subtree: true });
        normalizeDeviceWorkspace();
    }

    function navigate(view) {
        view = String(view || "overview");
        var next = "#" + view;
        if (window.location.hash === next) {
            window.dispatchEvent(new HashChangeEvent("hashchange"));
        } else {
            window.location.hash = next;
        }
    }

    function bind() {
        var root = document.getElementById("sirkStandaloneRoot");
        if (!root) return false;
        var buttons = root.querySelectorAll(".sirk-standalone-nav [data-view]");
        Array.prototype.forEach.call(buttons, function (button) {
            if (button.getAttribute("data-standalone-nav-bound") === "1") return;
            button.setAttribute("data-standalone-nav-bound", "1");
            button.addEventListener("click", function (event) {
                event.preventDefault();
                event.stopPropagation();
                navigate(button.getAttribute("data-view"));
            });
        });
        return true;
    }

    function loadTerminalConnect() {
        loadScript("mycompany-portal-terminal-connect", "portal-terminal-connect.js");
    }

    loadUiContract();
    observeDeviceWorkspace();
    loadTerminalConnect();

    if (!bind()) {
        var attempts = 0;
        var timer = window.setInterval(function () {
            attempts += 1;
            if (bind() || attempts > 100) window.clearInterval(timer);
        }, 50);
    }
}());
