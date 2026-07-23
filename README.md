# MyCompany 1.5.138

Jeden skonsolidowany plugin MeshCentral zawierający wspólny backend, moduły administracyjne oraz nowy SirK Portal.

## Dokumentacja

- [Docelowa struktura repozytorium](docs/REPOSITORY-LAYOUT.md)
- [Aktualny stan projektu](docs/PROJECT-STATE.md)
- [Integracja MyCompany + SirK Portal](docs/portal-integration.md)
- [AGENTS.md](AGENTS.md)
- [Reguły agenta dla MyCompany](docs/agent/11-Agent-MyCompany.md)

## Warstwy projektu

```text
backend Node/MeshCentral       -> server/ (docelowo)
nowy SirK Portal               -> public/portal/
adapter natywnego MeshCentral  -> public/native/
frontend wspólny               -> public/shared/ i public/modules/
panel administracyjny          -> web/admin/
narzędzia                      -> tools/
```

Aktualne katalogi `core/`, `modules/`, płaski `public/` oraz płaski `web/` są migrowane etapami. Szczegóły i zasady zgodności opisuje `docs/REPOSITORY-LAYOUT.md`.

## Backend i frontend modułu

Pliki:

```text
modules/ApprovalCenter/index.js
public/modules/approvalcenter.js
```

nie powinny być traktowane jako dwa niezależne moduły. Pierwszy jest backendem Node/MeshCentral, drugi rendererem przeglądarkowym. Obie warstwy używają klucza `approvalcenter` i wspólnego API.

Audyt wykazał również starsze kopie rendererów w płaskim `public/`, dlatego migracja usuwa te duplikaty i pozostawia jeden kanoniczny frontend dla każdego modułu.

## Moduły

- My Scripts / Zarządzanie
- My Commands / Automatyzacja i Polecenia
- Approval Center / Akceptacje
- Move Requests
- My Jira / Assets
- Defender Tools / Security
- SirK Portal

`MyScripts`, `MyCommands`, `MyJira`, `DefenderTools`, `ApprovalCenter` i `MoveRequests` są modułami wewnętrznymi jednego pluginu.

## Instalacja

Kanoniczny installer znajduje się w:

```powershell
.\tools\install\Install-MyCompany-FromGit_RUN.ps1
```

Dla zgodności pozostają krótkie launchery w root:

```powershell
.\Install-MyCompany-FromGit_RUN.ps1
```

Launchery w root nie zawierają logiki instalacji.

## SirK Portal

SirK Portal jest niezależnym dokumentem frontendowym udostępnianym przez MyCompany. Nie modyfikuje core MeshCentral i korzysta z tego samego backendu co adapter natywnego interfejsu.

Widoki:

- Przegląd;
- Urządzenia;
- Akceptacje;
- Automatyzacja;
- Monitoring;
- Zasoby;
- Zarządzanie;
- Raporty;
- Bezpieczeństwo;
- Ustawienia.

## Dane trwałe

```text
meshcentral-data/mycompany-data
├── settings.json
├── requests.json
├── secrets.json
├── .secret.key
├── defender/
└── scripts/
```

Dane runtime nie są częścią repozytorium i nie mogą być usuwane podczas aktualizacji pluginu.

## Testy

```bash
npm test
```

Test `scripts/validate-repository-layout.js` blokuje dokładanie pełnych skryptów PowerShell do root i dokumentuje rozdział backend/frontend. Pozostałe testy walidują runtime, Portal, bezpieczeństwo, uprawnienia i sesje urządzeń.
