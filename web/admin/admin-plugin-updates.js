(function () {
    "use strict";

    if (window.__sirkPlatformPluginUpdatesLoaded) return;
    window.__sirkPlatformPluginUpdatesLoaded = true;

    var root = document.getElementById("sirk-platform-admin");
    var content = document.getElementById("sirk-platform-admin-content");
    if (!root || !content) return;

    var state = { loading: false, plugins: [] };

    function pin() { return root.getAttribute("data-plugin") || "SirkPlatform"; }

    function parseResponse(response) {
        return response.text().then(function (text) {
            var value;
            try { value = JSON.parse(text || "{}"); }
            catch (error) { throw new Error(text || ("HTTP " + response.status)); }
            if (!response.ok || value.ok === false) throw new Error(value.error || ("HTTP " + response.status));
            return value;
        });
    }

    function getState() {
        var url = new URL("pluginadmin.ashx", window.location.href);
        url.searchParams.set("pin", pin());
        url.searchParams.set("action", "plugin-state");
        return fetch(url.href, { credentials: "same-origin", cache: "no-store" }).then(parseResponse);
    }

    function postUpdate(plugin) {
        var body = new URLSearchParams();
        body.set("payload", JSON.stringify({ operation: "update", id: plugin.id }));
        var url = new URL("pluginadmin.ashx", window.location.href);
        url.searchParams.set("pin", pin());
        url.searchParams.set("action", "plugin-operation");
        return fetch(url.href, {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
            body: body.toString()
        }).then(parseResponse);
    }

    function statusHost() { return content.querySelector(".mc-admin-save-status"); }

    function setStatus(text, error) {
        var host = statusHost();
        if (!host) return;
        host.className = error ? "mc-admin-save-status mc-admin-error" : "mc-admin-save-status";
        host.textContent = text || "";
    }

    function pluginByShortName(shortName) {
        shortName = String(shortName || "").toLowerCase();
        return state.plugins.find(function (plugin) {
            return String(plugin.shortName || "").toLowerCase() === shortName;
        });
    }

    function badge(text, kind) {
        var value = document.createElement("span");
        value.className = "mc-admin-state " + kind;
        value.textContent = text;
        return value;
    }

    function ensureStyle() {
        if (document.getElementById("sirk-platform-plugin-update-style")) return;
        var style = document.createElement("style");
        style.id = "sirk-platform-plugin-update-style";
        style.textContent = [
            ".mc-admin-plugin-update-button{margin-right:8px;white-space:nowrap}",
            ".mc-admin-plugin-version-cell small{display:block;margin-top:3px;color:#657187}",
            ".mc-admin-state.update{background:#dcfce7;color:#166534}",
            ".mc-admin-state.current{background:#e0f2fe;color:#075985}",
            ".mc-admin-state.warning{background:#fef3c7;color:#92400e}",
            ".mc-admin-state.unknown{background:#e5e7eb;color:#374151}"
        ].join("");
        (document.head || document.documentElement).appendChild(style);
    }

    function ensureToolbarButton() {
        var heading = content.querySelector(".mc-admin-section-header h3");
        if (!heading || String(heading.textContent || "").trim() !== "Wtyczki") return;
        var toolbar = content.querySelector(".mc-admin-toolbar");
        if (!toolbar || toolbar.querySelector("[data-plugin-update-check]")) return;
        var button = document.createElement("button");
        button.type = "button";
        button.className = "mc-admin-secondary";
        button.setAttribute("data-plugin-update-check", "1");
        button.textContent = "Sprawdź aktualizacje";
        button.onclick = function () { refresh(button); };
        toolbar.appendChild(button);
    }

    function ensureHeader(table) {
        var row = table && table.querySelector("thead tr");
        if (!row || row.querySelector("[data-plugin-update-header]")) return;
        var action = row.lastElementChild;
        var latest = document.createElement("th");
        latest.setAttribute("data-plugin-update-header", "version");
        latest.textContent = "Dostępna";
        var status = document.createElement("th");
        status.setAttribute("data-plugin-update-header", "status");
        status.textContent = "Aktualizacja";
        row.insertBefore(latest, action);
        row.insertBefore(status, action);
    }

    function updateRow(row) {
        var shortNameNode = row.querySelector(".mc-admin-plugin-name small");
        if (!shortNameNode) return;
        var plugin = pluginByShortName(shortNameNode.textContent);
        if (!plugin) return;
        var actionCell = row.querySelector(".mc-admin-table-actions");
        if (!actionCell) return;
        var signature = [plugin.version, plugin.availableVersion, plugin.updateStatus, plugin.updateError, plugin.updateAvailable, plugin.updateCompatible].join("|");
        if (row.getAttribute("data-plugin-update-signature") === signature) return;
        row.setAttribute("data-plugin-update-signature", signature);

        var versionCell = row.querySelector("[data-plugin-update-cell=version]");
        var statusCell = row.querySelector("[data-plugin-update-cell=status]");
        if (!versionCell) {
            versionCell = document.createElement("td");
            versionCell.className = "mc-admin-plugin-version-cell";
            versionCell.setAttribute("data-plugin-update-cell", "version");
            row.insertBefore(versionCell, actionCell);
        }
        if (!statusCell) {
            statusCell = document.createElement("td");
            statusCell.setAttribute("data-plugin-update-cell", "status");
            row.insertBefore(statusCell, actionCell);
        }

        versionCell.textContent = plugin.availableVersion || "—";
        statusCell.innerHTML = "";
        statusCell.title = "";
        if (plugin.updateStatus === "available") statusCell.appendChild(badge("Dostępna", "update"));
        else if (plugin.updateStatus === "current") statusCell.appendChild(badge("Aktualna", "current"));
        else if (plugin.updateStatus === "incompatible") statusCell.appendChild(badge("Niezgodna", "warning"));
        else if (plugin.updateStatus === "error") {
            statusCell.appendChild(badge("Błąd", "warning"));
            statusCell.title = plugin.updateError || "Nie udało się sprawdzić wersji.";
        } else statusCell.appendChild(badge("Brak danych", "unknown"));

        var old = actionCell.querySelector("[data-plugin-update-button]");
        if (old) old.remove();
        if (plugin.updateAvailable && plugin.updateCompatible) {
            var update = document.createElement("button");
            update.type = "button";
            update.className = "mc-admin-primary mc-admin-plugin-update-button";
            update.setAttribute("data-plugin-update-button", "1");
            update.textContent = "Aktualizuj";
            update.onclick = function () {
                if (!window.confirm("Zaktualizować " + plugin.name + " z " + plugin.version + " do " + plugin.availableVersion + "? Przed aktualizacją zostanie utworzony backup.")) return;
                update.disabled = true;
                setStatus("Aktualizowanie " + plugin.name + "…", false);
                postUpdate(plugin).then(function (result) {
                    var backup = result.result && result.result.backupPath;
                    setStatus("Zaktualizowano do " + (result.result && result.result.version || plugin.availableVersion) + (backup ? ". Backup: " + backup : "."), false);
                    state.plugins = result.plugins || [];
                    row.removeAttribute("data-plugin-update-signature");
                    enhanceTable();
                }).catch(function (error) {
                    setStatus(error.message || String(error), true);
                    update.disabled = false;
                });
            };
            actionCell.insertBefore(update, actionCell.firstChild);
        }
    }

    function enhanceTable() {
        ensureStyle();
        ensureToolbarButton();
        var table = content.querySelector(".mc-admin-plugin-table");
        if (!table) return;
        ensureHeader(table);
        table.querySelectorAll("tbody tr").forEach(updateRow);
    }

    function refresh(button) {
        if (state.loading) return;
        state.loading = true;
        if (button) button.disabled = true;
        setStatus("Sprawdzanie aktualizacji…", false);
        getState().then(function (result) {
            state.plugins = result.plugins || [];
            content.querySelectorAll(".mc-admin-plugin-table tbody tr").forEach(function (row) { row.removeAttribute("data-plugin-update-signature"); });
            setStatus("Sprawdzanie zakończone.", false);
            enhanceTable();
        }).catch(function (error) {
            setStatus(error.message || String(error), true);
        }).then(function () {
            state.loading = false;
            if (button) button.disabled = false;
        });
    }

    var observer = new MutationObserver(function () {
        ensureToolbarButton();
        if (state.plugins.length) enhanceTable();
        else if (content.querySelector(".mc-admin-plugin-table") && !state.loading) refresh();
    });
    observer.observe(content, { childList: true, subtree: true });
    ensureToolbarButton();
    if (content.querySelector(".mc-admin-plugin-table")) refresh();
}());
