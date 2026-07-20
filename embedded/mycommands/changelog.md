# Changelog

## 4.5.1 — 2026-07-19

- Przebudowano widok `Scripts`, aby używał tego samego układu co My Scripts: menu katalogów po lewej, lista skryptów pośrodku i stały panel wyniku po prawej.
- Ujednolicono szerokości, odstępy, zaznaczenie katalogu, zwijanie menu i przewijanie listy skryptów.
- Przeniesiono przycisk wyszukiwania na koniec paska narzędzi, bezpośrednio przed rozwijanym polem wyszukiwania.

## 4.5.0 — 2026-07-19

- Dodano wykonywanie skryptu na wielu hostach z limitem, kontrolą współbieżności, timeoutem i wynikiem osobno dla każdego urządzenia.
- Operacja wielohostowa jest dostępna wyłącznie dla skryptów z jawną dyrektywą `# MultiHost: true`.
- Presety i skrypty wykonują się bez akceptacji domyślnie; Approval Center jest używane tylko po jawnej konfiguracji skryptu.
- Dodano zakładkę Results dla operacji bezpośrednich i wniosków Approval Center.
- Dodano rozwijany Debug z surowym wynikiem oraz widok tabelaryczny dla JSON i CSV.
- Dodano edytor definicji skryptu dla Site Admin: tryb uruchomienia, MultiHost, poziomy akceptacji i wszystkie obsługiwane zmienne.
- Dodano ulubione, deep linki i linki z wartościami zmiennych możliwe do zapisania jako zakładka przeglądarki.
- Ujednolicono menu, odstępy, tooltipy i wygląd przypisywania uprawnień z MyScripts.
- Naprawiono bootstrap menu, aby wejście do strony Plugins nie przełączało automatycznie widoku na Commands.
- Usunięto z repozytorium runtime settings i przypisania katalogów.
- Dodano testy statyczne, kontrolę spójności wersji i workflow GitHub Actions.

## 4.4.2 — 2026-07-18

- Wprowadzono wspólny Frontend Core 3.0.0 z kontrolą zgodności.
- Ujednolicono obsługę menu i ikony w Classic oraz Modern.

## 4.4.1 — 2026-07-18

- Skrypty urządzenia obsługują dyrektywy `Approval_1`, `Approval_2` i `Approval_3`.
- Stara dyrektywa `Approval` pozostaje zgodna i oznacza poziom 1; presety i custom commands domyślnie wymagają poziomu 1.

## 4.3.0 — 2026-07-17

- Dodano stały panel wyników dla zakładek Commands i Scripts.
- Usunięto osobne pola wyników przy każdym poleceniu i skrypcie.
- Ikona oczekującej akceptacji jest umieszczona wewnątrz przycisku skryptu.

## 4.2.0 — 2026-07-17

- Zakładka `Scripts` otwiera się jako pierwsza.
- Usunięto zakładkę `Custom` oraz panel `Credentials for scripts`.
- Komendy i skrypty mają opis jako tooltip, a wynik jest wyświetlany w polu po prawej.
- Skrypty z variables otrzymują nieklikalny znacznik wymaganej akceptacji.

## 4.1.0 — 2026-07-17

- Dodano schemat API dla presetów, skryptów i wymaganych variables.
- Dodano bezpieczne odkrywanie katalogu bez publikowania treści poleceń.
- Dodano przykład zlecenia komendy przez Approval Center API.
- Dodano cache metadanych skryptów i pojedyncze żądanie bootstrap UI.

## 4.0.0 — 2026-07-16

- Dodano integrację provider z `ApprovalCenter`.
- Commands i scripts wykonują się dopiero po zatwierdzeniu.
