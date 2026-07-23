"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");
var root = path.resolve(__dirname, "..");

function read(relative) {
    return fs.readFileSync(path.join(root, relative), "utf8");
}

var terminal = read("public/portal/standalone/scripts/terminal-connect.js");
var nav = read("public/portal/standalone/scripts/navigation.js");

[
    "Powłoka Admina",
    "PowerShell jako Admin",
    "Powłoka Użytkownika",
    "Użyj PowerShell",
    "Terminal z Zapytaniem Administratora",
    "PowerShell z Zapytaniem Administratora",
    "Terminal z Zapytaniem Użytkownika",
    "PowerShell z Zapytaniem Użytkownika"
].forEach(function (label) {
    assert(terminal.indexOf(label) >= 0, "Missing Terminal option: " + label);
});

["protocol: 1", "protocol: 2", "protocol: 4", "protocol: 5", "requireLogin: true"].forEach(function (contract) {
    assert(terminal.indexOf(contract) >= 0, "Missing native Terminal contract: " + contract);
});

assert(terminal.indexOf("sirk-native-bridge-button-group sirk-terminal-connect-group") >= 0, "Terminal control must use the Desktop split-button style");
assert(terminal.indexOf("win.connectTerminal = wrapped") >= 0, "Native connectTerminal wrapper is missing");
assert(nav.indexOf("portal-terminal-connect.js") >= 0, "Standalone Portal does not load the Terminal enhancer");

new Function(terminal);
new Function(nav);
console.log("Portal Terminal split connect menu: OK");
