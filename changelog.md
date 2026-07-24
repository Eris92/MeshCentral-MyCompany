## 1.5.151

- Completed the standalone Portal asset manifest for all shared UI components and feature modules.
- Added the Portal UI contract JavaScript endpoint.
- Fixed Settings and Management URLs to use `SIRKPortal`.
- Replaced raw disabled-module JSON with the shared unavailable-state presentation.

## 1.5.150

- Fixed the standalone Portal bootstrap pin to use `SIRKPortal`.
- Added the missing `portal-ui-contract.css` asset route with a CSS MIME type.
- Added regression coverage for runtime Portal asset URLs.

# Changelog

## 1.5.144

- Zmieniono techniczny identyfikator pluginu MeshCentral z niebezpiecznego `SIRK-Portal` na poprawny identyfikator JavaScript `SIRKPortal`.
- Dodano kanoniczne entrypointy `SIRKPortal.js` i `SIRKPortalAdmin.js`.
- Usunięto entrypointy z myślnikiem, które powodowały błędny kod `obj.SIRK-Portal` w `pluginHandler.prepExports()` i biały ekran po zalogowaniu.
- Zaktualizowano instalator, aby używał katalogu `meshcentral-data/plugins/SIRKPortal` i usuwał wadliwe katalogi testowych identyfikatorów.
- Rozszerzono testy i walidator o wymóg JavaScript-safe `shortName`.

## 1.5.143

- Dodano administracyjny entrypoint delegujący obsługę panelu do kanonicznej implementacji `admin.js`.
- Wydanie zostało zastąpione przez `1.5.144`, ponieważ identyfikator z myślnikiem nie jest zgodny z generatorem JavaScript MeshCentral.

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
