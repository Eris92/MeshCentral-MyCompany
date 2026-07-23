(function () {
    "use strict";

    var base = String(window.__MYCOMPANY_ASSET_BASE__ || window.__MYCOMPANY_LOGIN_ASSET_BASE__ || "").replace(/\/$/, "");
    if (!base) return;
    var current = {};

    function applyDocument(doc, config) {
        if (!doc) return;
        var name = String(config.siteName || "SirK Portal").trim() || "SirK Portal";
        var icon = String(config.siteIconUrl || "").trim();
        var brand = doc.querySelector(".sirk-standalone-brand strong,.sirk-login-product");
        if (brand) brand.textContent = name;

        var mark = doc.querySelector(".sirk-brand-mark,.sirk-login-mark");
        if (mark) {
            if (icon) {
                var image = mark.querySelector("img[data-sirk-branding]");
                if (!image) {
                    mark.textContent = "";
                    image = doc.createElement("img");
                    image.setAttribute("data-sirk-branding", "1");
                    image.alt = "";
                    image.style.width = "100%";
                    image.style.height = "100%";
                    image.style.objectFit = "contain";
                    mark.appendChild(image);
                }
                image.src = icon;
            } else {
                mark.textContent = (name.charAt(0) || "S").toUpperCase();
            }
        }

        var reset = doc.querySelector(".sirk-password-reset");
        if (reset) {
            var visible = config.showPasswordReset !== false;
            reset.hidden = !visible;
            reset.style.display = visible ? "" : "none";
            reset.href = String(config.passwordResetUrl || "https://passwordreset.microsoftonline.com/");
        }
    }

    function synchronize() {
        applyDocument(document, current);
        var frame = document.getElementById("sirkLoginFrame");
        if (frame) {
            try { applyDocument(frame.contentDocument, current); }
            catch (error) {}
        }
    }

    function apply(config) {
        current = config && typeof config === "object" ? config : {};
        var name = String(current.siteName || "SirK Portal").trim() || "SirK Portal";
        var icon = String(current.siteIconUrl || "").trim();
        window.__MYCOMPANY_PORTAL_BRANDING__ = current;
        document.title = document.getElementById("sirkLoginFrame") ? name + " — logowanie" : name;
        synchronize();

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

    window.setInterval(synchronize, 500);
}());