# Backend index

Czytaj ten indeks dla zadań dotyczących Node.js, MeshCentral backend, storage, API, permissions i integracji.

## Entry pointy

```text
SIRK-Portal.js
plugin-main-standalone.js
plugin-main.js
server/core/runtime-portal.js
server/core/runtime.js
```

## `server/core/`

| Obszar | Plik |
|---|---|
| runtime i składanie modułów | `runtime.js`, `runtime-portal.js` |
| ustawienia | `settings-store.js` |
| sekrety | `secret-store.js` |
| approval workflow | `approval-service.js` |
| urządzenia | `device-service.js` |
| folder permissions | `folder-access.js` |
| HTTP clients i integracje | `http-client.js`, `integration-service.js` |
| skrypty i wykonanie | `script-admin-service.js`, `server-script-executor.js`, `script-confirmation-library.js` |
| panel admina i plugin management | `server-admin-service.js`, `plugin-admin-service*.js` |
| sesje | `session-persistence.js` |
| współdzielone helpery | `shared.js` |

## `server/modules/`

| Moduł | Katalog |
|---|---|
| Approvals | `approval-center/` |
| Automation | `automation/` |
| Commands | `commands/` |
| Jira Integration | `jira/` |
| Device Transfers | `move-requests/` |
| Portal API | `portal/` |
| Security | `security/` |

Każdy moduł zaczynaj od jego `index.js`. Nie otwieraj pozostałych modułów bez zależności potwierdzonej w runtime.

## Storage

Jedyny katalog danych:

```text
meshcentral-data/sirk-platform-data
```

Nie analizuj ani nie migruj `mycompany-data`.

## Weryfikacja

Dla zmiany backendu wybierz najbliższy test z `test/INDEX.md`, a następnie uruchom `npm test`, jeżeli zmieniono runtime, loader, permissions, storage albo wspólny service.
