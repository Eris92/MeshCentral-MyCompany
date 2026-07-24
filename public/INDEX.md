# Frontend index

Czytaj ten indeks dla zadań dotyczących samodzielnego Portalu, integracji z natywnym MeshCentral, wspólnego UI i rendererów modułów.

## Warstwy

| Warstwa | Katalog | Główne zastosowanie |
|---|---|---|
| standalone Portal | `public/portal/` | shell, navigation, login, workspace i portalowe style |
| native adapter | `public/native/` | launcher, device tabs i integracja z GUI MeshCentral |
| shared runtime/UI | `public/shared/` | core, runtime, shell, ikony, style i komponenty |
| renderery modułów | `public/modules/` | pojedynczy renderer każdego modułu |

## Standalone Portal

Zacznij od:

```text
public/portal/standalone/index.html
public/portal/standalone/scripts/core.js
public/portal/standalone/scripts/app.js
public/portal/standalone/scripts/navigation.js
```

Dla logowania użyj `login.html`, `scripts/login.js` i `styles/login.css`.  
Dla sesji urządzeń użyj `scripts/device-workspace.js` oraz `public/native/device-tabs.*`.

## Native UI

Zacznij od mapy assetów w `admin.js`, a następnie wybierz:

```text
public/native/mesh-plugin-core.js
public/native/portal-launcher.js
public/native/device-tabs.js
public/native/device-tabs.css
public/native/approval.css
```

## Shared UI

```text
public/shared/core.js
public/shared/runtime.js
public/shared/module-shell.js
public/shared/icon-registry.js
public/shared/styles/
public/shared/ui/
```

Nie twórz ponownie `public/shared-ui/` ani płaskich plików aplikacyjnych w `public/`.

## Renderery modułów

| Moduł | Renderer |
|---|---|
| Approvals | `public/modules/approvals/index.js` |
| Automation | `public/modules/automation/index.js` |
| Commands | `public/modules/commands/index.js` |
| Jira | `public/modules/jira/index.js` |
| Device Transfers | `public/modules/move-requests/index.js` |
| Security | `public/modules/security/index.js` |

Dla jednego modułu może istnieć tylko jeden renderer.

## Weryfikacja

Przed zmianą potwierdź loader w `admin.js` albo `plugin-main-standalone.js`. Następnie wybierz test z `test/INDEX.md`. Dla zmian wspólnego runtime, UI contract lub loadera uruchom pełne `npm test`.
