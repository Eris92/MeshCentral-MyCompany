# SIRK Management Platform 1.5.144

**Repozytorium:** `SIRK-Portal`  
**Techniczny identyfikator pluginu MeshCentral:** `SIRKPortal`  
**Nazwa wyświetlana:** `SIRK Management Platform`  
**Nazwa skrócona w interfejsie:** `SIRK Platform`

SIRK Management Platform jest skonsolidowanym pluginem MeshCentral zawierającym backend, panel administracyjny, automatyzację, akceptacje, integracje, zarządzanie urządzeniami oraz samodzielny SIRK Portal.

Repozytorium nie utrzymuje kompatybilności z testową nazwą ani strukturą `MyCompany`. Nie ładuje starych entrypointów, nie migruje dawnych ustawień i nie korzysta z `mycompany-data`.

## Zacznij od indeksów

Przed odczytem kodu:

1. przeczytaj [`AGENTS.md`](AGENTS.md);
2. otwórz [`docs/INDEX.md`](docs/INDEX.md);
3. wybierz indeks warstwy odpowiadającej zadaniu;
4. czytaj wyłącznie wskazaną część repozytorium i jej bezpośrednie zależności.

Nie skanuj całego repozytorium, jeżeli indeks wskazuje konkretny entrypoint, moduł, loader, test lub dokument.

## Dokumentacja

- [Indeks dokumentacji i obszarów](docs/INDEX.md)
- [Struktura repozytorium](docs/REPOSITORY-LAYOUT.md)
- [Aktualny stan projektu](docs/PROJECT-STATE.md)
- [Integracja SIRK Platform i SIRK Portal](docs/portal-integration.md)
- [Router instrukcji](AGENTS.md)
- [Reguły projektu](docs/agent/11-Agent-SIRK-Portal.md)
- [Prompt startowy nowej rozmowy](docs/agent/Prompt-Start-SIRK-Portal-Conversation.md)

## Warstwy projektu

```text
backend Node/MeshCentral       -> server/
samodzielny SIRK Portal        -> public/portal/
adapter natywnego MeshCentral  -> public/native/
frontend współdzielony         -> public/shared/
renderery modułów              -> public/modules/
panel administracyjny          -> web/admin/
widok panelu                   -> views/SIRK-Portal.handlebars
ikony                          -> assets/icons/
narzędzia instalacyjne         -> tools/install/
```

Szczegółowe mapy znajdują się w lokalnych plikach `INDEX.md` poszczególnych warstw.

## Moduły funkcjonalne

- Automation;
- Commands;
- Approvals;
- Device Transfers;
- Jira Integration;
- Security;
- Portal.

Backend modułów znajduje się w `server/modules/`, a pojedyncze renderery frontendowe w `public/modules/`.

## Wspólny kontrakt UI Portalu

Wszystkie widoki SIRK Portal korzystają ze wspólnego systemu klas `mc-portal-*` dla powierzchni, kart, toolbarów, przycisków, pól formularzy, statusów, list i typografii.

Widok Devices zachowuje własną geometrię listy urządzeń, szczegółów hosta i workspace aktywnej sesji, ale korzysta z tych samych komponentów wizualnych co Overview oraz pozostałe zakładki.

## Entry pointy i loadery

Kanoniczne entrypointy MeshCentral:

```text
SIRKPortal.js
SIRKPortalAdmin.js
```

Identyfikator `SIRKPortal` celowo nie zawiera myślnika. MeshCentral wykorzystuje `shortName` jako nazwę właściwości w generowanym JavaScript głównego interfejsu, dlatego musi to być poprawny identyfikator JavaScript.

`SIRKPortalAdmin.js` deleguje implementację panelu do `admin.js`.

Łańcuch backendu:

```text
SIRKPortal.js
  -> plugin-main-standalone.js
    -> plugin-main.js
      -> server/core/runtime-portal.js
        -> server/core/runtime.js
          -> server/modules/*
```

Mapę assetów natywnego interfejsu utrzymuje `admin.js`. Mapę assetów samodzielnego Portalu utrzymuje `plugin-main-standalone.js`.

## Dane trwałe

Jedyny katalog danych runtime:

```text
meshcentral-data/sirk-platform-data
```

Plugin nie odczytuje, nie kopiuje i nie migruje `meshcentral-data/mycompany-data`.

## Instalacja z Git

Uruchom jako Administrator:

```powershell
.\Install-SIRK-Portal-FromGit_RUN.ps1
```

Źródłowa implementacja instalatora:

```text
tools/install/Install-SIRK-Portal-FromGit.ps1
```

Repozytorium źródłowe:

```text
https://github.com/Eris92/SIRK-Portal
```

Instalator umieszcza plugin w:

```text
meshcentral-data/plugins/SIRKPortal
```

## Testy

```bash
npm test
```

Walidator struktury blokuje niebezpieczny identyfikator z myślnikiem, stare entrypointy i widoki `MyCompany`, backend poza `server/`, płaskie assety aplikacyjne w `public/`, `public/shared-ui/`, podwójne renderery i niekanoniczne ścieżki loaderów.
