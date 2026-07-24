(function () {
    "use strict";

    if (window.__sirkPlatformPortalApprovalHookLoaded) return;
    window.__sirkPlatformPortalApprovalHookLoaded = true;

    var active = false;

    function root() { return document.getElementById("sirkPortalRoot"); }

    function host(portal) {
        return portal && portal.querySelector('[data-view="approvals"]');
    }

    function mount(force) {
        var portal = root();
        var target = host(portal);
        if (!portal || !target || !active) return;
        portal.querySelectorAll("[data-view]").forEach(function (view) {
            var visible = view === target;
            view.hidden = !visible;
            view.style.display = visible ? "" : "none";
            view.classList.toggle("is-active", visible);
        });
        portal.querySelectorAll("[data-sirk-view]").forEach(function (button) {
            var selected = button.getAttribute("data-sirk-view") === "approvals";
            button.classList.toggle("is-active", selected);
            button.setAttribute("aria-current", selected ? "page" : "false");
        });
        var title = document.getElementById("sirkViewTitle");
        if (title) title.textContent = "Akceptacje";
        if (!window.SirkPlatformPortalApproval || typeof window.SirkPlatformPortalApproval.mount !== "function") {
            target.innerHTML = '<div class="sirk-card"><h3>Akceptacje</h3><p>Renderer Approval Center nie został załadowany.</p></div>';
            return;
        }
        if (force || !target.querySelector(".sirk-approval-shell")) {
            target.innerHTML = "";
            window.SirkPlatformPortalApproval.mount(target);
        }
    }

    function activate() {
        active = true;
        if (window.SirKPortal && typeof window.SirKPortal.open === "function") {
            window.SirKPortal.open("approvals");
        }
        mount(true);
        window.setTimeout(function () { mount(false); }, 0);
        window.setTimeout(function () { mount(false); }, 100);
    }

    window.addEventListener("click", function (event) {
        var portal = root();
        if (!portal || !portal.contains(event.target)) return;
        var button = event.target.closest && event.target.closest('[data-sirk-view="approvals"]');
        if (button) {
            event.preventDefault();
            event.stopPropagation();
            if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
            activate();
            return;
        }
        var other = event.target.closest && event.target.closest("[data-sirk-view]");
        if (other && other.getAttribute("data-sirk-view") !== "approvals") active = false;
    }, true);

    function bind() {
        var portal = root();
        if (!portal) return false;
        if (!portal.__sirkPlatformApprovalHookObserver) {
            portal.__sirkPlatformApprovalHookObserver = new MutationObserver(function () {
                if (active) mount(false);
            });
            portal.__sirkPlatformApprovalHookObserver.observe(portal, { childList: true, subtree: true });
        }
        var selected = portal.querySelector('[data-sirk-view="approvals"].is-active');
        if (selected) { active = true; mount(false); }
        return true;
    }

    var attempts = 0;
    var timer = window.setInterval(function () {
        attempts++;
        if (bind() || attempts > 120) window.clearInterval(timer);
    }, 100);
}());