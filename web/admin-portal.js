(function () {
    "use strict";

    var root = document.getElementById("mycompany-admin");
    var content = document.getElementById("mycompany-admin-content");
    if (!root || !content || window.__myCompanyPortalAdminInstalled) return;
    window.__myCompanyPortalAdminInstalled = true;

    var scheduled = false;

    function data() {
        return window.MyCompanyAdminData || {};
    }

    function pluginPin() {
        return root.getAttribute("data-plugin") || "MyCompany";
    }

    function element(tag, className, text) {
        var node = document.createElement(tag);
        if (className) node.className = className;
        if (text != null) node.textContent = text;
        return node;
    }

    function moduleRecord() {
        return (data().modules || []).find(function (module) {
            return module && module.key === "portal";
        }) || { key: "portal", name: "SirK Portal", enabled: false, ready: true };
    }

    function moduleSettings() {
        var settings = data().moduleSettings || {};
        return settings.portal || { enabled: false, defaultView: "overview", showLauncher: true };
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

    function select(host, labelText, value) {
        var wrapper = element("div", "mc-admin-field");
        wrapper.appendChild(element("label", "mc-admin-field-label", labelText));
        var field = element("select", "mc-admin-input");
        [
            ["overview", "Przegląd"],
            ["devices", "Urządzenia"],
            ["management", "Zarządzanie / MyScripts"],
            ["approvals", "Akceptacje / Approval Center"],
            ["settings", "Ustawienia"]
        ].forEach(function (entry) {
            var option = element("option", "", entry[1]);
            option.value = entry[0];
            option.selected = String(value || "overview") === entry[0];
            field.appendChild(option);
        });
        wrapper.appendChild(field);
        host.appendChild(wrapper);
        return field;
    }

    function post(values) {
        var url = new URL("pluginadmin.ashx", window.location.href);
        url.searchParams.set("pin", pluginPin());
        url.searchParams.set("module", "portal");
        url.searchParams.set("asset", "settings");
        var body = new URLSearchParams();
        body.set("payload", JSON.stringify(values));
        return fetch(url.href, {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
            body: body.toString()
        }).then(function (response) {
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
            try {
                if (window.top && window.top.location) window.top.location.reload();
                else window.location.reload();
            } catch (error) {
                window.location.reload();
            }
        }, 700);
    }

    function renderPanel(panel, button) {
        var record = moduleRecord();
        var current = moduleSettings();
        panel.innerHTML = "";

        var header = element("div", "mc-admin-section-header");
        header.appendChild(element("h3", "", "SirK Portal"));
        header.appendChild(element("p", "", "Opcjonalny nowy interfejs korzystający z tych samych modułów, sesji i uprawnień MyCompany."));
        panel.appendChild(header);

        var card = element("section", "mc-admin-card");
        card.appendChild(element("h3", "", "Portal interface"));
        card.appendChild(element("div", "mc-admin-card-description", "Włączenie portalu zmienia frontend po zalogowaniu. Wyłączenie pozostawia natywny interfejs MeshCentral."));

        var enabled = checkbox(
            card,
            "Enable SirK Portal",
            current.enabled === true || record.enabled === true,
            "Po zapisaniu karta MeshCentral zostanie przeładowana automatycznie. Dane MyCompany nie są usuwane."
        );
        var defaultView = select(card, "Default start view", current.defaultView || "overview");
        var showLauncher = checkbox(
            card,
            "Show Portal launcher in native Mesh",
            current.showLauncher !== false,
            "Pozwala wrócić do portalu po wybraniu pozycji Mesh."
        );

        var notice = element("div", "mc-admin-notice");
        notice.textContent = "Nie uruchamiaj równolegle osobnej wtyczki SirKPortal. Stara wtyczka rejestruje własny globalny shell i domain.customFiles.";
        card.appendChild(notice);

        var actions = element("div", "mc-admin-inline-actions");
        var save = element("button", "mc-admin-primary", "Save SirK Portal");
        save.type = "button";
        var status = element("span", "mc-admin-save-status");
        save.onclick = function () {
            save.disabled = true;
            status.className = "mc-admin-save-status";
            status.textContent = "Saving...";
            post({
                enabled: enabled.checked,
                defaultView: defaultView.value,
                showLauncher: showLauncher.checked
            }).then(function (result) {
                var state = result.module || {};
                data().moduleSettings = data().moduleSettings || {};
                data().moduleSettings.portal = state;
                var module = moduleRecord();
                module.enabled = state.enabled === true;
                status.textContent = "Saved — reload the MeshCentral tab...";
                reloadMeshCentral();
            }).catch(function (error) {
                status.className = "mc-admin-save-status mc-admin-error";
                status.textContent = error.message || String(error);
                save.disabled = false;
            });
        };
        actions.appendChild(save);
        actions.appendChild(status);
        card.appendChild(actions);
        panel.appendChild(card);

        panel.querySelectorAll(".mc-admin-card").forEach(function (item) {
            item.dataset.portalSettingsCard = "1";
        });
        button.classList.add("active");
    }

    function install() {
        scheduled = false;
        var layout = content.querySelector(".mc-admin-settings-layout");
        if (!layout) return;
        var navigation = layout.querySelector(".mc-admin-settings-nav");
        var panel = layout.querySelector(".mc-admin-settings-panel");
        if (!navigation || !panel) return;

        var button = navigation.querySelector("[data-mycompany-portal-settings]");
        if (!button) {
            button = element("button", "", "SirK Portal");
            button.type = "button";
            button.setAttribute("data-mycompany-portal-settings", "1");
            navigation.insertBefore(button, navigation.firstChild);
            button.onclick = function () {
                navigation.querySelectorAll("button").forEach(function (item) {
                    item.classList.remove("active");
                });
                renderPanel(panel, button);
            };
        }
    }

    function schedule() {
        if (scheduled) return;
        scheduled = true;
        window.requestAnimationFrame(install);
    }

    new MutationObserver(schedule).observe(content, { childList: true, subtree: true });
    root.addEventListener("click", function () { window.setTimeout(schedule, 0); });
    schedule();
}());
