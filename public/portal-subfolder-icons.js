(function () {
    "use strict";

    if (window.__myCompanyPortalSubfolderIconsLoaded) return;
    window.__myCompanyPortalSubfolderIconsLoaded = true;

    function svg(path) {
        return '<svg viewBox="0 0 24 24" aria-hidden="true">' + path + '</svg>';
    }

    var icons = {
        folder: svg('<path d="M3 6h6l2 2h10v11H3V6Z"/>'),
        groups: svg('<circle cx="9" cy="8" r="3"/><circle cx="17" cy="10" r="2.5"/><path d="M3 20c0-4 2.5-7 6-7s6 3 6 7"/><path d="M14 15c3.5 0 6 2 6 5"/>'),
        ou: svg('<rect x="4" y="4" width="6" height="5" rx="1"/><rect x="14" y="15" width="6" height="5" rx="1"/><rect x="4" y="15" width="6" height="5" rx="1"/><path d="M7 9v3h10v3M7 12v3"/>'),
        computer: svg('<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>'),
        policy: svg('<path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-4"/>'),
        users: svg('<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2"/><path d="M3 20c0-4 2.5-7 6-7s6 3 6 7"/><path d="M15 14c3 0 5 2 5 5"/>'),
        server: svg('<rect x="4" y="3" width="16" height="7" rx="1"/><rect x="4" y="14" width="16" height="7" rx="1"/><path d="M8 6h.01M8 17h.01M12 6h5M12 17h5"/>'),
        network: svg('<circle cx="12" cy="5" r="2"/><circle cx="5" cy="18" r="2"/><circle cx="19" cy="18" r="2"/><path d="M12 7v5M12 12 6 16M12 12l6 4"/>'),
        settings: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/>')
    };

    function normalize(value) {
        return String(value || "")
            .trim()
            .toUpperCase()
            .replace(/[._-]+/g, " ")
            .replace(/\s+/g, " ");
    }

    function iconFor(label) {
        var value = normalize(label);
        if (/\b(GROUP|GROUPS|GRUPA|GRUPY)\b/.test(value)) return icons.groups;
        if (/\b(OU|ORGANIZATIONAL UNIT|ORGANIZATIONAL UNITS)\b/.test(value)) return icons.ou;
        if (/\b(PC|COMPUTER|COMPUTERS|DEVICE|DEVICES|WORKSTATION|WORKSTATIONS)\b/.test(value)) return icons.computer;
        if (/\b(POLICY|POLICIES|GPO|POLITYKA|POLITYKI)\b/.test(value)) return icons.policy;
        if (/\b(USER|USERS|ACCOUNTS|UŻYTKOWNICY|UZYTKOWNICY)\b/.test(value)) return icons.users;
        if (/\b(SERVER|SERVERS|SERWER|SERWERY)\b/.test(value)) return icons.server;
        if (/\b(NETWORK|NETWORKS|SIEĆ|SIEC)\b/.test(value)) return icons.network;
        if (/\b(SETTING|SETTINGS|CONFIG|CONFIGURATION)\b/.test(value)) return icons.settings;
        return icons.folder;
    }

    function apply(host) {
        host = host || document;
        var headings = host.querySelectorAll("#sirkPortalRoot .sirk-folder-heading");
        Array.prototype.forEach.call(headings, function (heading) {
            var iconHost = heading.querySelector(".sirk-management-item-icon");
            if (!iconHost) return;

            // A real image from iconData always wins.
            if (iconHost.querySelector("img.sirk-management-folder-image")) return;

            var labelNode = heading.lastElementChild;
            var label = labelNode ? labelNode.textContent : heading.textContent;
            var key = normalize(label);
            if (heading.getAttribute("data-mycompany-subfolder-icon") === key) return;

            iconHost.innerHTML = iconFor(label);
            heading.setAttribute("data-mycompany-subfolder-icon", key);
        });
    }

    function bind() {
        var portal = document.getElementById("sirkPortalRoot");
        if (!portal) return false;
        apply(portal);
        if (!portal.__myCompanySubfolderIconsObserver) {
            portal.__myCompanySubfolderIconsObserver = new MutationObserver(function (records) {
                records.forEach(function (record) {
                    if (record.target && record.target.nodeType === 1) apply(record.target.closest("#sirkPortalRoot") || portal);
                });
            });
            portal.__myCompanySubfolderIconsObserver.observe(portal, { childList: true, subtree: true });
        }
        return true;
    }

    var attempts = 0;
    var timer = window.setInterval(function () {
        attempts++;
        if (bind() || attempts > 120) window.clearInterval(timer);
    }, 100);
}());