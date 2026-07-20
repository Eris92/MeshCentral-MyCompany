# Changelog

## 3.0.3 — 2026-07-18

- Każdy poziom akceptacji może mieć przypisanych wiele grup użytkowników.
- Uprawnienia poziomów nadal działają hierarchicznie: użytkownik może zatwierdzać wyłącznie najwyższy dostępny dla niego poziom.

## 3.0.2 — 2026-07-18

- Zachowano osobnego approvera i komentarz dla każdego poziomu akceptacji (`Approver 1–3` oraz `Approver Note 1–3`).
- Dodano postęp akceptacji w formacie `zaakceptowane/wymagane`, np. `1/3`.
- Użytkownik należący do kilku grup może zatwierdzać wyłącznie najwyższy poziom, do którego ma dostęp; Site Admin zachowuje wyjątek.
- Dodano kompatybilny odczyt starszych rekordów zawierających tylko ostatniego approvera.

## 3.0.1 — 2026-07-18

- Dodano sekwencyjne poziomy akceptacji 1–3 oraz osobną grupę użytkowników dla każdego poziomu i providera.
- Wniosek jest wykonywany dopiero po zatwierdzeniu wszystkich wymaganych poziomów.
- Zwykły użytkownik nie może zatwierdzić ani odrzucić własnego wniosku; Site Admin zachowuje pełny dostęp awaryjny.
- Rekord przechowuje bieżący poziom i audytowalną historię decyzji wszystkich poziomów.

## 2.5.2 — 2026-07-17

- Kolumna `Actions` ma stałą, kompaktową szerokość mieszczącą przyciski `Approve` i `Reject` w jednym wierszu.

## 2.5.0 — 2026-07-17

- Zmieniono ikonę Approval Center na fioletowy clipboard z zielonym checkiem.
- Zmieniono nazwę assetu na `ApprovalCenter.svg`, aby wymusić pobranie nowej ikony.

## 2.4.0 — 2026-07-17

- Zmieniono ikonę Approval Center na osobną ikonę clipboard/check.
- Poprawiono odstępy między strzałką i nazwą sekcji ustawień.

## 2.3.0 — 2026-07-17

- Overview pokazuje wyłącznie oczekujące wnioski (`pending requests`).
- Każdy wniosek jest prezentowany jako szczegółowy kafelek z datą, requesterem, polami providera i `Requester Note`.
- W każdym kafelku dostępne są akcje `Approve` i `Reject`.
- Usunięto pobieranie zakończonych wniosków z zapytania Overview.

## 2.2.0 — 2026-07-17

- Overview pokazuje oczekujące wnioski niezależnie od ich wieku.
- Dodano przyciski `Approve` i `Reject` w kartach Overview z tym samym dialogiem decyzji co w tabelach.
- W `Settings` dodano przełącznik `Show this tab and its Overview section` dla każdego providera.
- Wyłączenie zakładki ukrywa ją również w Overview, ale nie usuwa historii ani nie wyłącza API providera.

## 2.1.0 — 2026-07-17

- Dodano wersjonowane API `approvalcenter/api/v1` dla integracji serwer-serwer.
- Tokeny API są hashowane, przypisane do kont MeshCentral i ograniczane przez scopes oraz providery.
- Dodano idempotentne składanie wniosków i decyzje zewnętrzne bez podwójnego wykonania.
- Dodano odkrywanie schematów i zasobów providerów, panel zarządzania tokenami i przykłady PowerShell.
- Zmniejszono bootstrap UI do jednego żądania i zrównoleglono zapytania Overview.

## 2.0.1 — 2026-07-17

- Dodano odświeżanie providerów przy każdym otwarciu Approval Center.
- Zakładki providerów pojawiają się bez F5 po instalacji lub przeładowaniu pluginu.
- Użytkownik widzi tylko providery, dla których ma uprawnienia akceptującego.

## 2.0.0 — 2026-07-16

- Dodano wspólny panel akceptacji i bazę `data/requests.db`.
- Dodano rejestrację niezależnych providerów.
- Dodano atomowe przejścia `pending → approved → executing` i `executionId`.
- Dodano Overview, filtrowane tabele, ustawienia grup akceptujących i retencję.
