(function () {
    "use strict";

    if (window.__myCompanyNativePortalLauncherLoaded) return;
    window.__myCompanyNativePortalLauncherLoaded = true;

    function portalUrl() {
        var url = new URL(window.location.href);
        var path = url.pathname || "/";
        var base = path.slice(0, path.lastIndexOf("/") + 1);
        return base + "sirkportal/";
    }

    function ensureLauncher() {
        if (!document.body || document.getElementById("myCompanyPortalLauncher")) return;
        var link = document.createElement("a");
        link.id = "myCompanyPortalLauncher";
        link.href = portalUrl();
        link.title = "Otwórz SirK Portal";
        link.setAttribute("aria-label", "Otwórz SirK Portal");
        link.innerHTML = '<span aria-hidden="true">S</span><b>SirK Portal</b>';
        link.style.cssText = [
            "position:fixed",
            "left:18px",
            "bottom:18px",
            "z-index:2147483000",
            "display:flex",
            "align-items:center",
            "gap:9px",
            "min-height:42px",
            "padding:8px 13px",
            "border-radius:10px",
            "background:#111827",
            "color:#fff",
            "text-decoration:none",
            "font:600 14px Segoe UI,Arial,sans-serif",
            "box-shadow:0 8px 24px rgba(0,0,0,.28)"
        ].join(";");
        var mark = link.querySelector("span");
        mark.style.cssText = "display:grid;place-items:center;width:28px;height:28px;border-radius:8px;background:#6346ed;color:#fff;font-weight:800";
        link.addEventListener("mouseenter", function () { link.style.transform = "translateY(-1px)"; });
        link.addEventListener("mouseleave", function () { link.style.transform = ""; });
        document.body.appendChild(link);
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ensureLauncher, { once: true });
    else ensureLauncher();

    var observer = new MutationObserver(ensureLauncher);
    observer.observe(document.documentElement, { childList: true, subtree: true });
}());