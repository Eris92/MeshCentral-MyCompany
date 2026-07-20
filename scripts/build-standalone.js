"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const sourcesRoot = process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, ".build-sources");
const embeddedRoot = path.join(root, "embedded");

const modules = [
  { key: "scripts", repo: "MeshCentral-MyScripts", expected: "myscripts" },
  { key: "commands", repo: "MeshCentral-MyCommands", expected: "mycommands" },
  { key: "approvals", repo: "MeshCentral-ApprovalCenter", expected: "approvalcenter" },
  { key: "move", repo: "MeshCentral-MoveRequests", expected: "moverequest" }
];

function copyTree(source, target) {
  fs.mkdirSync(target, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    if ([".git", "node_modules", "data", "logs"].includes(entry.name)) continue;
    const from = path.join(source, entry.name);
    const to = path.join(target, entry.name);
    if (entry.isDirectory()) copyTree(from, to);
    else if (entry.isFile()) fs.copyFileSync(from, to);
  }
}

function walk(directory, visitor) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(full, visitor);
    else if (entry.isFile()) visitor(full);
  }
}

function patchJavascript(directory, shortName, moduleKey) {
  walk(directory, (file) => {
    if (!file.toLowerCase().endsWith(".js")) return;
    let text = fs.readFileSync(file, "utf8");
    const original = text;
    const escaped = shortName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    text = text.replace(new RegExp(`endpoint\\.searchParams\\.set\\([\"']pin[\"'],\\s*[\"']${escaped}[\"']\\);`, "g"),
      `endpoint.searchParams.set("pin", "mycompany"); endpoint.searchParams.set("module", "${moduleKey}");`);
    text = text.replace(new RegExp(`core\\.assetUrl\\([\"']${escaped}[\"'],\\s*`, "g"),
      `window.MyCompanyAssetUrl("${moduleKey}", `);
    text = text.replace(new RegExp(`MeshPluginCore\\.assetUrl\\([\"']${escaped}[\"'],\\s*`, "g"),
      `window.MyCompanyAssetUrl("${moduleKey}", `);
    if (text !== original) fs.writeFileSync(file, text, "utf8");
  });
}

fs.rmSync(embeddedRoot, { recursive: true, force: true });
fs.mkdirSync(embeddedRoot, { recursive: true });
const manifest = [];

for (const item of modules) {
  const source = path.join(sourcesRoot, item.repo);
  if (!fs.existsSync(source)) throw new Error(`Missing source repository: ${source}`);
  const configPath = path.join(source, "config.json");
  const config = JSON.parse(fs.readFileSync(configPath, "utf8").replace(/^\uFEFF/, ""));
  const shortName = String(config.shortName || item.expected);
  const target = path.join(embeddedRoot, shortName);
  copyTree(source, target);
  patchJavascript(target, shortName, item.key);
  const entry = `${shortName}.js`;
  if (!fs.existsSync(path.join(target, entry))) throw new Error(`Missing entry ${entry} in ${item.repo}`);
  manifest.push({ key: item.key, shortName, entry, exportName: shortName, viewmode: Number(config.viewmode) || 0, pageText: config.pageText || config.name || shortName });
}

fs.writeFileSync(path.join(root, "embedded-manifest.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8");
console.log(`Standalone bundle prepared with ${manifest.length} embedded modules.`);
