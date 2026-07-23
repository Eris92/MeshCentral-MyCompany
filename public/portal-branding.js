(function () {
    "use strict";

    var base = String(window.__MYCOMPANY_ASSET_BASE__ || window.__MYCOMPANY_LOGIN_ASSET_BASE__ || "").replace(/\/$/, "");
    if (!base) return;

    function apply(config) {
        config = config && typeof config === "object" ? config : {};
        var name = String(config.siteName || "SirK Portal").trim() || "SirK Portal";
        var icon = String(config.siteIconUrl || "").trim();
        window.__MYCOMPANY_PORTAL_BRANDING__ = config;
        document.title = document.body && document.body.classList.contains("sirk-login-frame-shell") ? name + " — logowanie" : name;

        var brand = document.querySelector(".sirk-standalone-brand strong,.sirk-login-product");
        if (brand) brand.textContent = name;

        var mark = document.querySelector(".sirk-brand-mark,.sirk-login-mark");
        if (mark) {
            if (icon) {
                mark.textContent = "";
                var image = document.createElement("img");
                image.src = icon;
                image.alt = "";
                image.style.width = "100%";
                image.style.height = "100%";
                image.style.objectFit = "contain";
                mark.appendChild(image);
            } else {
                mark.textContent = (name.charAt(0) || "S").toUpperCase();
            }
        }

        var favicon = document.querySelector('link[rel="icon"][data-sirk-branding]');
        if (icon) {
            if (!favicon) {
                favicon = document.createElement("link");
                favicon.rel = "icon";
                favicon.setAttribute("data-sirk-branding", "1");
                document.head.appendChild(favicon);
            }
            favicon.href = icon;
        } else if (favicon) favicon.remove();
    }

    fetch(base + "/portal-branding.json?v=" + encodeURIComponent(String(window.__MYCOMPANY_PORTAL_VERSION__ || Date.now())), {
        credentials: "same-origin",
        cache: "no-store"
    }).then(function (response) {
        if (!response.ok) throw new Error("HTTP " + response.status);
        return response.json();
    }).then(apply).catch(function () { apply({}); });
}());