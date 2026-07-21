# Changelog

## 1.3.1

- Naprawiono zapis `settings.json` na Windows bez operacji `rename`, `copy` i `unlink` na plikach tymczasowych.
- My Scripts czyta bibliotekę bezpośrednio z `seed/MyScripts`.
- My Commands czyta bibliotekę bezpośrednio z `seed/MyCommands`.
- Usunięto runtime seed migration do `mycompany-data/myscripts/scripts` i `mycompany-data/scripts/MyCommands`.
- Approval Center nie używa już górnych zakładek.
- Dodano stałe lewe menu: Overview, Move Request, Commands i Scripts wraz ze statusami.
- Usunięto Settings z widoku My Scripts; konfiguracja pozostaje w panelu administratora.
- Usunięto niepotrzebne ustawienia widoczności providerów Approval Center.
- Toolbar My Commands ma układ: Collapse, Favorites, Copy link, Edit, Refresh, Multi i Search.
- Toolbar My Scripts ma układ: Favorites, Copy link, Edit, Refresh i Search; Collapse oraz Multi są ukryte.
- Search jest zawsze ostatnim przyciskiem po lewej, `Clear` został usunięty, a pusta prawa grupa toolbara jest ukrywana.
- Favorites zachowuje wybór w `localStorage`, filtruje bibliotekę i pokazuje gwiazdki przy skryptach w trybie Edit.
- Copy link kopiuje deep link do zaznaczonego skryptu albo włącza ikony linków przy wszystkich skryptach.
- Edit dla Site Admin otwiera wspólny edytor nazwy, opisu, zmiennych, poziomów akceptacji, `runAsUser` i `MultiHost`.
- Skrypty z dyrektywami `SaveSecret` pokazują administratorowi ikonę klucza i wspólny edytor szyfrowanych poświadczeń.
- Multi-device jest dostępne wyłącznie w My Commands, pokazuje ikonę `⟳` i pobiera zaznaczone urządzenia bez ręcznego wklejania identyfikatorów.
- Multi-device respektuje `maxMultiHostNodes`, `multiHostConcurrency`, uprawnienia urządzeń oraz Approval Center.
- Wyniki My Scripts i My Commands mają filtr, przycisk View, renderowanie JSON/CSV jako tabeli, kopiowanie oraz zwijany `Debug / raw output`.
- Poza Overview Approval Center pokazuje filtrowaną tabelę wniosków z View, Approve i Reject; Overview pozostaje widokiem oczekujących kafelków.
- Approval Center ma działający, zapamiętywany icon-rail Collapse, wyłączony Copy link i poprawione ikony providerów.
- Poszerzono pierwszą i drugą kolumnę oraz ustabilizowano etykiety, akcje i układ mobilny.
- Dodano walidację architektury i składni JavaScript w GitHub Actions.

## 1.3.0

- Added reusable shared-ui components based on Approval Center.
- Unified module toolbars and settings.
- Approval request provider/status navigation.
- Direct Git installer and clean repository reset.

## 1.2.7

- Kopiuje pełne foldery, grafiki i skrypty z oryginalnych MyScripts oraz MyCommands do `seed` i katalogów runtime.
- Obsługuje katalogi aktywne oraz `.disabled`.
- Dodano `scripts/Sync-Installed-Seeds.ps1`.

## 1.2.6

- Usunięto kolizję `MyCompany.js` / `mycompany.js` na Windows.
- Pozostawiono jeden entrypoint `MyCompany.js` eksportujący obie funkcje.
- Dodano walidację ścieżek bez rozróżniania wielkości liter.

## 1.2.5

- Entry point nie ładuje już `plugin-main.js` poza blokiem ochronnym.
- Każdy wyjątek inicjalizacji zwraca działający panel diagnostyczny zamiast 401.
- Dodano `bootstrap.log` z etapami `factory-enter`, `plugin-ready` i błędami.
- Instalator testuje nie tylko eksporty, ale też wywołanie factory.

## 1.2.4

- Przywrócono foldery i podfoldery w zakładce My Commands → Scripts.
- Dodano grafiki folderów zgodne z konwencją MyScripts.
- Naprawiono odstępy zakładek oraz ukrywanie przycisków toolbara.
- Dodano widoczne akcje Custom command, Run on multiple hosts i Refresh.
- Dodano ścieżkę biblioteki skryptów w Settings.
- Migracja ponownie sprawdza CommandTabs/MyCommands oraz katalogi `.disabled`.

## 1.2.3

- Replaced `MyCompany.js` with a minimal deterministic bootstrap.
- Moved the implementation to `plugin-main.js`.
- Added verified exports for `MyCompany` and `mycompany`.
- Added deployment preflight validation.
