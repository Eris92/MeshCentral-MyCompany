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
- Toolbar My Scripts i My Commands ma wspólny układ: Collapse, Favorites, Copy link, Edit, Refresh, opcjonalnie Multi i Search.
- Search jest zawsze ostatnim przyciskiem po lewej, a pusta prawa grupa toolbara jest usuwana.
- Favorites, Copy link i Edit odtwarzają zachowanie oryginalnego MyScripts: tryb filtrowania, ikony przy skryptach i edycję źródła dla Site Admin.
- Multi-device jest dostępne wyłącznie w My Commands i dodaje ikonę `⟳` przy skryptach.
- Multi-device respektuje `maxMultiHostNodes`, `multiHostConcurrency`, uprawnienia urządzeń oraz Approval Center.
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

## 1.2.2

- Naprawiono `Unauthorized` po zmianie shortName między `mycompany` i `MyCompany`.
- Dodano admin-only alias bez podwójnego uruchamiania browser hooks.
- Panel i assety zachowują identyfikator `pin`, przez który zostały otwarte.

## 1.2.1

- Fixed plugin registration when MeshCentral normalizes `shortName` to lowercase.
- Added `MyCompany` and `mycompany` export/file compatibility.
- Plugin admin panel remains available when one migrated module fails to load.
- Added per-module load diagnostics and `plugin-load-error.log`.

## 1.2.0

- Applied the full MyScripts layout to every module.
- Migrated the full My Commands catalog, multi-host execution, progress, structured tables, results and metadata editor.
- Expanded Approval Center with provider views, visibility, API tokens and idempotency.
- Added full Move Requests history and settings page.
- Rebuilt My Jira tickets/tasks/assets workflow in the shared shell.
- Rebuilt Defender XDR tabs, report status, logs and settings in the shared shell.
- Added data migration for My Commands, Approval Center and Move Requests.

## 1.1.1

- Przywrócono pełny interfejs My Scripts 1.9.7 wewnątrz MyCompany.
- Przywrócono drzewo folderów, ikony, wyszukiwanie i panel wyników.
- Przywrócono Settings, folder permissions oraz AD/Entra/Jira credentials.
- Przywrócono wybór użytkownika, Jira Assets wizard i script secrets.
- Dodano migrację katalogów `scripts`, `settings` i plików danych starego My Scripts.
- My Scripts nadal jest modułem wewnętrznym jednej wtyczki MyCompany.

## 1.1.0
