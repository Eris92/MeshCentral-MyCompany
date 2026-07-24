# Changelog

## 1.5.142

- Opublikowano uporządkowany layout repozytorium SIRK-Portal na branchu `main`.
- Zawarto finalny wspólny kontrakt UI dla Overview, Devices i pozostałych zakładek.
- Zsynchronizowano źródła wersji i dokumentację wydania do testów instalacyjnych.

## 1.5.141

- Rozszerzono kanoniczny kontrakt UI na wszystkie widoki SIRK Portal.
- Overview i Devices korzystają teraz ze wspólnych klas `mc-portal-*` dla surface, cards, toolbarów, przycisków, inputów, statusów, badge i list.
- Devices zachowuje własną geometrię listy, szczegółów i workspace sesji, ale nie utrzymuje już oddzielnego systemu wizualnego.
- Dodano test regresyjny blokujący ponowne odseparowanie Overview lub Devices od wspólnego kontraktu UI.

## 1.5.140

- Zmieniono kanoniczną nazwę repozytorium i wszystkie URL-e metadata na `Eris92/SIRK-Portal`.
- Usunięto z dokumentacji i instrukcji informacje o kompatybilności, fallbackach oraz migracji `MyCompany`.
- Ujednolicono dokumentację z finalnym layoutem `server/`, `public/`, `web/admin/` i `views/SIRK-Portal.handlebars`.
- Dodano hierarchię indeksów `AGENTS.md -> docs/INDEX.md -> <warstwa>/INDEX.md`.
- Wymuszono selektywny odczyt tylko właściwej części repozytorium i bezpośrednich zależności.
- Zaktualizowano reguły agenta, prompt startowy, stan projektu, integrację Portalu i dokumentację instalacji.
- Ustawiono nową bazę historii wersji dla SIRK Management Platform po świadomym zerwaniu kompatybilności z testową strukturą MyCompany.
