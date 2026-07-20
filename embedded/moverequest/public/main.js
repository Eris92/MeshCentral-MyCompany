(function () {
    "use strict";
    window.MoveRequest = window.MoveRequest || {};
    var plugin = window.MoveRequest, core = window.MeshPluginCore;
    plugin.state = plugin.state || { config: null, initializePromise: null, hostNodeId: "", dialogBusy: false };

    plugin.url = function (asset, parameters) {
        var url = new URL(window.MyCompanyAssetUrl("move", asset));
        Object.keys(parameters || {}).forEach(function (key) { if (parameters[key] != null) url.searchParams.set(key, parameters[key]); });
        return url.href;
    };
    plugin.initialize = function () {
        if (plugin.state.initializePromise) return plugin.state.initializePromise;
        plugin.state.initializePromise = core.apiRequest(plugin.url("config")).then(function (config) {
            plugin.state.config = config;
            plugin.scheduleHostButton();
        }).catch(function (error) {
            plugin.state.initializePromise = null;
            if (window.console) window.console.error("Move Request configuration error", error);
            throw error;
        });
        return plugin.state.initializePromise;
    };
    plugin.escapeHtml = function (value) {
        return String(value == null ? "" : value).replace(/[&<>"']/g, function (character) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[character];
        });
    };
    plugin.setHostNodeId = function (nodeId) {
        if (nodeId && typeof nodeId === "object") nodeId = nodeId._id || nodeId.nodeid || nodeId.nodeId || nodeId.dbNodeKey || nodeId.id;
        if (nodeId) plugin.state.hostNodeId = String(nodeId);
    };
    plugin.resolveHostNodeId = function (host) {
        var values = [];
        var add = function (value) {
            if (value && typeof value === "object") value = value._id || value.nodeid || value.nodeId || value.dbNodeKey || value.id;
            value = String(value || "").trim();
            if (value && values.indexOf(value) < 0) values.push(value);
        };
        add(plugin.state.hostNodeId); add(window.currentNodeId); add(window.xxcurrentNodeId); add(window.nodeid); add(window.xxnodeid); add(window.currentNode); add(window.currentDevice);
        var buttons = host ? host.querySelectorAll('input[type="button"],button') : [];
        for (var index = 0; index < buttons.length; index++) {
            var onclick = buttons[index].getAttribute("onclick") || "", match = onclick.match(/runDeviceCmd\(["']([^"']+)["']/);
            if (match) add(match[1]);
        }
        try { var params = new URL(window.location.href).searchParams; add(params.get("gotonode")); add(params.get("nodeid")); } catch (error) { }
        try { return values.length ? decodeURIComponent(values[0]) : ""; } catch (error) { return values[0] || ""; }
    };
    plugin.closeModernDialog = function () {
        var modal = document.getElementById("xxAddAgentModal"), cancel = document.getElementById("idx_dlgCancelButton");
        if (modal && document.activeElement && modal.contains(document.activeElement) && typeof document.activeElement.blur === "function") document.activeElement.blur();
        if (cancel) cancel.click();
    };
    plugin.requestWithTimeout = function (promise, milliseconds) { return Promise.race([promise, new Promise(function (_, reject) { window.setTimeout(function () { reject(new Error("Move Request timed out. Check Approval Center status and try again.")); }, milliseconds); })]); };
    plugin.openHostDialog = function (nodeId) {
        plugin.state.dialogBusy = false;
        var modern = typeof window.setModalContent === "function" && typeof window.showModal === "function" && document.getElementById("xxAddAgentModal");
        var html = modern
            ? '<div id="MoveRequestHostDialog" data-meshcentral-plugin-pin="moverequest" data-meshcentral-plugin-click="Host dialog"><p class="mb-4">The request will be sent for approval before the device is moved.</p><div class="row mb-1"><div class="form-floating mb-3 col-md-12"><select id="MoveRequestHostTarget" class="form-select" disabled><option>Loading groups...</option></select><label class="ms-2" for="MoveRequestHostTarget">Target group</label></div></div><div class="row mb-1"><div class="form-floating mb-3 col-md-12"><textarea id="MoveRequestHostNote" class="form-control" maxlength="2000" placeholder="Requester Note" style="height:100px"></textarea><label class="ms-2" for="MoveRequestHostNote">Requester Note</label></div></div><div id="MoveRequestHostStatus" class="small text-muted" role="status"></div></div>'
            : '<div id="MoveRequestHostDialog" data-meshcentral-plugin-pin="moverequest" data-meshcentral-plugin-click="Host dialog"><p>The request will be sent for approval before the device is moved.</p><label for="MoveRequestHostTarget">Target group</label><select id="MoveRequestHostTarget" style="display:block;margin-top:4px;min-width:280px" disabled><option>Loading groups...</option></select><label for="MoveRequestHostNote" style="display:block;margin-top:8px">Requester Note</label><textarea id="MoveRequestHostNote" rows="4" maxlength="2000" style="display:block;margin-top:4px;min-width:280px"></textarea><div id="MoveRequestHostStatus" style="margin-top:8px" role="status"></div></div>';

        var submitRequest = function () {
            if (plugin.state.dialogBusy) return false;
            var select = document.getElementById("MoveRequestHostTarget"), note = document.getElementById("MoveRequestHostNote"), status = document.getElementById("MoveRequestHostStatus"), ok = document.getElementById("idx_dlgOkButton");
            if (!select || select.disabled || !select.value) { if (status) status.textContent = "Select a target group."; return false; }
            plugin.state.dialogBusy = true;
            if (ok) ok.disabled = true;
            if (status) { status.textContent = "Submitting request..."; status.className = modern ? "small text-muted" : ""; }
            core.logClick("moverequest", "Submit request");
            plugin.requestWithTimeout(core.apiRequest(plugin.url("submit"), {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
                body: "nodeId=" + encodeURIComponent(nodeId) + "&targetMeshId=" + encodeURIComponent(select.value) + "&note=" + encodeURIComponent(note ? note.value : "")
            }), 15000).then(function () {
                plugin.state.dialogBusy = false;
                if (modern) plugin.closeModernDialog();
            }).catch(function (error) {
                plugin.state.dialogBusy = false;
                if (modern) {
                    if (ok) ok.disabled = false;
                    if (status) { status.textContent = error.message || "Could not submit request."; status.className = "small text-danger"; }
                } else if (typeof window.setDialogMode === "function") {
                    window.setDialogMode(2, "Move Request", 1, null, '<div style="color:#b00020">' + plugin.escapeHtml(error.message || "Could not submit request.") + "</div>");
                }
            });
            return false;
        };

        if (modern) {
            window.setModalContent("xxAddAgent", "Move Request", html);
            window.showModal("xxAddAgentModal", "idx_dlgOkButton", submitRequest);
            var cancelButton = document.getElementById("idx_dlgCancelButton"); if (cancelButton) { cancelButton.textContent = "Cancel"; cancelButton.className = "btn btn-secondary"; }
            var modernOk = document.getElementById("idx_dlgOkButton");
            if (modernOk) modernOk.disabled = true;
        } else if (typeof window.setDialogMode === "function") {
            window.setDialogMode(2, "Move Request", 3, function (confirmed) { if (confirmed) submitRequest(); }, html);
            var classicOk = document.getElementById("idx_dlgOkButton");
            if (classicOk) classicOk.disabled = true;
        } else return;

        var select = document.getElementById("MoveRequestHostTarget"), status = document.getElementById("MoveRequestHostStatus"), ok = document.getElementById("idx_dlgOkButton");
        if (!select || !status) return;
        if (!nodeId) { status.textContent = "Could not identify the current device."; if (modern) status.className = "small text-danger"; return; }
        if (!plugin.state.config || plugin.state.config.approvalAvailable !== true) {
            status.innerHTML = 'Approval Center is required. <a href="' + plugin.escapeHtml(plugin.state.config && plugin.state.config.approvalCenterInstallUrl || "#") + '" target="_blank" rel="noopener">Open installation URL</a>.';
            if (modern) status.className = "small text-danger";
            return;
        }
        status.textContent = "Loading groups...";
        core.apiRequest(plugin.url("groups", { nodeId: nodeId })).then(function (result) {
            select.innerHTML = "";
            (result.groups || []).filter(function (group) { return group.id !== result.currentMeshId; }).forEach(function (group) {
                var option = document.createElement("option"); option.value = group.id; option.textContent = group.name; select.appendChild(option);
            });
            select.disabled = select.options.length === 0;
            if (ok) ok.disabled = select.disabled;
            status.textContent = select.disabled ? "No target group is available." : "";
            if (modern) status.className = select.disabled ? "small text-danger" : "small text-muted";
        }).catch(function (error) {
            status.textContent = error.message || "Could not load groups.";
            if (modern) status.className = "small text-danger";
        });
    };
    plugin.handleHostButtonClick = function (event) {
        if (event && event.preventDefault) event.preventDefault();
        if (event && event.stopPropagation) event.stopPropagation();
        var host = document.getElementById("p10html") || document.getElementById("p10");
        plugin.openHostDialog(plugin.resolveHostNodeId(host));
        return false;
    };
    plugin.installHostButton = function () {
        var host = document.getElementById("p10html") || document.getElementById("p10");
        if (!host) return false;
        var existing = document.getElementById("MoveRequestHostButton");
        if (existing && host.contains(existing)) {
            if (String(existing.tagName).toLowerCase() === "input") existing.value = "Move Request"; else existing.textContent = "Move Request";
            existing.disabled = false; existing.removeAttribute("onclick"); existing.removeAttribute("onmouseup"); existing.onclick = plugin.handleHostButtonClick;
            return true;
        }
        if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
        var buttons = host.querySelectorAll('input[type="button"],button'), anchor = null, fallback = null;
        for (var index = 0; index < buttons.length; index++) {
            var value = String(buttons[index].value || buttons[index].textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
            fallback = buttons[index];
            if (value === "share" || value === "udostępnij" || value === "udostepnij") { anchor = buttons[index]; break; }
            if (!anchor && (value === "chat" || value === "czat")) anchor = buttons[index];
        }
        anchor = anchor || fallback;
        if (!anchor || !anchor.parentNode) return false;
        var button = anchor.cloneNode(false);
        button.id = "MoveRequestHostButton"; button.type = "button";
        if (String(button.tagName).toLowerCase() === "input") button.value = "Move Request"; else button.textContent = "Move Request";
        button.title = "Submit a device move request";
        button.setAttribute("data-meshcentral-plugin-pin", "moverequest");
        button.setAttribute("data-meshcentral-plugin-click", "Host action");
        button.removeAttribute("onclick"); button.removeAttribute("onmouseup"); button.onclick = plugin.handleHostButtonClick;
        anchor.parentNode.insertBefore(button, anchor.nextSibling);
        return true;
    };
    plugin.scheduleHostButton = function () {
        var install = function () { plugin.installHostButton(); };
        [0, 100, 400, 1000, 2000, 4000].forEach(function (delay) { window.setTimeout(install, delay); });
    };
}());
