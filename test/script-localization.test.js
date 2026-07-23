"use strict";

var assert = require("assert");
var fs = require("fs");
var os = require("os");
var path = require("path");
var createScriptLibrary = require("../server/core/script-library.js").createScriptLibrary;

var root = fs.mkdtempSync(path.join(os.tmpdir(), "sirkPlatform-locales-"));
try {
    var folder = path.join(root, "Reports");
    fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(path.join(folder, "Reports.menu"), "#PL Raporty | Opis folderu\n#EN Reports | Folder description\n", "utf8");
    fs.writeFileSync(path.join(folder, "Users.ps1"), [
        "#PL Użytkownicy | Polski opis",
        "#EN Users | English description",
        "# VariableSelectRequiredPL: $Limit=20, Limit | Liczba rekordów |20=20 użytkowników|50=50 użytkowników",
        "# VariableSelectRequiredEN: $Limit=20, Limit | Number of records |20=20 users|50=50 users",
        "Write-Output $Limit"
    ].join("\n"), "utf8");

    var library = createScriptLibrary({ fs: fs, path: path, root: root, allowWrite: true });
    var script = library.getScript("Reports/Users.ps1", true);
    assert.strictEqual(script.locales.pl.label, "Użytkownicy");
    assert.strictEqual(script.locales.en.description, "English description");
    assert.strictEqual(script.variables[0].labels.pl, "Limit");
    assert.strictEqual(script.variables[0].descriptions.en, "Number of records");
    assert.strictEqual(script.variables[0].options[0].labels.pl, "20 użytkowników");

    var treeFolder = library.getTree().children[0];
    assert.strictEqual(treeFolder.locales.pl.label, "Raporty");
    assert.strictEqual(treeFolder.locales.en.description, "Folder description");

    var definition = library.getDefinition("Reports/Users.ps1");
    assert.strictEqual(definition.variables[0].values.pl.indexOf("Liczba rekordów") >= 0, true);
    library.saveDefinition("Reports/Users.ps1", definition);
    var saved = fs.readFileSync(path.join(folder, "Users.ps1"), "utf8");
    assert.ok(saved.indexOf("#PL Użytkownicy | Polski opis") >= 0);
    assert.ok(saved.indexOf("# VariableSelectRequiredEN:") >= 0);
    console.log("Script localization checks passed.");
} finally {
    fs.rmSync(root, { recursive: true, force: true });
}
