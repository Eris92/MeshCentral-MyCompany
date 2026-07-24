(function () {
    "use strict";

    if (window.__sirkPlatformPortalUiContractLoaded) return;
    window.__sirkPlatformPortalUiContractLoaded = true;

    var root = document.getElementById("sirkPortalRoot");
    if (!root) return;

    function addClass(nodes, className) {
        Array.prototype.forEach.call(nodes || [], function (node) {
            if (node && node.classList) node.classList.add(className);
        });
    }

    function installViewStyle() {
        if (document.getElementById("sirk-platform-portal-view-contract-style")) return;
        var style = document.createElement("style");
        style.id = "sirk-platform-portal-view-contract-style";
        style.textContent = [
            "#sirkPortalRoot .mc-portal-view-surface{display:flex;flex-direction:column;width:100%;height:100%;min-width:0;min-height:0;margin:0;border:1px solid var(--mc-ui-border,var(--sirk-border,#dce3ec));border-radius:10px;background:var(--mc-ui-panel,var(--sirk-panel,#fff));color:var(--mc-ui-text,var(--sirk-text,#172033));overflow:hidden;box-sizing:border-box}",
            "#sirkPortalRoot .mc-portal-view-scroll{flex:1 1 auto;width:100%;min-width:0;min-height:0;padding:14px;overflow:auto;box-sizing:border-box}",
            "#sirkPortalRoot .mc-portal-view-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;width:100%;min-height:48px;margin:0 0 14px;padding:0}",
            "#sirkPortalRoot .mc-portal-card{border-color:var(--mc-ui-border,var(--sirk-border,#dce3ec))!important;border-radius:var(--mc-ui-radius,8px)!important;background:var(--mc-ui-panel,var(--sirk-panel,#fff))!important;color:var(--mc-ui-text,var(--sirk-text,#172033))!important;box-shadow:none!important}",
            "#sirkPortalRoot .mc-portal-button-secondary{appearance:none;display:inline-flex;align-items:center;justify-content:center;min-height:34px;margin:0;padding:7px 13px;border:1px solid var(--mc-ui-border,var(--sirk-border,#dce3ec));border-radius:7px;background:var(--mc-ui-panel,var(--sirk-panel,#fff));color:var(--mc-ui-text,var(--sirk-text,#172033));font:500 14px Segoe UI,Arial,sans-serif;text-decoration:none;box-shadow:none;cursor:pointer}",
            "#sirkPortalRoot .mc-portal-button-secondary:hover,#sirkPortalRoot .mc-portal-button-secondary:focus-visible{border-color:rgba(96,165,250,.35);background:var(--mc-ui-hover,rgba(96,165,250,.09));outline:0}",
            "#sirkPortalRoot .mc-portal-status{width:100%;padding:18px;border:1px dashed var(--mc-ui-border,var(--sirk-border,#dce3ec));border-radius:var(--mc-ui-radius,8px);background:var(--mc-ui-panel,var(--sirk-panel,#fff));color:var(--mc-ui-muted,var(--sirk-muted,#657187));box-sizing:border-box}",
            "#sirkPortalRoot .mc-portal-list{display:grid;width:100%;min-width:0;border-top:1px solid var(--mc-ui-border,var(--sirk-border,#dce3ec))}",
            "#sirkPortalRoot .mc-portal-list-row{border-bottom-color:var(--mc-ui-border,var(--sirk-row-border,#edf1f6))!important;background:var(--mc-ui-panel,var(--sirk-panel,#fff))!important;color:var(--mc-ui-text,var(--sirk-text,#172033))!important}",
            "#sirkPortalRoot .mc-portal-list-row:hover,#sirkPortalRoot .mc-portal-list-row:focus-visible{background:var(--mc-ui-hover,var(--sirk-hover,#f7faff))!important}",
            "#sirkPortalRoot .mc-portal-badge{display:inline-flex;align-items:center;gap:6px;min-height:34px;padding:7px 10px;border:1px solid var(--mc-ui-border,var(--sirk-border,#dce3ec));border-radius:7px;background:var(--mc-ui-panel,var(--sirk-panel,#fff));color:var(--mc-ui-muted,var(--sirk-muted,#657187));box-sizing:border-box}",
            "#sirkPortalRoot .sirk-device-content{--mc-ui-accent:var(--sirk-active-accent,#3867d6)}",
            "#sirkPortalRoot .sirk-device-content .sirk-device-group,#sirkPortalRoot .sirk-device-content .sirk-device-hero,#sirkPortalRoot .sirk-device-content .sirk-device-detail-item,#sirkPortalRoot .sirk-device-content .sirk-device-native-card{border-radius:var(--mc-ui-radius,8px);box-shadow:none}",
            "#sirkPortalRoot .sirk-device-content .sirk-device-input,#sirkPortalRoot .sirk-device-content .sirk-device-select{min-height:34px;border-radius:7px;background:var(--mc-ui-input,var(--sirk-input,#fff));color:var(--mc-ui-text,var(--sirk-text,#172033))}",
            "#sirkPortalRoot .sirk-device-content .sirk-device-native-button{border-color:transparent;background:var(--mc-ui-accent,#3867d6);color:#fff}",
            "#sirkPortalRoot .sirk-overview-link:hover,#sirkPortalRoot .sirk-overview-link:focus-visible{border-color:rgba(96,165,250,.45)!important;background:var(--mc-ui-hover,rgba(96,165,250,.09))!important;transform:none;box-shadow:none!important}",
            "@media(max-width:800px){#sirkPortalRoot .mc-portal-view-scroll{padding:10px}}"
        ].join("");
        (document.head || document.documentElement).appendChild(style);
    }

    function decorateNavigation(scope) {
        addClass(scope.querySelectorAll(
            ".mc-shared-nav-item,.sirk-management-item,.mc-approval-nav-item," +
            ".mc-admin-tabs>[data-tab],.mc-admin-section-nav [data-settings-key],.mc-admin-section-nav [data-debug-key]"
        ), "mc-portal-nav-item");
        addClass(scope.querySelectorAll(
            ".mc-tree-fallback-icon,.mc-tree-icon,.mc-tree-root img,.sirk-management-item-icon," +
            ".mc-approval-nav-icon,.mc-admin-management-item-icon"
        ), "mc-portal-nav-icon");
        addClass(scope.querySelectorAll(
            ".mc-tree-label,.sirk-script-label,.mc-approval-nav-label,.mc-admin-management-item-label"
        ), "mc-portal-nav-label");
    }

    function decorateTables(scope) {
        addClass(scope.querySelectorAll(".mc-results-table-wrap,.sirk-approval-table-wrap,.mc-admin-table-wrap"), "mc-portal-table-wrap");
        addClass(scope.querySelectorAll(".mc-results-table,.sirk-approval-table,.mc-admin-table"), "mc-portal-table");
        addClass(scope.querySelectorAll(".mc-results-filter,.sirk-approval-search,.mc-admin-management-search input"), "mc-portal-filter");
    }

    function decorateActions(scope) {
        addClass(scope.querySelectorAll(
            ".mc-results-view-button,.mc-results-copy-button,.sirk-primary-button," +
            ".mc-admin-primary,.mc-admin-secondary,.mc-script-run-card button," +
            ".mc-portal-module-details button.btn:not(.mc-shared-toolbar-button)"
        ), "mc-portal-button");
        addClass(scope.querySelectorAll(".mc-shared-card,.sirk-card,.mc-admin-card"), "mc-portal-card");
    }

    function decorateToolbar(scope) {
        addClass(scope.querySelectorAll(".mc-shared-toolbar,.sirk-management-toolbar,.mc-admin-management-toolbar"), "mc-portal-toolbar");
        addClass(scope.querySelectorAll(".mc-shared-toolbar-button,.sirk-management-tool,.mc-admin-management-tool"), "mc-portal-toolbar-button");
        addClass(scope.querySelectorAll(".mc-shared-toolbar-icon,.sirk-management-tool>svg,.mc-admin-management-tool>svg"), "mc-portal-toolbar-icon");
    }

    function decoratePortalViews(scope) {
        addClass(scope.querySelectorAll(".sirk-standalone-view-scroll"), "mc-portal-view-surface");
        addClass(scope.querySelectorAll(".sirk-standalone-view-scroll"), "mc-portal-view-scroll");
        addClass(scope.querySelectorAll(".sirk-device-toolbar"), "mc-portal-view-toolbar");
        addClass(scope.querySelectorAll(".sirk-standalone-card,.sirk-device-group,.sirk-device-hero,.sirk-device-detail-item,.sirk-device-native-card"), "mc-portal-card");
        addClass(scope.querySelectorAll(".sirk-device-input,.sirk-device-select"), "mc-portal-filter");
        addClass(scope.querySelectorAll(".sirk-device-native-button"), "mc-portal-button");
        addClass(scope.querySelectorAll(".sirk-device-refresh,.sirk-device-back"), "mc-portal-button-secondary");
        addClass(scope.querySelectorAll(".sirk-device-status"), "mc-portal-status");
        addClass(scope.querySelectorAll(".sirk-device-summary span"), "mc-portal-badge");
        addClass(scope.querySelectorAll(".sirk-device-list"), "mc-portal-list");
        addClass(scope.querySelectorAll(".sirk-device-row"), "mc-portal-list-row");
    }

    function decorateShell(shell) {
        if (!shell || !shell.classList) return;
        shell.classList.add("mc-portal-module-shell");
        var toolbar = shell.querySelector(":scope > .mc-portal-module-toolbar,:scope > .sirk-management-toolbar,:scope > .mc-admin-management-toolbar");
        if (toolbar) toolbar.classList.add("mc-portal-module-toolbar");
        var workspace = shell.querySelector(":scope > .mc-portal-module-workspace,:scope > .sirk-management-workspace,:scope > .mc-admin-management-layout");
        if (workspace) {
            workspace.classList.add("mc-portal-module-workspace", "mc-portal-module-layout");
            var columns = workspace.children || [];
            if (columns[0]) columns[0].classList.add("mc-portal-module-primary");
            if (columns[1]) columns[1].classList.add("mc-portal-module-secondary");
            if (columns[2]) columns[2].classList.add("mc-portal-module-details");
        }
        var managementHost = shell.closest(".sirk-platform-management-host");
        var editMode = !!(managementHost && managementHost.classList.contains("is-management-edit-mode") || shell.querySelector(".mc-tree-script-actions:not(:empty),.sirk-script-actions:not(:empty)"));
        var collapsed = !!(managementHost && managementHost.classList.contains("is-management-collapsed") || shell.classList.contains("is-collapsed") || workspace && workspace.classList.contains("is-collapsed"));
        shell.classList.toggle("is-edit-mode", editMode);
        if (workspace) {
            workspace.classList.toggle("is-edit-mode", editMode);
            workspace.classList.toggle("is-collapsed", collapsed);
        }
    }

    function decorate(scope) {
        scope = scope || root;
        addClass(scope.querySelectorAll(".mc-shared-page.mc-portal-module-shell,.sirk-management-shell,.mc-admin-management-shell"), "mc-portal-module-shell");
        Array.prototype.forEach.call(scope.querySelectorAll(".mc-portal-module-shell,.sirk-management-shell,.mc-admin-management-shell"), decorateShell);
        decorateToolbar(scope);
        decorateNavigation(scope);
        decorateTables(scope);
        decorateActions(scope);
        decoratePortalViews(scope);
    }

    function ensureFrameStyle(doc) {
        if (!doc || !doc.head || doc.getElementById("sirk-platform-portal-ui-contract-style")) return;
        var source = document.getElementById("sirk-platform-portal-ui-contract-style");
        if (!source || !source.href) return;
        var link = doc.createElement("link");
        link.id = "sirk-platform-portal-ui-contract-style";
        link.rel = "stylesheet";
        link.href = source.href;
        doc.head.appendChild(link);
    }

    function syncFrameEnvironment(doc, adminRoot) {
        var dark = root.classList.contains("sirk-theme-dark");
        adminRoot.classList.toggle("sirk-theme-dark", dark);
        adminRoot.classList.toggle("sirk-theme-light", !dark);
        doc.documentElement.classList.toggle("sirk-theme-dark", dark);
        doc.documentElement.classList.toggle("sirk-theme-light", !dark);
        doc.documentElement.style.colorScheme = dark ? "dark" : "light";
        var source = window.getComputedStyle(root);
        ["--sirk-panel", "--sirk-input", "--sirk-text", "--sirk-muted", "--sirk-border", "--sirk-active-accent"].forEach(function (name) {
            var value = source.getPropertyValue(name);
            if (value) adminRoot.style.setProperty(name, value.trim());
        });
    }

    function decorateSettingsFrame(frame) {
        if (!frame) return;
        function apply() {
            try {
                var doc = frame.contentDocument;
                var admin = doc && doc.getElementById("sirk-platform-admin");
                if (!admin || !doc.body) return;
                var adminRoot = doc.getElementById("sirkPortalRoot") || doc.body;
                if (!adminRoot.id) adminRoot.id = "sirkPortalRoot";
                admin.classList.add("mc-admin-portal-embedded");
                doc.documentElement.classList.add("mc-portal-admin-document");
                ensureFrameStyle(doc);
                syncFrameEnvironment(doc, adminRoot);
                decorate(adminRoot);
                if (!frame.__sirkPlatformPortalUiObserver) {
                    frame.__sirkPlatformPortalUiObserver = new MutationObserver(function () { decorate(adminRoot); });
                    frame.__sirkPlatformPortalUiObserver.observe(adminRoot, { childList: true, subtree: true });
                }
            } catch (error) {}
        }
        if (frame.getAttribute("data-portal-ui-contract") !== "1") {
            frame.setAttribute("data-portal-ui-contract", "1");
            frame.addEventListener("load", function () {
                frame.__sirkPlatformPortalUiObserver = null;
                window.setTimeout(apply, 0);
                window.setTimeout(apply, 250);
            });
        }
        apply();
    }

    var scheduled = false;
    function schedule() {
        if (scheduled) return;
        scheduled = true;
        window.requestAnimationFrame(function () {
            scheduled = false;
            decorate(root);
            Array.prototype.forEach.call(root.querySelectorAll(".sirk-standalone-settings-frame"), decorateSettingsFrame);
        });
    }

    installViewStyle();
    var observer = new MutationObserver(schedule);
    observer.observe(root, { childList: true, subtree: true });
    root.addEventListener("click", function () { window.setTimeout(schedule, 0); }, true);
    window.addEventListener("sirkportal:languagechange", schedule);

    window.SirkPlatformPortalUiContract = { decorate: decorate, refresh: schedule };
    schedule();
}());
