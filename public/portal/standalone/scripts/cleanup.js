(function () {
    "use strict";

    if (window.__sirkPlatformPortalCleanupLoaded) return;
    window.__sirkPlatformPortalCleanupLoaded = true;

    var root = document.getElementById("sirkPortalRoot");
    if (!root) return;

    function addPortalClasses(scope) {
        if (!scope || !scope.querySelectorAll) return;
        Array.prototype.forEach.call(scope.querySelectorAll(
            ".mc-shared-page,.sirk-management-shell,.mc-admin-management-shell"
        ), function (shell) {
            shell.classList.add("mc-portal-module-shell");
        });
        Array.prototype.forEach.call(scope.querySelectorAll(
            ".sirk-management-workspace,.mc-admin-management-layout"
        ), function (layout) {
            layout.classList.add("mc-portal-module-workspace", "mc-portal-module-layout");
            if (layout.children[0]) layout.children[0].classList.add("mc-portal-module-primary");
            if (layout.children[1]) layout.children[1].classList.add("mc-portal-module-secondary");
            if (layout.children[2]) layout.children[2].classList.add("mc-portal-module-details");
        });
    }

    function injectSettingsContract(frame) {
        if (!frame) return;
        try {
            var doc = frame.contentDocument;
            if (!doc || !doc.head || !doc.body) return;
            var admin = doc.getElementById("sirk-platform-admin");
            if (!admin) return;

            doc.documentElement.classList.add("mc-portal-settings-document");
            doc.documentElement.style.width = "100%";
            doc.documentElement.style.height = "100%";
            doc.documentElement.style.minWidth = "0";
            doc.documentElement.style.overflow = "hidden";
            doc.body.id = doc.body.id || "sirkPortalRoot";
            doc.body.classList.add("mc-portal-settings-body");
            admin.classList.add("mc-admin-portal-embedded");

            if (!doc.getElementById("sirk-platform-portal-settings-cleanup-style")) {
                var style = doc.createElement("style");
                style.id = "sirk-platform-portal-settings-cleanup-style";
                style.textContent = [
                    "html,body{width:100%!important;height:100%!important;min-width:0!important;margin:0!important;overflow:hidden!important;background:var(--sirk-panel,#fff)!important;}",
                    "body{display:block!important;}",
                    "#sirk-platform-admin{width:100%!important;max-width:none!important;height:100%!important;min-width:0!important;margin:0!important;padding:0!important;overflow:hidden!important;}",
                    ".mc-admin-shell{display:grid!important;grid-template-columns:184px minmax(0,1fr)!important;width:100%!important;max-width:none!important;height:100%!important;min-width:0!important;min-height:0!important;gap:0!important;overflow:hidden!important;}",
                    ".mc-admin-shell.has-middle{grid-template-columns:184px 236px minmax(0,1fr)!important;}",
                    ".mc-admin-tabs,.mc-admin-middle,#sirk-platform-admin-content{min-width:0!important;min-height:0!important;height:100%!important;overflow:auto!important;box-sizing:border-box!important;}",
                    ".mc-admin-tabs,.mc-admin-middle{padding:12px!important;border:0!important;border-right:1px solid var(--sirk-border,#dce3ec)!important;border-radius:0!important;background:var(--sirk-panel,#fff)!important;}",
                    "#sirk-platform-admin-content{padding:18px!important;background:var(--sirk-panel,#fff)!important;}",
                    ".mc-admin-grid{grid-template-columns:repeat(auto-fit,minmax(280px,1fr))!important;gap:12px!important;}",
                    ".mc-admin-card{margin:0 0 12px!important;padding:14px!important;border:1px solid var(--sirk-border,#dce3ec)!important;border-radius:8px!important;background:var(--sirk-panel,#fff)!important;}",
                    ".mc-admin-settings-layout{grid-template-columns:220px minmax(0,1fr)!important;width:100%!important;min-width:0!important;gap:14px!important;}",
                    ".mc-admin-portal-view{grid-template-columns:minmax(140px,.7fr) minmax(180px,1fr) minmax(180px,1fr) minmax(220px,1.2fr)!important;}",
                    "@media(max-width:900px){.mc-admin-shell,.mc-admin-shell.has-middle{grid-template-columns:1fr!important;overflow:auto!important}.mc-admin-tabs,.mc-admin-middle{height:auto!important;border-right:0!important;border-bottom:1px solid var(--sirk-border,#dce3ec)!important}.mc-admin-settings-layout{grid-template-columns:1fr!important}}"
                ].join("");
                doc.head.appendChild(style);
            }

            var dark = root.classList.contains("sirk-theme-dark");
            doc.documentElement.classList.toggle("sirk-theme-dark", dark);
            doc.documentElement.classList.toggle("sirk-theme-light", !dark);
            doc.body.classList.toggle("sirk-theme-dark", dark);
            doc.body.classList.toggle("sirk-theme-light", !dark);

            var computed = window.getComputedStyle(root);
            ["--sirk-panel", "--sirk-input", "--sirk-text", "--sirk-muted", "--sirk-border", "--sirk-active-accent"].forEach(function (name) {
                var value = computed.getPropertyValue(name);
                if (value) doc.body.style.setProperty(name, value.trim());
            });

            addPortalClasses(doc.body);
        } catch (error) {
            if (window.console && console.warn) console.warn("Settings cleanup failed", error);
        }
    }

    function refresh() {
        addPortalClasses(root);
        Array.prototype.forEach.call(root.querySelectorAll(".sirk-standalone-settings-frame"), function (frame) {
            if (frame.getAttribute("data-cleanup-bound") !== "1") {
                frame.setAttribute("data-cleanup-bound", "1");
                frame.addEventListener("load", function () {
                    window.setTimeout(function () { injectSettingsContract(frame); }, 0);
                    window.setTimeout(function () { injectSettingsContract(frame); }, 250);
                });
            }
            injectSettingsContract(frame);
        });
    }

    var scheduled = false;
    var observer = new MutationObserver(function () {
        if (scheduled) return;
        scheduled = true;
        window.requestAnimationFrame(function () {
            scheduled = false;
            refresh();
        });
    });
    observer.observe(root, { childList: true, subtree: true });
    window.addEventListener("sirkportal:languagechange", refresh);
    window.addEventListener("sirkportal:themechange", refresh);
    refresh();
}());
