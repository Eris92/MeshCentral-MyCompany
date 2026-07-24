(function () {
    "use strict";
    window.SharedSettings = {
        section: function (title, content, expanded) {
            var root = document.createElement("section"); root.className = "mc-shared-settings-section";
            var header = document.createElement("button"); header.type = "button"; header.className = "mc-shared-settings-header"; header.textContent = title;
            var panel = document.createElement("div"); panel.className = "mc-shared-settings-content"; panel.hidden = expanded !== true;
            if (content) panel.appendChild(content); header.onclick = function () { panel.hidden = !panel.hidden; };
            root.appendChild(header); root.appendChild(panel); return root;
        },
        form: function (title) { var form = document.createElement("div"); form.className = "mc-shared-settings-form"; if (title) { var h = document.createElement("h3"); h.textContent = title; form.appendChild(h); } return form; }
    };
}());
