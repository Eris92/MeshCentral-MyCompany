(function () {
    "use strict";

    var root = document.getElementById("sirk-platform-admin");
    if (!root) return;

    var PORTAL_VIEWS = [
        { key: "overview", label: "Przegląd", accent: "#4d6bd8" },
        { key: "devices", label: "Urządzenia", accent: "#55b8ff", styleNote: "Zachowuje własny układ urządzeń." },
        { key: "approvals", label: "Akceptacje", accent: "#35d7a4" },
        { key: "automation", label: "Automatyzacja", accent: "#ffae00" },
        { key: "monitoring", label: "Monitoring", accent: "#34d1e7" },
        { key: "assets", label: "Zasoby", accent: "#9a7cff" },
        { key: "management", label: "Zarządzanie", accent: "#ff5f7d" },
        { key: "reports", label: "Raporty", accent: "#7f85ff" },
        { key: "security", label: "Security", accent: "#ff385d" },
        { key: "settings", label: "Ustawienia", accent: "#94a3b8" }
    ];

    function data() { return window.SirkPlatformAdminData || {}; }
    function pluginPin() { return root.getAttribute("data-plugin") || "SirkPlatform"; }
    function element(tag, className, text) {
        var node = document.createElement(tag);
        if (className) node.className = className;
        if (text != null) node.textContent = text;
        return node;
    }
    function moduleRecord() {
        return (data().modules || []).find(function (module) { return module && module.key === "portal"; }) ||
            { key: "portal", name: "SirK Portal", enabled: false, ready: true };
    }
    function moduleSettings() {
        var settings = data().moduleSettings || {};
        return settings.portal || { enabled: false, defaultView: "overview", showLauncher: false, showNativeLink: true, forceNewLogin: false, forcePortalInterface: false, showPasswordReset: true, passwordResetUrl: "https://passwordreset.microsoftonline.com/", siteName: "SirK Portal", siteIconUrl: "", views: {} };
    }
    function checkbox(host, labelText, checked, description) {
        var label = element("label", "mc-admin-check");
        var input = element("input");
        input.type = "checkbox";
        input.checked = checked === true;
        label.appendChild(input);
        var text = element("span");
        text.appendChild(element("strong", "", labelText));
        if (description) text.appendChild(element("small", "", description));
        label.appendChild(text);
        host.appendChild(label);
        return input;
    }
    function input(host, labelText, value, type, description) {
        var wrapper = element("label", "mc-admin-field");
        wrapper.appendChild(element("span", "mc-admin-field-label", labelText));
        var field = element("input", "mc-admin-input");
        field.type = type || "text";
        field.value = value || "";
        wrapper.appendChild(field);
        if (description) wrapper.appendChild(element("small", "", description));
        host.appendChild(wrapper);
        return field;
    }
    function select(host, labelText, value) {
        var wrapper = element("div", "mc-admin-field");
        wrapper.appendChild(element("label", "mc-admin-field-label", labelText));
        var field = element("select", "mc-admin-input");
        PORTAL_VIEWS.forEach(function (entry) {
            var option = element("option", "", entry.label);
            option.value = entry.key;
            option.selected = String(value || "overview") === entry.key;
            field.appendChild(option);
        });
        wrapper.appendChild(field);
        host.appendChild(wrapper);
        return field;
    }
    function viewEditor(host, definition, value) {
        value = value && typeof value === "object" ? value : {};
        var row = element("section", "mc-admin-portal-view");
        var heading = element("div", "mc-admin-portal-view-heading");
        heading.appendChild(element("strong", "", definition.label));
        heading.appendChild(element("code", "", definition.key));
        row.appendChild(heading);
        var enabled = checkbox(row, "Pokaż zakładkę", value.enabled !== false, definition.styleNote || "Ukrycie usuwa pozycję z menu i blokuje bezpośrednie otwarcie widoku.");
        var personalized = checkbox(row, "Włącz personalizację", value.personalized === true, "Pozwala użyć własnej nazwy i koloru akcentu tylko dla tej zakładki.");
        var controls = element("div", "mc-admin-portal-view-controls");
        var labelWrapper = element("label", "mc-admin-field");
        labelWrapper.appendChild(element("span", "mc-admin-field-label", "Własna nazwa"));
        var label = element("input", "mc-admin-input");
        label.type = "text";
        label.maxLength = 40;
        label.placeholder = definition.label;
        label.value = value.label || "";
        labelWrapper.appendChild(label);
        controls.appendChild(labelWrapper);
        var accentWrapper = element("label", "mc-admin-field mc-admin-portal-color-field");
        accentWrapper.appendChild(element("span", "mc-admin-field-label", "Kolor akcentu"));
        var accent = element("input", "mc-admin-input mc-admin-portal-color");
        accent.type = "color";
        accent.value = /^#[0-9a-f]{6}$/i.test(String(value.accent || "")) ? value.accent : definition.accent;
        accentWrapper.appendChild(accent);
        controls.appendChild(accentWrapper);
        row.appendChild(controls);
        function updateDisabled() {
            var editable = personalized.checked;
            label.disabled = !editable;
            accent.disabled = !editable;
            controls.classList.toggle("is-disabled", !editable);
        }
        personalized.addEventListener("change", updateDisabled);
        updateDisabled();
        host.appendChild(row);
        return { enabled: enabled, personalized: personalized, label: label, accent: accent };
    }
    function post(values) {
        var url = new URL("pluginadmin.ashx", window.location.href);
        url.searchParams.set("pin", pluginPin());
        url.searchParams.set("module", "portal");
        url.searchParams.set("asset", "settings");
        var body = new URLSearchParams();
        body.set("payload", JSON.stringify(values));
        return fetch(url.href, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" }, body: body.toString() }).then(function (response) {
            return response.text().then(function (text) {
                var result;
                try { result = JSON.parse(text || "{}"); }
                catch (error) { throw new Error(text || ("HTTP " + response.status)); }
                if (!response.ok || result.ok === false) throw new Error(result.error || ("HTTP " + response.status));
                return result;
            });
        });
    }
    function reloadMeshCentral() {
        window.setTimeout(function () {
            try { if (window.top && window.top.location) window.top.location.reload(); else window.location.reload(); }
            catch (error) { window.location.reload(); }
        }, 700);
    }
    function render(panel) {
        var record = moduleRecord();
        var current = moduleSettings();
        panel.innerHTML = "";
        var header = element("div", "mc-admin-section-header");
        header.appendChild(element("h3", "", "SirK Portal"));
        header.appendChild(element("p", "", "Niezależny frontend korzystający z sesji, uprawnień i backendu SirkPlatform."));
        panel.appendChild(header);
        var card = element("section", "mc-admin-card");
        card.appendChild(element("h3", "", "Portal interface"));
        card.appendChild(element("div", "mc-admin-card-description", "Portal działa w osobnym dokumencie i nie ładuje swojego layoutu, CSS ani loginu do natywnego interfejsu MeshCentral."));
        var enabled = checkbox(card, "Enable SirK Portal", current.enabled === true || record.enabled === true, "Udostępnia portal pod adresem /sirkportal/. Wyłączenie nie usuwa danych SirkPlatform.");
        var defaultView = select(card, "Default start view", current.defaultView || "overview");
        var showNativeLink = checkbox(card, "Show MeshCentral link in SirK Portal", current.showNativeLink !== false, "Pokazuje link MeshCentral na dole menu SirK Portal.");
        var showLauncher = checkbox(card, "Show SirK Portal launcher in native Mesh", current.showLauncher === true, "Opcjonalny link nawigacyjny, domyślnie wyłączony.");
        var forceNewLogin = checkbox(card, "Wymuszaj nowy ekran logowania", current.forceNewLogin === true, "Wejście na ekran logowania MeshCentral otwiera niezależny ekran SirK Portal z osadzonym natywnym uwierzytelnianiem.");
        var forcePortalInterface = checkbox(card, "Wymuszaj nowy interfejs", current.forcePortalInterface === true, "Wejście do starego interfejsu przekierowuje użytkownika z powrotem do SirK Portal.");
        var keepSessionsAfterRestart = checkbox(card, "Utrzymuj sesje po restarcie MeshCentral", current.keepSessionsAfterRestart === true, "Zapisuje stały SessionKey MeshCentral. Zmiana wymaga restartu usługi; klucz pozostaje sekretem i nie jest wyświetlany w interfejsie.");
        var showPasswordReset = checkbox(card, "Pokazuj przycisk resetu hasła", current.showPasswordReset !== false, "Pokazuje przycisk na ekranie logowania SirK Portal.");
        var passwordResetUrl = input(card, "Adres resetu hasła", current.passwordResetUrl || "https://passwordreset.microsoftonline.com/", "url", "Adres HTTP/HTTPS otwierany po kliknięciu Resetuj hasło.");
        var siteName = input(card, "Nazwa witryny", current.siteName || "SirK Portal", "text", "Nazwa w menu, ekranie logowania i tytule karty przeglądarki.");
        siteName.maxLength = 80;
        var siteIconUrl = input(card, "Adres ikony witryny", current.siteIconUrl || "", "url", "Ikona używana jako favicon oraz logo na stronie i ekranie logowania.");
        function updateResetUrl() { passwordResetUrl.disabled = !showPasswordReset.checked; }
        showPasswordReset.addEventListener("change", updateResetUrl);
        updateResetUrl();
        var viewCard = element("section", "mc-admin-card");
        viewCard.appendChild(element("h3", "", "Zakładki i personalizacja"));
        viewCard.appendChild(element("div", "mc-admin-card-description", "Wszystkie zakładki poza Urządzeniami używają jednego wspólnego stylu. Każdą pozycję można niezależnie pokazać, ukryć i spersonalizować."));
        var viewList = element("div", "mc-admin-portal-view-list");
        var viewInputs = {};
        PORTAL_VIEWS.forEach(function (definition) { viewInputs[definition.key] = viewEditor(viewList, definition, current.views && current.views[definition.key]); });
        viewCard.appendChild(viewList);
        panel.appendChild(viewCard);
        var actions = element("div", "mc-admin-actions mc-admin-settings-savebar");
        var save = element("button", "mc-admin-primary", "Save settings");
        save.type = "button";
        var status = element("span", "mc-admin-save-status");
        save.onclick = function () {
            save.disabled = true;
            status.className = "mc-admin-save-status";
            status.textContent = "Saving...";
            var views = {};
            PORTAL_VIEWS.forEach(function (definition) {
                var fields = viewInputs[definition.key];
                views[definition.key] = { enabled: fields.enabled.checked, personalized: fields.personalized.checked, label: fields.label.value, accent: fields.accent.value };
            });
            post({ enabled: enabled.checked, defaultView: defaultView.value, showNativeLink: showNativeLink.checked, showLauncher: showLauncher.checked, forceNewLogin: forceNewLogin.checked, forcePortalInterface: forcePortalInterface.checked, keepSessionsAfterRestart: keepSessionsAfterRestart.checked, showPasswordReset: showPasswordReset.checked, passwordResetUrl: passwordResetUrl.value, siteName: siteName.value, siteIconUrl: siteIconUrl.value, views: views }).then(function (result) {
                var state = result.module || {};
                data().moduleSettings = data().moduleSettings || {};
                data().moduleSettings.portal = state;
                moduleRecord().enabled = state.enabled === true;
                status.textContent = result.serviceRestartRequired ? "Saved — restart MeshCentral to apply persistent sessions." : "Saved — reloading MeshCentral UI.";
                reloadMeshCentral();
            }).catch(function (error) {
                status.className = "mc-admin-save-status mc-admin-error";
                status.textContent = error.message || String(error);
                save.disabled = false;
            });
        };
        actions.appendChild(save);
        actions.appendChild(status);
        panel.insertBefore(actions, viewCard);
        panel.insertBefore(card, viewCard);
    }

    window.SirkPlatformPortalAdmin = { render: render };
}());