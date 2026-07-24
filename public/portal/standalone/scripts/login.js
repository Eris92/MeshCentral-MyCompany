(function () {
    "use strict";

    var frame = document.getElementById("sirkLoginFrame");
    var loading = document.getElementById("sirkLoginLoading");
    var assetBase = String(window.__SIRK_PLATFORM_LOGIN_ASSET_BASE__ || "").replace(/\/$/, "");
    var version = encodeURIComponent(window.__SIRK_PLATFORM_PORTAL_VERSION__ || "1");
    var redirected = false;
    var revealed = false;

    function reveal() {
        if (revealed) return;
        revealed = true;
        frame.classList.add("is-ready");
        loading.hidden = true;
    }

    function visible(element) {
        return !!(element && (element.offsetWidth || element.offsetHeight || element.getClientRects().length));
    }

    function workspace(documentValue) {
        var candidates = documentValue.querySelectorAll("#p10desktop,#p1,#column_l,#MainMenu,#page_content");
        for (var i = 0; i < candidates.length; i += 1) {
            if (visible(candidates[i])) return candidates[i];
        }
        return null;
    }

    function loginForm(documentValue) {
        var password = documentValue.querySelector('input[type="password"]');
        if (password && password.closest("form") && visible(password.closest("form"))) return password.closest("form");
        var forms = documentValue.querySelectorAll("form");
        for (var i = 0; i < forms.length; i += 1) {
            if (visible(forms[i]) && forms[i].querySelector('input[type="text"],input[type="email"],input[type="password"]')) return forms[i];
        }
        return null;
    }

    function inject(documentValue, tag, id, source) {
        if (documentValue.getElementById(id)) return;
        var node = documentValue.createElement(tag);
        node.id = id;
        if (tag === "link") {
            node.rel = "stylesheet";
            node.href = source;
        } else {
            node.src = source;
            node.async = false;
        }
        (documentValue.head || documentValue.documentElement).appendChild(node);
    }

    function finishLogin() {
        if (redirected) return;
        redirected = true;
        var returnToPortal = new URL(window.location.href).searchParams.get("return") === "portal";
        var target = window.__SIRK_PLATFORM_FORCE_PORTAL__ === true || returnToPortal
            ? window.__SIRK_PLATFORM_LOGIN_PORTAL_URL__
            : window.__SIRK_PLATFORM_LOGIN_NATIVE_URL__;
        if (returnToPortal) {
            try {
                var hash = window.sessionStorage.getItem("sirkPortal.returnHash") || "";
                window.sessionStorage.removeItem("sirkPortal.returnHash");
                if (/^#[a-z0-9_-]+$/i.test(hash)) target = String(target || "").replace(/#.*$/, "") + hash;
            } catch (error) {}
        }
        window.location.replace(String(target || "/"));
    }

    function inspect() {
        try {
            var documentValue = frame.contentDocument;
            if (!documentValue) return;
            if (workspace(documentValue) && !loginForm(documentValue)) {
                finishLogin();
                return;
            }
            if (loginForm(documentValue)) {
                inject(documentValue, "link", "sirkPlatformForcedLoginStyle", assetBase + "/sirk-native-login.css?v=" + version);
                inject(documentValue, "script", "sirkPlatformForcedLoginScript", assetBase + "/sirk-native-login.js?v=" + version);
                var shell = documentValue.getElementById("sirkLoginShell");
                var host = documentValue.getElementById("sirkNativeLoginHost");
                var styledForm = host && host.querySelector("form.sirk-native-login-form");
                if (documentValue.documentElement.classList.contains("sirk-login-active") && shell && styledForm) reveal();
                return;
            }
        } catch (error) {
            // Cross-origin identity providers remain visible in the native iframe.
            reveal();
        }
    }

    frame.addEventListener("load", inspect);
    window.setInterval(inspect, 500);
}());
