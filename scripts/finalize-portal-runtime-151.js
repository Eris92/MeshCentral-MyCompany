"use strict";

var fs = require("fs");
var path = require("path");
var root = path.resolve(__dirname, "..");
function read(name) { return fs.readFileSync(path.join(root, name), "utf8"); }
function write(name, value) { fs.writeFileSync(path.join(root, name), value, "utf8"); }
function replace(name, from, to) {
    var value = read(name);
    if (value.indexOf(from) < 0) throw new Error("Missing expected text in " + name + ": " + from);
    write(name, value.replace(from, to));
}

var server = read("plugin-main-standalone.js");
var marker = '    "shared/icon-registry.js": "../shared/icon-registry.js",';
var manifest = [
'    "vendor/sirk-portal/portal-ui-contract.js": "vendor/portal-ui-contract.js",',
'    "shared-ui/toolbar-config.js": "../shared/ui/toolbar-config.js",',
'    "shared-ui/toolbar-api.js": "../shared/ui/toolbar-api.js",',
'    "shared-ui/toolbar.js": "../shared/ui/toolbar.js",',
'    "shared-ui/tabs.js": "../shared/ui/tabs.js",',
'    "shared-ui/layout.js": "../shared/ui/layout.js",',
'    "shared-ui/settings.js": "../shared/ui/settings.js",',
'    "shared-ui/status-nav.js": "../shared/ui/status-nav.js",',
'    "shared-ui/tree.js": "../shared/ui/tree.js",',
'    "shared-ui/catalog.js": "../shared/ui/catalog.js",',
'    "shared-ui/results.js": "../shared/ui/results.js",',
'    "shared-ui/result-layout.js": "../shared/ui/result-layout.js",',
'    "shared-ui/script-tools.js": "../shared/ui/script-tools.js",',
'    "shared-ui/script-definition-form.js": "../shared/ui/script-definition-form.js",',
'    "shared-ui/confirm-execution-form.js": "../shared/ui/confirm-execution-form.js",',
'    "shared-ui/script-edit-actions.js": "../shared/ui/script-edit-actions.js",',
'    "shared-ui/system-credentials-form.js": "../shared/ui/system-credentials-form.js",',
'    "shared-ui/page.js": "../shared/ui/page.js",',
'    "module-shell.js": "../shared/module-shell.js",',
'    "portal-icon-data.js": "icons.js",',
'    "approvalcenter.js": "../modules/approvals/index.js",',
'    "moverequests.js": "../modules/move-requests/index.js",',
'    "mycommands.js": "../modules/commands/index.js",',
'    "myjira.js": "../modules/jira/index.js",',
'    "defendertools.js": "../modules/security/index.js",',
'    "portal-management.js": "management.js",',
'    "portal-subfolder-icons.js": "subfolder-icons.js",',
'    "portal-folder-collapse.js": "folder-collapse.js",'
].join("\n");
if (server.indexOf('"shared-ui/toolbar-config.js"') < 0) {
    if (server.indexOf(marker) < 0) throw new Error("Standalone asset marker not found");
    server = server.replace(marker, manifest + "\n" + marker);
}
write("plugin-main-standalone.js", server);

write("public/portal/vendor/portal-ui-contract.js", [
    '(function(){',
    '"use strict";',
    'window.SirkPortalUiContract=window.SirkPortalUiContract||{};',
    'window.SirkPortalUiContract.decorate=function(root){',
    '  if(!root)return;',
    '  root.querySelectorAll(".sirk-standalone-card,.mc-shared-card").forEach(function(node){node.classList.add("mc-portal-card");});',
    '  root.querySelectorAll("button").forEach(function(node){if(!node.classList.contains("mc-portal-button"))node.classList.add("mc-portal-button");});',
    '};',
    '})();',
    ''
].join("\n"));

