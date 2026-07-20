# Changelog

## 0.7.0

- Rebuilt the plugin entry and admin panel using the clean MeshCentral structure: `mycompany.js`, `admin.js` and `views/admin.handlebars`.
- Moved UI visibility controls into a dedicated `Settings` tab in the admin panel.
- Kept `Overview` and `Debug` as separate admin tabs.
- Removed `Settings` from the embedded module navigation.
- Removed the My Company menu entry while keeping the My Scripts entry as the module access point.
- Kept My Commands without a main or side menu entry; only the device-page Commands option remains.

## 0.5.9

- Removed the configurable module-tab visibility system introduced in 0.5.8.
- Restored the previous stable My Company navigation behavior.
- Restored the My Company menu entry instead of deleting it from MeshCentral menus.
- Kept the native admin diagnostics and Debug panel.

## 0.5.7

- Added a native MeshCentral admin panel for My Company.
- Added module status cards and server/browser diagnostics.
- Fixed empty-module admin requests returning JSON errors.

## 0.5.5

- Fixed serialized embedded startup functions and Approval Center initialization.

## 0.5.0

- Moved the complete standalone embedded package to the main branch.

## 0.1.1

- Added standalone MeshCentral plugin metadata.
- Assigned unique view mode 106.
- Prevented missing migration source folders from aborting plugin loading.
- Added release and version history metadata.

## 0.1.0

- Initial modular migration scaffold.
