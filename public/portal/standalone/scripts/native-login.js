(function () {
    "use strict";

    if (window.__sirkPlatformSirkLoginLoaded) return;
    window.__sirkPlatformSirkLoginLoaded = true;
    var STORAGE_LANGUAGE = "sirkPortal.language";
    var TEXT = {
        pl: {
            heroTitle: "Zarządzaj infrastrukturą z jednego miejsca.", heroText: "Urządzenia, automatyzacja, akceptacje i monitoring z wykorzystaniem bezpiecznej sesji MeshCentral.",
            point1: "Natywne uwierzytelnianie MeshCentral", point2: "Jedna sesja i te same uprawnienia", point3: "Niezależny frontend operacyjny",
            access: "BEZPIECZNY DOSTĘP", loginTitle: "Zaloguj się", loginText: "Użyj konta skonfigurowanego w MeshCentral.",
            username: "Nazwa użytkownika", password: "Hasło", login: "Zaloguj", reset: "Resetuj hasło", footer: "Uwierzytelnianie i sesja obsługiwane przez MeshCentral", languageTitle: "Switch to English",
            loginError: "Logowanie nie powiodło się. Sprawdź nazwę użytkownika i hasło."
        },
        en: {
            heroTitle: "Manage your infrastructure from one place.", heroText: "Devices, automation, approvals and monitoring through a secure MeshCentral session.",
            point1: "Native MeshCentral authentication", point2: "One session and the same permissions", point3: "Independent operational frontend",
            access: "SECURE ACCESS", loginTitle: "Sign in", loginText: "Use your account configured in MeshCentral.",
            username: "Username", password: "Password", login: "Sign in", reset: "Reset password", footer: "Authentication and session provided by MeshCentral", languageTitle: "Przełącz na polski",
            loginError: "Sign-in failed. Check your username and password."
        }
    };

    function language() {
        try { return localStorage.getItem(STORAGE_LANGUAGE) === "en" ? "en" : "pl"; }
        catch (error) { return "pl"; }
    }

    function t(key) { return TEXT[language()][key] || key; }

    function branding() {
        try {
            var value = window.parent && window.parent.__SIRK_PLATFORM_PORTAL_BRANDING__;
            return value && typeof value === "object" ? value : {};
        } catch (error) { return {}; }
    }

    function visible(element) {
        return !!(element && (element.offsetWidth || element.offsetHeight || element.getClientRects().length));
    }

    function findWorkspace() {
        var selectors = ["#p10desktop", "#p1", "#column_l", "#MainMenu", "#page_content"];
        for (var i = 0; i < selectors.length; i += 1) {
            var item = document.querySelector(selectors[i]);
            if (visible(item)) return item;
        }
        return null;
    }

    function findLoginForm() {
        var password = document.querySelector('input[type="password"]');
        if (password && password.closest("form") && visible(password.closest("form"))) return password.closest("form");
        var forms = document.querySelectorAll("form");
        for (var i = 0; i < forms.length; i += 1) {
            if (visible(forms[i]) && forms[i].querySelector('input[type="text"],input[type="email"],input[type="password"]')) return forms[i];
        }
        return null;
    }

    function shellHtml() {
        var config = branding();
        var name = String(config.siteName || "SirK Portal").trim() || "SirK Portal";
        return '<section class="sirk-login-hero"><div class="sirk-login-hero-content"><div class="sirk-login-mark">' + name.charAt(0).toUpperCase() + '</div><div class="sirk-login-product"></div><h1 data-login-text="heroTitle">' + t("heroTitle") + '</h1><p data-login-text="heroText">' + t("heroText") + '</p><div class="sirk-login-points"><span><i></i><b data-login-text="point1">' + t("point1") + '</b></span><span><i></i><b data-login-text="point2">' + t("point2") + '</b></span><span><i></i><b data-login-text="point3">' + t("point3") + '</b></span></div></div><div class="sirk-login-watermark">SIRK</div></section><section class="sirk-login-panel"><div class="sirk-login-card"><button class="sirk-login-language" type="button" data-login-language="1"></button><header><span data-login-text="access">' + t("access") + '</span><h2 data-login-text="loginTitle">' + t("loginTitle") + '</h2><p data-login-text="loginText">' + t("loginText") + '</p></header><div id="sirkNativeLoginHost"></div><a class="sirk-password-reset" target="_blank" rel="noopener noreferrer" data-login-text="reset">' + t("reset") + '</a><footer data-login-text="footer">' + t("footer") + '</footer></div></section>';
    }

    function applyBranding() {
        var config = branding();
        var name = String(config.siteName || "SirK Portal").trim() || "SirK Portal";
        var icon = String(config.siteIconUrl || "").trim();
        var product = document.querySelector(".sirk-login-product");
        if (product) product.textContent = name;
        var mark = document.querySelector(".sirk-login-mark");
        if (mark) {
            if (icon) {
                mark.textContent = "";
                var existing = mark.querySelector("img");
                if (!existing) {
                    existing = document.createElement("img");
                    existing.alt = "";
                    existing.style.width = "100%";
                    existing.style.height = "100%";
                    existing.style.objectFit = "contain";
                    mark.appendChild(existing);
                }
                existing.src = icon;
            } else {
                mark.textContent = (name.charAt(0) || "S").toUpperCase();
            }
        }
        var reset = document.querySelector(".sirk-password-reset");
        if (reset) {
            reset.hidden = config.showPasswordReset === false;
            reset.style.display = config.showPasswordReset === false ? "none" : "";
            reset.href = String(config.passwordResetUrl || "https://passwordreset.microsoftonline.com/");
        }
    }

    function applyErrorLanguage(form) {
        if (!form) return;
        var patterns = [
            /logowanie nie powiodło się[,.]?\s*sprawdź nazwę użytkownika i hasło[.!]?/i,
            /login failed[,.]?\s*check (your )?username and password[.!]?/i,
            /sign-in failed[,.]?\s*check (your )?username and password[.!]?/i
        ];
        Array.prototype.forEach.call(form.querySelectorAll("div,span,p,td"), function (node) {
            if (node.children.length) return;
            var value = String(node.textContent || "").trim();
            if (!value || !patterns.some(function (pattern) { return pattern.test(value); })) return;
            node.textContent = t("loginError");
            node.setAttribute("data-login-error", "credentials");
            node.setAttribute("role", "alert");
        });
    }

    function applyLanguage(form) {
        document.documentElement.lang = language();
        Array.prototype.forEach.call(document.querySelectorAll("[data-login-text]"), function (node) {
            var value = t(node.getAttribute("data-login-text"));
            if (node.textContent !== value) node.textContent = value;
        });
        var user = form && form.querySelector('input[type="text"],input[type="email"]');
        var password = form && form.querySelector('input[type="password"]');
        var submit = form && form.querySelector('input[type="submit"],input[type="button"],button[type="submit"],button:not([type])');
        if (user) user.placeholder = t("username");
        if (password) password.placeholder = t("password");
        if (submit) {
            if (submit.tagName === "INPUT") submit.value = t("login");
            else submit.textContent = t("login");
        }
        applyErrorLanguage(form);
        applyBranding();
        var toggle = document.querySelector("[data-login-language]");
        if (toggle) {
            var toggleText = language() === "pl" ? "EN" : "PL";
            if (toggle.textContent !== toggleText) toggle.textContent = toggleText;
            toggle.title = t("languageTitle");
            toggle.setAttribute("aria-label", toggle.title);
            toggle.onclick = function () {
                try { localStorage.setItem(STORAGE_LANGUAGE, language() === "pl" ? "en" : "pl"); } catch (error) {}
                applyLanguage(form);
            };
        }
    }

    function install() {
        if (findWorkspace()) return false;
        var form = findLoginForm();
        if (!form) return false;
        document.documentElement.classList.add("sirk-login-active");
        var shell = document.getElementById("sirkLoginShell");
        if (!shell) {
            shell = document.createElement("main");
            shell.id = "sirkLoginShell";
            shell.innerHTML = shellHtml();
            document.body.appendChild(shell);
        }
        var host = document.getElementById("sirkNativeLoginHost");
        if (host && form.parentNode !== host) {
            form.classList.add("sirk-native-login-form");
            host.appendChild(form);
        }
        applyLanguage(form);
        return true;
    }

    function boot() {
        if (install()) return;
        var attempts = 0;
        var timer = window.setInterval(function () {
            attempts += 1;
            if (install() || attempts >= 80) window.clearInterval(timer);
        }, 100);
        new MutationObserver(function () { install(); }).observe(document.documentElement, { childList: true, subtree: true });
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
    else boot();
}());