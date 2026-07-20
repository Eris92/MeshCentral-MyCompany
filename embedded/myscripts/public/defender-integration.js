(function () {
    "use strict";

    var plugin = window.MyScripts;
    if (!plugin || plugin.defenderIntegrationInstalled) return;
    plugin.defenderIntegrationInstalled = true;

    var originalBuildSettings = plugin.buildSettings;

    function sectionTitle(section) {
        var header = section && section.querySelector(".myscripts-settings-header");
        if (!header) return "";
        var spans = header.querySelectorAll("span");
        return spans.length ? String(spans[spans.length - 1].textContent || "").trim() : String(header.textContent || "").trim();
    }

    function configureDefenderSection(panel) {
        var sections = panel ? panel.querySelectorAll(".myscripts-settings-section") : [];
        Array.prototype.forEach.call(sections, function (section) {
            if (sectionTitle(section) !== "Entra credentials") return;

            var header = section.querySelector(".myscripts-settings-header");
            var spans = header && header.querySelectorAll("span");
            if (spans && spans.length) spans[spans.length - 1].textContent = "Microsoft Defender / Graph";

            section.setAttribute("data-myscripts-defender-settings", "1");
            var content = section.querySelector(".myscripts-settings-content > div") || section.querySelector(".myscripts-settings-content");
            if (!content || content.querySelector(".myscripts-defender-note")) return;

            var note = document.createElement("p");
            note.className = "myscripts-defender-note";
            note.textContent = "Used by scripts in the Defender folder. Configure Tenant ID, application Client ID and Client secret. The Entra application requires Microsoft Graph application permission SecurityIncident.Read.All with admin consent.";
            var firstNote = content.querySelector("p");
            if (firstNote && firstNote.nextSibling) content.insertBefore(note, firstNote.nextSibling);
            else content.insertBefore(note, content.firstChild);
        });
    }

    plugin.buildSettings = function (panel) {
        originalBuildSettings.call(plugin, panel);
        configureDefenderSection(panel);
    };
}());
