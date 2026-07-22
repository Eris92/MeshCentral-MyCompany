"use strict";
var assert=require("assert"),fs=require("fs"),path=require("path"),root=path.resolve(__dirname,"..");
function read(p){return fs.readFileSync(path.join(root,p),"utf8");}
var service=read("core/plugin-admin-service.js"),adapter=read("core/plugin-admin-service-rollback.js"),view=read("views/MyCompany.handlebars"),admin=read("MyCompanyAdmin.js");
["backupDirectories(plugin)","before-rollback-","Rollback file swap failed","restartRequired: true","updateDatabasePlugin(plugin._id"].forEach(function(v){assert(service.indexOf(v)>=0,"Missing rollback backend contract: "+v);});
assert(adapter.indexOf('action === "backups"')>=0,"Backup list adapter missing");
assert(admin.indexOf('plugin-admin-service-rollback.js')>=0,"Admin must load rollback adapter");
["Backupy (","Przywróć","operation=operation","Zrestartuj usługę MeshCentral"].forEach(function(v){assert(view.indexOf(v)>=0,"Missing rollback UI contract: "+v);});
console.log("Plugin backup and rollback manager contracts: OK");
