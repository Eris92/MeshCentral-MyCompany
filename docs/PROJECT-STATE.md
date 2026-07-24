# SIRK Management Platform — aktualny stan projektu

Stan dokumentacji: 2026-07-24  
Bieżąca wersja: `1.5.140`  
Branch refaktoryzacji: `refactor/repository-layout-v2`

## Status

Repozytorium `Eris92/SIRK-Portal` jest kanonicznym źródłem pluginu `SIRK-Portal`.

Branch posiada finalny podział:

```text
server/         backend
public/portal/  standalone Portal
public/native/  adapter MeshCentral
public/shared/  wspólny frontend
public/modules/ renderery modułów
web/admin/      panel administracyjny
```

Usunięto entrypointy, widoki, runtime fallbacki i katalogi backendowe `MyCompany`. Plugin nie utrzymuje migracji ustawień ani zgodności ze starym katalogiem danych.

## Nazwy

- techniczna nazwa pluginu: `SIRK-Portal`;
- pełna nazwa: `SIRK Management Platform`;
- nazwa UI: `SIRK Platform`.

## Runtime

Łańcuch ładowania:

```text
SIRK-Portal.js
  -> plugin-main-standalone.js
    -> plugin-main.js
      -> server/core/runtime-portal.js
        -> server/core/runtime.js
          -> server/modules/*
```

Runtime używa wyłącznie `server/core/` i `server/modules/`.

## Moduły

- Automation;
- Commands;
- Approvals;
- Device Transfers;
- Jira Integration;
- Security;
- Portal.

## Dane trwałe

```text
meshcentral-data/sirk-platform-data
```

Nie ma automatycznego odczytu, kopiowania ani migracji `mycompany-data`. Ustawienia testowej wtyczki nie są zachowywane.

## Frontend

Kanoniczne warstwy:

- `public/portal/` — dokument standalone, login, navigation, workspace i style;
- `public/native/` — launcher oraz integracja urządzeń z natywnym MeshCentral;
- `public/shared/` — runtime, komponenty, style i rejestr ikon;
- `public/modules/` — po jednym rendererze na moduł.

Panel administracyjny używa `views/SIRK-Portal.handlebars`, `web/admin/` oraz `window.SirkPlatformAdminData`.

## Kontrakt sesji urządzeń

- iframe hosta jest tworzony najwyżej raz na otwartą zakładkę;
- pozostaje podłączony do stałej warstwy sesji;
- przełączanie widoków nie przenosi iframe i nie zmienia `src`;
- aktywny host i podzakładka są odtwarzane po `F5`;
- Desktop, Terminal i Files nie mogą zostać zerwane przez przejście do innego widoku;
- PL/EN i motyw synchronizują się bez przeładowania workspace.

## Indeksy repozytorium

Nowe zadania rozpoczynają się od:

```text
AGENTS.md
docs/INDEX.md
<indeks właściwej warstwy>
```

Pełny skan repozytorium nie jest domyślnym sposobem pracy.

## Wersja 1.5.140

- zaktualizowano nazwę repozytorium i wszystkie URL-e metadata do `Eris92/SIRK-Portal`;
- usunięto z dokumentacji informacje o kompatybilności i migracji `MyCompany`;
- zsynchronizowano dokumentację z finalnym layoutem `server/public/web`;
- dodano hierarchię indeksów wymuszającą selektywny odczyt repozytorium;
- zaktualizowano reguły agenta i prompt startowy.

## Weryfikacja

Wymagane po commicie:

```bash
npm test
```

Dodatkowo należy sprawdzić CI brancha i ręcznie zweryfikować Portal po lokalnym wdrożeniu. Sam commit dokumentacyjno-metadata nie wykonuje restartu ani deploymentu.
