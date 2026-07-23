(function () {
    "use strict";

    if (window.__myCompanyStandaloneNavigationLoaded) return;
    window.__myCompanyStandaloneNavigationLoaded = true;

    var DEVICE_TABS_STORAGE = "mycompany.sirkportal.deviceTabs";
    var CHILD_PARAM = "sirkWorkspaceChild";

    function readSavedDeviceTabs() {
        try {
            var value = JSON.parse(localStorage.getItem(DEVICE_TABS_STORAGE) || "{}");
            return value && typeof value === "object" ? value : {};
        } catch (error) {
            return {};
        }
    }

    function workspaceChild() {
        try { return new URL(window.location.href).searchParams.get(CHILD_PARAM) === "1"; }
        catch (error) { return false; }
    }

    function installRestoreGuard() {
        var child = workspaceChild();
        var saved = readSavedDeviceTabs();
        var savedActive = String(saved.active || "all");
        var devicesRequested = window.location.hash === "#devices";
        var restoreHost = !child && devicesRequested && savedActive !== "all";

        if (child && window.location.hash !== "#devices") {
            try {
                var url = new URL(window.location.href);
                url.hash = "devices";
                history.replaceState(history.state, "", url.href);
            } catch (error) {
                window.location.hash = "devices";
            }
        }

        if (!child && !restoreHost) return;

        var content = document.getElementById("sirkStandaloneContent");
        if (!content) return;

        document.documentElement.classList.add("sirk-device-restore-pending");
        content.style.visibility = "hidden";
        content.style.pointerEvents = "none";
        content.setAttribute("aria-busy", "true");

        var finished = false;
        var observer = null;
        var timer = null;

        function finish() {
            if (finished) return;
            finished = true;
            if (observer) observer.disconnect();
            if (timer) window.clearTimeout(timer);
            document.documentElement.classList.remove("sirk-device-restore-pending");
            content.style.visibility = "";
            content.style.pointerEvents = "";
            content.removeAttribute("aria-busy");
            window.dispatchEvent(new Event("resize"));
        }

        function ready() {
            if (finished) return;

            var currentView = String(content.getAttribute("data-active-view") || "");
            if (currentView && currentView !== "devices") {
                finish();
                return;
            }

            if (child) {
                if (content.querySelector(".sirk-device-workspace,.sirk-device-compact-header,[data-device-workspace-ready='1']")) finish();
                return;
            }

            var activeTab = document.querySelector(".sirk-device-tabs-standalone .sirk-device-tab.is-active[data-device-workspace-key]");
            var activeKey = activeTab && String(activeTab.getAttribute("data-device-workspace-key") || "");
            if (activeKey && activeKey !== "all" && content.querySelector(".sirk-device-isolated-workspace iframe")) finish();
        }

        observer = new MutationObserver(ready);
        observer.observe(document.documentElement, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ["class", "hidden", "data-active-view", "data-device-workspace-key"]
        });
        timer = window.setTimeout(finish, 15000);
        ready();
    }

    function installLayoutStyle() {
        if (document.getElementById("mycompany-workspace-layout-fix")) return;
        var style = document.createElement("style");
        style.id = "mycompany-workspace-layout-fix";
        style.textContent =
            ".sirk-device-workspace{grid-template-rows:auto minmax(0,1fr)!important}" +
            ".sirk-device-compact-header{align-items:stretch!important;gap:12px!important;min-height:58px!important}" +
            ".sirk-device-compact-tabs{display:flex;align-items:center;gap:3px;min-width:0;flex:1 1 auto;overflow-x:auto;scrollbar-width:thin}" +
            ".sirk-device-compact-tabs button{appearance:none;-webkit-appearance:none;flex:0 0 auto;min-height:32px;padding:5px 12px;border:1px solid transparent;border-radius:7px;background:transparent;color:var(--sirk-muted,#657187);font:600 13px/1.2 Segoe UI,Arial,sans-serif;white-space:nowrap;cursor:pointer}" +
            ".sirk-device-compact-tabs button:hover,.sirk-device-compact-tabs button:focus-visible{background:var(--sirk-hover,#f7faff);color:var(--sirk-text,#172033);outline:none}" +
            ".sirk-device-compact-tabs button.is-active{border-color:rgba(59,130,246,.2);background:rgba(59,130,246,.12);color:#2563eb}" +
            ".sirk-device-compact-meta{align-self:center!important;margin-left:auto!important}" +
            ".sirk-device-workspace>.sirk-device-tabs{display:none!important}" +
            ".sirk-portal-view-management.mycompany-management-host,.sirk-portal-view-management.sirk-native-management{border:0!important;padding:0!important;background:transparent!important;box-shadow:none!important}";
        (document.head || document.documentElement).appendChild(style);
    }

    function normalizeDeviceWorkspace() {
        var workspace = document.querySelector("#sirkStandaloneContent .sirk-device-workspace");
        if (!workspace) return;
        var header = workspace.querySelector(":scope > .sirk-device-compact-header");
        var tabs = workspace.querySelector(":scope > .sirk-device-tabs");
        if (!header || !tabs || header.getAttribute("data-compact-tabs-mounted") === "1") return;

        var back = header.querySelector(".sirk-device-compact-back");
        var icon = header.querySelector(".sirk-device-compact-icon");
        var main = header.querySelector(".sirk-device-compact-main");
        if (back) back.remove();
        if (icon) icon.remove();
        if (main) main.remove();

        tabs.className = "sirk-device-compact-tabs";
        tabs.removeAttribute("role");
        header.insertBefore(tabs, header.firstChild);
        header.setAttribute("data-compact-tabs-mounted", "1");
    }

    function flattenManagementHost() {
        var hosts = document.querySelectorAll(".mycompany-management-host,.sirk-native-management");
        Array.prototype.forEach.call(hosts, function (host) {
            host.classList.remove("mycompany-management-host", "sirk-native-management");
            host.setAttribute("data-management-host-flattened", "1");
        });
    }

    function normalizeLayouts() {
        normalizeDeviceWorkspace();
        flattenManagementHost();
    }

    function observeLayouts() {
        var scheduled = false;
        function schedule() {
            if (scheduled) return;
            scheduled = true;
            window.setTimeout(function () {
                scheduled = false;
                normalizeLayouts();
            }, 0);
        }
        new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
        schedule();
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
                if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
                navigate(button.getAttribute("data-view"));
            }, true);
        });
        return true;
    }

    function loadTerminalConnect() {
        if (document.getElementById("mycompany-portal-terminal-connect")) return;
        var base = String(window.__MYCOMPANY_ASSET_BASE__ || "").replace(/\/$/, "");
        if (!base) return;
        var script = document.createElement("script");
        script.id = "mycompany-portal-terminal-connect";
        script.src = base + "/portal-terminal-connect.js?v=" + encodeURIComponent(String(window.__MYCOMPANY_PORTAL_VERSION__ || ""));
        script.async = false;
        (document.head || document.documentElement).appendChild(script);
    }

    installRestoreGuard();
    installLayoutStyle();
    observeLayouts();
    loadTerminalConnect();

    if (!bind()) {
        var attempts = 0;
        var timer = window.setInterval(function () {
            attempts++;
            if (bind() || attempts > 100) window.clearInterval(timer);
        }, 50);
    }
}());