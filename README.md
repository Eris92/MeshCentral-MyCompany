# MyCompany 1.3.0

One consolidated MeshCentral plugin. The repository is the complete install source; no legacy plugin code or submodules are loaded.

## Shared UI

All modules use `public/shared-ui/` for tabs, toolbar, layout, status navigation and settings sections. Approval Center is the reference layout. My Commands adds its command actions to the right toolbar group.

## Direct Git installation

Run as Administrator:

```powershell
.\Install-MyCompany-FromGit_RUN.ps1
```

The installer clones `main`, validates it, stops MeshCentral only for the atomic directory swap, removes old plugin files, installs the exact Git checkout and starts MeshCentral again.

# MyCompany 1.2.2

All six modules are built into one plugin. MyScripts is the common UI standard.
See `docs-MIGRATION-COVERAGE.md` for the migrated feature matrix.

The package does not load, register or download the old plugins. Old plugin
directories are read only during the one-time data migration.

Jedna samodzielna wtyczka MeshCentral zawierająca moduły:

- My Scripts;
- My Commands;
- My Jira / Jira Assets;
- Microsoft Defender XDR;
- Approval Center;
- Move Requests.

Nie wymaga i nie ładuje osobnych wtyczek. Włączone moduły są uruchamiane
wewnątrz jednego obiektu pluginu `MyCompany`.

## Instalacja

Skopiuj folder `MyCompany` do:

```text
meshcentral-data/plugins/MyCompany
```

Uruchom ponownie MeshCentral i wykonaj `Ctrl+F5`.

## Migracja 1.1.0

Przy pierwszym uruchomieniu na Windows wykonywany jest bezpieczny import
istniejących ustawień ze starych katalogów, jeżeli nadal istnieją:

- My Scripts: AD, Entra i Jira credentials;
- My Jira: Jira Cloud i Assets settings;
- DefenderTools: Graph credentials i uprawnienia zakładek.

Import kopiuje wyłącznie dane konfiguracyjne. Nie ładuje kodu starych
wtyczek i nie usuwa ich plików. Wynik jest zapisany w
`mycompany-data/legacy-migration.json`.

## Dane trwałe

```text
meshcentral-data/mycompany-data
├── settings.json
├── requests.json
├── secrets.json
├── .secret.key
├── legacy-migration.json
├── defender/
└── scripts/
    ├── MyScripts/
    └── MyCommands/
```

Sekrety nie są wysyłane do przeglądarki. W panelu administracyjnym są
prezentowane wyłącznie znaczniki `configured`.

## Specialist integrations

### My Jira

Obsługuje:

- New/My/All tickets;
- My/All tasks;
- komentarze, transitions i assignment;
- Jira Assets AQL;
- mapowanie Assets do MeshCentral po hostname;
- przejście do urządzenia i My Commands.

### Defender XDR

Obsługuje:

- raport incydentów Microsoft Graph;
- alerts_v2 i evidence;
- korelację MDCA, Entra provisioning i directory audit;
- filtry czasu, statusu, Incident ID i nazwy/usera;
- osobne grupy dostępu do Incidents, Email Explorer,
  Tenant Allow/Block List i Advanced Hunting.

Raport jest uruchamiany dopiero po kliknięciu `Refresh incidents`.

### Shared integration profiles

Panel administracyjny posiada wspólną konfigurację AD, Entra, Jira,
Defender i Zabbix. Zabbix w 1.1.0 jest profilem credentials przygotowanym
dla następnego etapu migracji modułu Monitoring.

## Test

```bash
npm test
```

## My Scripts compatibility

MyCompany zawiera pełny interfejs i backend My Scripts 1.9.7 jako moduł wewnętrzny. Podczas pierwszego uruchomienia migracji v2 kopiuje ze starego katalogu `plugins/myscripts`:

- `scripts`;
- `settings`;
- `data/credentials.json`;
- `data/folder-permissions.json`;
- `data/script-secrets.json`.

Docelowa lokalizacja to `meshcentral-data/mycompany-data/myscripts`. Stara wtyczka nie jest ładowana ani wymagana po zakończeniu migracji.


## My Commands scripts

Canonical location:

```text
meshcentral-data\mycompany-data\scripts\MyCommands
```

Example:

```text
MyCommands
├── ActiveDirectory
│   ├── ActiveDirectory.svg
│   ├── Groups
│   │   ├── Groups.svg
│   │   └── Add-User-To-Group.ps1
│   └── Users
│       ├── Users.png
│       └── Get-User.ps1
└── Automation
    ├── Automation.svg
    └── Winget-Upgrade.ps1
```

A folder graphic must have the same base name as its directory.
Supported formats: SVG, PNG, JPG, JPEG and WEBP.


## Repository policy

This repository contains the complete installable MyCompany plugin and the full embedded script libraries under `seed/MyScripts` and `seed/MyCommands`. No external plugin source is loaded at runtime.
