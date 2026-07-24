(function () {
    "use strict";

    var root = document.getElementById("sirk-platform-admin");
    var content = document.getElementById("sirk-platform-admin-content");
    if (!root || !content || window.__sirkPlatformMoveMeshLevels) return;
    window.__sirkPlatformMoveMeshLevels = true;

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
        url.searchParams.set("pin", root.getAttribute("data-plugin") || "SirkPlatform");
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

    function normalizeLevels(value) {
        if (value === 0 || value === "0") return [];
        if (!Array.isArray(value)) value = value == null ? [] : [value];
        return value.map(Number).filter(function (level, index, all) {
            return level >= 1 && level <= 3 && all.indexOf(level) === index;
        }).sort();
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
        return fetch(target.url, { method: target.method, credentials: "same-origin", cache: "no-store" })
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
            cache: "no-store",
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
            "Select the full approval chain required when a device is moved into each MeshCentral device group. No selection means no approval. Groups without an explicit saved value default to Level 1."
        ));

        var wrapper = element("div", "mc-move-mesh-levels-table-wrap");
        var table = element("table", "mc-move-mesh-levels-table");
        var head = table.createTHead().insertRow();
        head.appendChild(element("th", "", "MeshCentral group"));
        head.appendChild(element("th", "", "No approval"));
        head.appendChild(element("th", "", "Level 1"));
        head.appendChild(element("th", "", "Level 2"));
        head.appendChild(element("th", "", "Level 3"));
        var tableBody = table.createTBody();

        (value.meshes || []).forEach(function (mesh) {
            var row = tableBody.insertRow();
            row.appendChild(element("td", "", mesh.name || mesh.id));

            var hasStored = Object.prototype.hasOwnProperty.call(stored, mesh.id);
            var selected = hasStored ? normalizeLevels(stored[mesh.id]) : [1];
            levels[mesh.id] = selected.slice();

            var none = element("input");
            none.type = "checkbox";
            none.checked = selected.length === 0;
            row.insertCell().appendChild(none);

            var boxes = [];
            [1, 2, 3].forEach(function (level) {
                var box = element("input");
                box.type = "checkbox";
                box.value = String(level);
                box.checked = selected.indexOf(level) >= 0;
                boxes.push(box);
                row.insertCell().appendChild(box);
            });

            function sync() {
                if (none.checked) {
                    boxes.forEach(function (box) { box.checked = false; });
                    levels[mesh.id] = [];
                    return;
                }
                var selectedLevels = boxes.filter(function (box) { return box.checked; })
                    .map(function (box) { return Number(box.value); });
                if (!selectedLevels.length) {
                    none.checked = true;
                    levels[mesh.id] = [];
                } else {
                    levels[mesh.id] = selectedLevels;
                }
            }

            none.onchange = function () {
                if (!none.checked && !boxes.some(function (box) { return box.checked; })) {
                    boxes[0].checked = true;
                }
                sync();
            };
            boxes.forEach(function (box) {
                box.onchange = function () {
                    if (box.checked) none.checked = false;
                    sync();
                };
            });
        });

        if (!(value.meshes || []).length) {
            var empty = tableBody.insertRow().insertCell();
            empty.colSpan = 5;
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