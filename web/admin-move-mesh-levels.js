(function () {
    "use strict";

    var root = document.getElementById("mycompany-admin");
    var content = document.getElementById("mycompany-admin-content");
    if (!root || !content || window.__myCompanyMoveMeshLevels) return;
    window.__myCompanyMoveMeshLevels = true;

    var loading = false;
    var loaded = null;

    function element(tag, className, text) {
        var node = document.createElement(tag);
        if (className) node.className = className;
        if (text != null) node.textContent = text;
        return node;
    }

    function pluginUrl(asset, method) {
        var url = new URL("pluginadmin.ashx", window.location.href);
        url.searchParams.set("pin", root.getAttribute("data-plugin") || "MyCompany");
        url.searchParams.set("module", "moverequests");
        url.searchParams.set("asset", asset);
        return { url: url.href, method: method || "GET" };
    }

    function parseResponse(response) {
        return response.text().then(function (text) {
            var value;
            try { value = JSON.parse(text || "{}"); }
            catch (error) { throw new Error(text || ("HTTP " + response.status)); }
            if (!response.ok || value.ok === false) throw new Error(value.error || ("HTTP " + response.status));
            return value;
        });
    }

    function load() {
        if (loaded) return Promise.resolve(loaded);
        if (loading) return new Promise(function (resolve) {
            var timer = window.setInterval(function () {
                if (!loading) {
                    window.clearInterval(timer);
                    resolve(loaded);
                }
            }, 50);
        });
        loading = true;
        var target = pluginUrl("settings", "GET");
        return fetch(target.url, { method: target.method, credentials: "same-origin" })
            .then(parseResponse)
            .then(function (value) {
                loaded = value;
                return value;
            })
            .finally(function () { loading = false; });
    }

    function save(settings, levels) {
        var target = pluginUrl("settings", "POST");
        var body = new URLSearchParams();
        body.set("payload", JSON.stringify({
            hostButtonEnabled: settings.hostButtonEnabled !== false,
            targetMeshApprovalLevels: levels
        }));
        return fetch(target.url, {
            method: target.method,
            credentials: "same-origin",
            headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
            body: body.toString()
        }).then(parseResponse);
    }

    function moveRequestsCard(panel) {
        var cards = panel.querySelectorAll(".mc-admin-card");
        for (var index = 0; index < cards.length; index++) {
            var card = cards[index];
            var heading = card.querySelector(
                ":scope > h3, :scope > .mc-admin-card-toggle .mc-admin-card-toggle-text strong"
            );
            if (heading && String(heading.textContent || "").trim() === "Move Requests") return card;
        }
        return null;
    }

    function addEditor(card, value) {
        if (!card || card.querySelector(".mc-move-mesh-levels")) return;
        var body = card.querySelector(":scope > .mc-admin-card-body") || card;
        var settings = value.settings || {};
        var stored = settings.targetMeshApprovalLevels || {};
        var levels = {};

        var section = element("div", "mc-move-mesh-levels");
        section.appendChild(element("h4", "", "Target Mesh approval levels"));
        section.appendChild(element(
            "div",
            "mc-admin-field-description",
            "Assign the approval level required when a device is moved into each MeshCentral device group. Groups without an explicit value default to Level 1."
        ));

        var wrapper = element("div", "mc-move-mesh-levels-table-wrap");
        var table = element("table", "mc-move-mesh-levels-table");
        var head = table.createTHead().insertRow();
        head.appendChild(element("th", "", "MeshCentral group"));
        head.appendChild(element("th", "", "Required approval"));
        var tableBody = table.createTBody();

        (value.meshes || []).forEach(function (mesh) {
            var row = tableBody.insertRow();
            row.appendChild(element("td", "", mesh.name || mesh.id));
            var cell = row.insertCell();
            var select = element("select", "mc-admin-input mc-move-mesh-level-select");
            [
                { value: 0, title: "No approval" },
                { value: 1, title: "Level 1" },
                { value: 2, title: "Level 2" },
                { value: 3, title: "Level 3" }
            ].forEach(function (choice) {
                var option = element("option", "", choice.title);
                option.value = String(choice.value);
                option.selected = Number(stored[mesh.id]) === choice.value ||
                    (!Object.prototype.hasOwnProperty.call(stored, mesh.id) && choice.value === 1);
                select.appendChild(option);
            });
            levels[mesh.id] = Number(select.value);
            select.onchange = function () { levels[mesh.id] = Number(select.value); };
            cell.appendChild(select);
        });

        if (!(value.meshes || []).length) {
            var empty = tableBody.insertRow().insertCell();
            empty.colSpan = 2;
            empty.textContent = "No MeshCentral device groups are visible to this administrator.";
        }

        wrapper.appendChild(table);
        section.appendChild(wrapper);

        var actions = element("div", "mc-admin-inline-actions");
        var button = element("button", "mc-admin-primary", "Save Mesh group levels");
        button.type = "button";
        var status = element("span", "mc-admin-save-status");
        button.onclick = function () {
            button.disabled = true;
            status.className = "mc-admin-save-status";
            status.textContent = "Saving...";
            save(settings, levels).then(function () {
                settings.targetMeshApprovalLevels = JSON.parse(JSON.stringify(levels));
                status.textContent = "Saved";
            }).catch(function (error) {
                status.className = "mc-admin-save-status mc-admin-error";
                status.textContent = error.message || String(error);
            }).finally(function () { button.disabled = false; });
        };
        actions.appendChild(button);
        actions.appendChild(status);
        section.appendChild(actions);
        body.appendChild(section);
    }

    function enhance() {
        var panel = content.querySelector(".mc-admin-settings-panel");
        if (!panel) return;
        var card = moveRequestsCard(panel);
        if (!card) return;
        load().then(function (value) { addEditor(card, value); }).catch(function (error) {
            var body = card.querySelector(":scope > .mc-admin-card-body") || card;
            if (!body.querySelector(".mc-move-mesh-levels-error")) {
                body.appendChild(element("div", "mc-admin-error mc-move-mesh-levels-error", error.message || String(error)));
            }
        });
    }

    new MutationObserver(function () { window.setTimeout(enhance, 0); })
        .observe(content, { childList: true, subtree: true });
    root.addEventListener("click", function () { window.setTimeout(enhance, 0); });
    enhance();
}());