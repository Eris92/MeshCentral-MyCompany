# Changelog

## 1.4.2

- `Zarządzanie` używa natywnego widoku `management` SirK Portal zamiast starej sekcji `Automation`.
- MyScripts jest montowany bezpośrednio w workspace Portalu, bez iframe i bez kopiowania logiki modułu.
- Zachowano pełny toolbar oraz wszystkie funkcje MyScripts: Collapse, Favorites, Credentials, Copy link, Edit, Refresh, Search, Results i formularze wykonania.
- Dodano theme adapter wykorzystujący kolory, borders, inputs, cards, toolbar i trzykolumnowy layout SirK Portal.
- Naprawiono podwójne etykiety menu, takie jak `PrzeglądPrzegląd`, przez aktualizowanie właściwego elementu `.sirk-menu-label`.
- Ukryto starą pozycję `Automation`, gdy dostępne jest zintegrowane `Zarządzanie`.
- Usunięto demonstracyjny workspace Zarządzania z Jira placeholderem po zamontowaniu MyScripts.
- Zachowano osobny host Portalu wokół `SharedPage`, aby jego klasy i CSS nie były nadpisywane podczas montowania modułu.

## 1.4.1

- MyCompany sam zapewnia komplet pinned assetów SirK Portal 0.3.17 w swoim katalogu vendor.
- Aktualizacja i instalacja nie wymagają aktywnej ani aktualizowanej osobnej wtyczki SirKPortal.
- Dodano cache invalidation oraz diagnostykę stanu vendor assets.

## 1.4.0

- SirK Portal został włączony do MyCompany jako opcjonalny moduł frontendowy, bez osobnego backendu, storage i lifecycle pluginu.
- Portal jest domyślnie wyłączony i można go włączyć lub wyłączyć w `Settings → SirK Portal`.
- `Zarządzanie` montuje istniejący moduł MyScripts bez kopiowania jego kodu i danych.
- `Akceptacje` montują istniejący Approval Center.
- `Ustawienia` osadzają panel administracyjny MyCompany i są dostępne tylko dla Site Admin.
- `Mesh` ukrywa portal i przywraca natywny interfejs MeshCentral; opcjonalny launcher pozwala ponownie otworzyć Portal.
- Dodano widoki Przegląd i Urządzenia korzystające z aktywnej sesji oraz widocznych danych MeshCentral.
- ModuleShell obsługuje teraz montowanie modułów wewnątrz innego interfejsu przez wspólny punkt `mount()`.
- Dodano wykrywanie konfliktu z osobną wtyczką SirKPortal; nie należy uruchamiać obu globalnych shelli równolegle.
- Dodano testy architektury pilnujące opcjonalności Portalu, mapowania MyScripts/Approval Center i przełącznika administracyjnego.

## 1.3.9

- Skrypt bez zmiennych po kliknięciu przechodzi bezpośrednio do statusu wykonania i wyniku, bez górnej karty z nazwą, opisem oraz przyciskiem `Run`.
- Formularz skryptu ze zmiennymi jest widoczny tylko przed wywołaniem i znika po kliknięciu `Run` albo `Request`.
- Po wykonaniu w panelu szczegółów pozostaje wyłącznie wynik, status oczekiwania na approval albo błąd wykonania.
- Przycisk `Copy` został przeniesiony pod wynik lub tabelę, bezpośrednio nad `Debug / raw output`.
- Ten sam mechanizm usuwa formularz wykonania po uruchomieniu skryptów i presetów w My Commands.
- Ponowne kliknięcie tego samego skryptu uruchamia nowe wykonanie zamiast wyświetlać wyłącznie poprzedni wynik.

## 1.3.8

- Skrypty bez zadeklarowanych zmiennych są wykonywane automatycznie po kliknięciu w My Commands i My Scripts.
- Skrypty wymagające zmiennych nadal otwierają formularz, aby użytkownik mógł podać wartości przed wykonaniem.
- W Edit Mode dodano opcję `Confirm execution before running`.
- Włączenie opcji zapisuje w nagłówku skryptu dyrektywę `# ConfirmExecution: true`.
- Skrypt z włączonym potwierdzeniem wyświetla użytkownikowi dodatkowe okno potwierdzenia przed utworzeniem requestu lub wysłaniem polecenia.
- Anulowanie potwierdzenia nie tworzy requestu i nie wykonuje skryptu.
- Backend My Scripts i My Commands odrzuca wywołania skryptów wymagających potwierdzenia, jeżeli request nie zawiera potwierdzonej flagi.
- Potwierdzenie działa również przy multi-device execution.

## 1.3.7

- `Results` jest ponownie pierwszą pozycją lewego menu My Commands.
- Kliknięcie presetu bez zmiennych wykonuje go bezpośrednio lub wysyła do akceptacji zgodnie z polityką providera.
- Presety wymagające zmiennych nadal otwierają formularz z przyciskiem `Run` albo `Request`.
- Przycisk `Save General` znajduje się wewnątrz rozwijanej sekcji General w Approval Center.
- Sekcja providera My Commands ma własny przycisk `Save My Commands`.
- Ustawienia host integration i execution limits My Commands mają lokalny przycisk zapisu.
- Dolny, odłączony pasek zapisu jest ukrywany tam, gdzie dostępny jest zapis wewnątrz sekcji.