var app = read("public/portal/standalone/scripts/app.js");
app = app.replace('url.searchParams.set("pin", "SirkPlatform");', 'url.searchParams.set("pin", "SIRKPortal");');
app = app.replace('"pluginadmin.ashx?pin=SirkPlatform&module=myscripts&asset=scripts"', '"pluginadmin.ashx?pin=SIRKPortal&module=myscripts&asset=scripts"');
app = app.replace('showError(viewName(view) + ": " + t("moduleDisabled"), JSON.stringify(state || {}, null, 2));', 'showError(viewName(view) + ": " + t("moduleDisabled"));');
app = app.replace('showError("MyScripts: " + t("moduleDisabled"), JSON.stringify(state || {}, null, 2));', 'showError(viewName("management") + ": " + t("moduleDisabled"));');
app = app.replace('showError("Approval Center: " + t("moduleDisabled"), JSON.stringify(moduleState("approvalcenter") || {}, null, 2));', 'showError(viewName("approvals") + ": " + t("moduleDisabled"));');
write("public/portal/standalone/scripts/app.js", app);

var test = [
'"use strict";',
'var assert=require("assert"),fs=require("fs"),path=require("path");',
'var root=path.join(__dirname,"..");',
'var server=fs.readFileSync(path.join(root,"plugin-main-standalone.js"),"utf8");',
'var app=fs.readFileSync(path.join(root,"public/portal/standalone/scripts/app.js"),"utf8");',
'var required=["shared-ui/toolbar-config.js","shared-ui/toolbar-api.js","shared-ui/toolbar.js","shared-ui/tabs.js","shared-ui/layout.js","shared-ui/settings.js","shared-ui/status-nav.js","shared-ui/page.js","shared-ui/tree.js","shared-ui/catalog.js","shared-ui/results.js","shared-ui/result-layout.js","shared-ui/script-tools.js","shared-ui/script-definition-form.js","shared-ui/confirm-execution-form.js","shared-ui/script-edit-actions.js","shared-ui/system-credentials-form.js","module-shell.js","approvalcenter.js","moverequests.js","mycommands.js","myjira.js","defendertools.js","portal-management.js","portal-subfolder-icons.js","portal-folder-collapse.js","vendor/sirk-portal/portal-ui-contract.js"];',
'required.forEach(function(asset){assert.ok(server.indexOf(JSON.stringify(asset)+":")>=0,"Missing standalone asset route: "+asset);});',
'assert.ok(app.indexOf("pin\\\", \\\"SIRKPortal")>=0||app.indexOf("pin\", \"SIRKPortal")>=0,"Settings and runtime URLs must use SIRKPortal");',
'assert.ok(app.indexOf("pin=SirkPlatform")<0,"Legacy pin must not remain in standalone app");',
'assert.ok(fs.existsSync(path.join(root,"public/portal/vendor/portal-ui-contract.js")),"Portal contract JS must exist");',
'console.log("Standalone Portal complete asset manifest: OK");',
''
].join("\n");
write("test/portal-complete-asset-manifest.test.js", test);

var pkg=JSON.parse(read("package.json"));
pkg.version="1.5.151";
if(pkg.scripts.test.indexOf("portal-complete-asset-manifest.test.js")<0){pkg.scripts.test=pkg.scripts.test.replace("node test/security.test.js","node test/portal-complete-asset-manifest.test.js && node test/security.test.js");}
write("package.json",JSON.stringify(pkg,null,2)+"\n");
var config=JSON.parse(read("config.json"));config.version="1.5.151";write("config.json",JSON.stringify(config,null,2)+"\n");
write("README.md",read("README.md").replace(/^# SIRK Management Platform [^\r\n]+/m,"# SIRK Management Platform 1.5.151"));
var changelog=read("changelog.md");if(changelog.indexOf("## 1.5.151")<0)changelog="## 1.5.151\n\n- Completed the standalone Portal asset manifest for all shared UI components and feature modules.\n- Added the Portal UI contract JavaScript endpoint.\n- Fixed Settings and Management URLs to use `SIRKPortal`.\n- Replaced raw disabled-module JSON with the shared unavailable-state presentation.\n\n"+changelog;write("changelog.md",changelog);
var history=JSON.parse(read("version-history.json"));var item={version:"1.5.151",date:"2026-07-24",changes:["Complete standalone Portal asset manifest","Fix Settings and module runtime URLs","Normalize disabled module states"]};if(Array.isArray(history))history.unshift(item);else if(history&&Array.isArray(history.versions))history.versions.unshift(item);write("version-history.json",JSON.stringify(history,null,2)+"\n");
console.log("Prepared SIRK Portal 1.5.151.");
