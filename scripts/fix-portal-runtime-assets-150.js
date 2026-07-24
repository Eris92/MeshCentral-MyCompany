"use strict";

var fs = require("fs");
var path = require("path");
var root = path.resolve(__dirname, "..");

function file(name) { return path.join(root, name); }
function read(name) { return fs.readFileSync(file(name), "utf8"); }
function write(name, value) { fs.writeFileSync(file(name), value, "utf8"); }
function replace(name, from, to) {
    var value = read(name);
    if (value.indexOf(from) < 0) throw new Error("Missing expected text in " + name + ": " + from);
    write(name, value.replace(from, to));
}

replace("public/portal/standalone/scripts/core.js",
    'endpoint.searchParams.set("pin", "SirkPlatform");',
    'endpoint.searchParams.set("pin", "SIRKPortal");');

replace("plugin-main-standalone.js",
    '"vendor/sirk-portal/sirk-portal.css": "vendor/sirk-portal.css",',
    '"vendor/sirk-portal/sirk-portal.css": "vendor/sirk-portal.css",\n    "vendor/sirk-portal/portal-ui-contract.css": "vendor/portal-ui-contract.css",');

write("public/portal/vendor/portal-ui-contract.css", [
    "/* Compatibility endpoint for the shared SIRK Portal visual contract. */",
    "#sirkPortalRoot .mc-portal-view-surface{background:var(--sirk-panel,#fff);color:var(--sirk-text,#172033)}",
    "#sirkPortalRoot .mc-portal-card{border:1px solid var(--sirk-border,#dce3ec);border-radius:8px;background:var(--sirk-panel,#fff)}",
    "#sirkPortalRoot .mc-portal-button{font:inherit;cursor:pointer}",
    ""
].join("\n"));

var test = [
    '"use strict";',
    '',
    'var assert = require("assert");',
    'var fs = require("fs");',
    'var path = require("path");',
    'var root = path.join(__dirname, "..");',
    'var core = fs.readFileSync(path.join(root, "public/portal/standalone/scripts/core.js"), "utf8");',
    'var server = fs.readFileSync(path.join(root, "plugin-main-standalone.js"), "utf8");',
    '',
    'assert.ok(core.indexOf(\'searchParams.set("pin", "SIRKPortal")\') >= 0, "Standalone Portal must use the canonical plugin pin.");',
    'assert.ok(core.indexOf(\'searchParams.set("pin", "SirkPlatform")\') < 0, "Legacy Portal pin must not remain.");',
    'assert.ok(server.indexOf(\'"vendor/sirk-portal/portal-ui-contract.css": "vendor/portal-ui-contract.css"\') >= 0, "Portal UI contract asset must be routed as CSS.");',
    'assert.ok(fs.existsSync(path.join(root, "public/portal/vendor/portal-ui-contract.css")), "Portal UI contract stylesheet must exist.");',
    'console.log("Portal runtime assets: OK");',
    ''
].join("\n");
write("test/portal-runtime-assets.test.js", test);

var pkg = JSON.parse(read("package.json"));
pkg.version = "1.5.150";
if (pkg.scripts && pkg.scripts.test.indexOf("test/portal-runtime-assets.test.js") < 0) {
    pkg.scripts.test = pkg.scripts.test.replace("node test/security.test.js", "node test/portal-runtime-assets.test.js && node test/security.test.js");
}
write("package.json", JSON.stringify(pkg, null, 2) + "\n");

var config = JSON.parse(read("config.json"));
config.version = "1.5.150";
write("config.json", JSON.stringify(config, null, 2) + "\n");

var readme = read("README.md").replace(/^# SIRK Management Platform [^\r\n]+/m, "# SIRK Management Platform 1.5.150");
write("README.md", readme);

var changelog = read("changelog.md");
if (changelog.indexOf("## 1.5.150") < 0) {
    changelog = "## 1.5.150\n\n- Fixed the standalone Portal bootstrap pin to use `SIRKPortal`.\n- Added the missing `portal-ui-contract.css` asset route with a CSS MIME type.\n- Added regression coverage for runtime Portal asset URLs.\n\n" + changelog;
}
write("changelog.md", changelog);

var history = JSON.parse(read("version-history.json"));
if (Array.isArray(history)) {
    history.unshift({ version: "1.5.150", date: "2026-07-24", changes: ["Fix standalone Portal plugin pin", "Serve Portal UI contract stylesheet with CSS MIME type"] });
} else if (history && Array.isArray(history.versions)) {
    history.versions.unshift({ version: "1.5.150", date: "2026-07-24", changes: ["Fix standalone Portal plugin pin", "Serve Portal UI contract stylesheet with CSS MIME type"] });
}
write("version-history.json", JSON.stringify(history, null, 2) + "\n");

console.log("Prepared SIRK Portal 1.5.150 runtime asset hotfix.");
