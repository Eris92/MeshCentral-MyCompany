(function () {
    "use strict";

    if (window.__myCompanyPortalUiContractLoaded) return;
    window.__myCompanyPortalUiContractLoaded = true;

    var root = document.getElementById("sirkPortalRoot");
    if (!root) return;

    function addClass(nodes, className) {
        Array.prototype.forEach.call(nodes || [], function (node) {
            if (node && node.classList) node.classList.add(className);
        });
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
        addClass(scope.querySelectorAll(
            ".mc-results-table-wrap,.sirk-approval-table-wrap,.mc-admin-table-wrap"
        ), "mc-portal-table-wrap");
        addClass(scope.querySelectorAll(
            ".mc-results-table,.sirk-approval-table,.mc-admin-table"
        ), "mc-portal-table");
        addClass(scope.querySelectorAll(
            ".mc-results-filter,.sirk-approval-search,.mc-admin-management-search input"
        ), "mc-portal-filter");
    }

    function decorateActions(scope) {
        addClass(scope.querySelectorAll(
            ".mc-results-view-button,.mc-results-copy-button,.sirk-primary-button," +
            ".mc-admin-primary,.mc-admin-secondary,.mc-script-run-card button," +
            ".mc-portal-module-details button.btn:not(.mc-shared-toolbar-button)"
        ), "mc-portal-button");
        addClass(scope.querySelectorAll(
            ".mc-shared-card,.sirk-card,.mc-admin-card"
        ), "mc-portal-card");
    }

    function decorateToolbar(scope) {
        addClass(scope.querySelectorAll(
            ".mc-shared-toolbar,.sirk-management-toolbar,.mc-admin-management-toolbar"
        ), "mc-portal-toolbar");
        addClass(scope.querySelectorAll(
            ".mc-shared-toolbar-button,.sirk-management-tool,.mc-admin-management-tool"
        ), "mc-portal-toolbar-button");
        addClass(scope.querySelectorAll(
            ".mc-shared-toolbar-icon,.sirk-management-tool>svg,.mc-admin-management-tool>svg"
        ), "mc-portal-toolbar-icon");
    }

    function decorateShell(shell) {
        if (!shell || !shell.classList) return;
        shell.classList.add("mc-portal-module-shell");

        var toolbar = shell.querySelector(":scope > .mc-portal-module-toolbar,:scope > .sirk-management-toolbar,:scope > .mc-admin-management-toolbar");
        if (toolbar) toolbar.classList.add("mc-portal-module-toolbar");

        var workspace = shell.querySelector(
            ":scope > .mc-portal-module-workspace,:scope > .sirk-management-workspace,:scope > .mc-admin-management-layout"
        );
        if (workspace) {
            workspace.classList.add("mc-portal-module-workspace", "mc-portal-module-layout");

            var columns = workspace.children || [];
            if (columns[0]) columns[0].classList.add("mc-portal-module-primary");
            if (columns[1]) columns[1].classList.add("mc-portal-module-secondary");
            if (columns[2]) columns[2].classList.add("mc-portal-module-details");
        }

        var managementHost = shell.closest(".mycompany-management-host");
        var editMode = !!(
            managementHost && managementHost.classList.contains("is-management-edit-mode") ||
            shell.querySelector(".mc-tree-script-actions:not(:empty),.sirk-script-actions:not(:empty)")
        );
        var collapsed = !!(
            managementHost && managementHost.classList.contains("is-management-collapsed") ||
            workspace && workspace.classList.contains("is-collapsed")
        );

        shell.classList.toggle("is-edit-mode", editMode);
        if (workspace) {
            workspace.classList.toggle("is-edit-mode", editMode);
            workspace.classList.toggle("is-collapsed", collapsed);
        }
    }

    function decorate(scope) {
        scope = scope || root;

        addClass(scope.querySelectorAll(
            ".mc-shared-page.mc-portal-module-shell,.sirk-management-shell,.mc-admin-management-shell"
        ), "mc-portal-module-shell");

        Array.prototype.forEach.call(scope.querySelectorAll(".mc-portal-module-shell,.sirk-management-shell,.mc-admin-management-shell"), decorateShell);
        decorateToolbar(scope);
        decorateNavigation(scope);
        decorateTables(scope);
        decorateActions(scope);
    }

    function decorateSettingsFrame(frame) {
        if (!frame || frame.getAttribute("data-portal-ui-contract") === "1") return;
        frame.setAttribute("data-portal-ui-contract", "1");

        function apply() {
            try {
                var doc = frame.contentDocument;
                var admin = doc && doc.getElementById("mycompany-admin");
                var adminRoot = doc && doc.getElementById("sirkPortalRoot");
                if (!admin || !adminRoot) return;
                admin.classList.add("mc-admin-portal-embedded");
                if (doc.documentElement) doc.documentElement.classList.add("mc-portal-admin-document");
                if (frame.contentWindow && frame.contentWindow.MyCompanyPortalUiContract) {
                    frame.contentWindow.MyCompanyPortalUiContract.decorate(adminRoot);
                }
            } catch (error) {}
        }

        frame.addEventListener("load", function () {
            window.setTimeout(apply, 0);
            window.setTimeout(apply, 250);
        });
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

    var observer = new MutationObserver(schedule);
    observer.observe(root, { childList: true, subtree: true });

    root.addEventListener("click", function () {
        window.setTimeout(schedule, 0);
    }, true);
    window.addEventListener("sirkportal:languagechange", schedule);

    window.MyCompanyPortalUiContract = {
        decorate: decorate,
        refresh: schedule
    };

    schedule();
}());
