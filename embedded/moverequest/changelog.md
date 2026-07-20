# Changelog

## 2.1.0 — 2026-07-17

- Dodano schemat API providera i odkrywanie grup docelowych według `nodeId`.
- Dodano przykładowy skrypt PowerShell składający wniosek przez Approval Center API.
- Zachowano walidację praw użytkownika i ponowną kontrolę praw approvera przed przeniesieniem.

## 2.0.1 — 2026-07-16

- Usunięto zbędny `MutationObserver` z instalacji przycisku hosta.
- Przycisk nadal jest odtwarzany przez natywny hook `onDeviceRefreshEnd` i krótki, ograniczony harmonogram ponowień.
- Niezależny Edge potwierdza czysty F5 w Classic i Modern. Podobny komunikat widoczny wyłącznie w przeglądarce wbudowanej w Codex pochodzi z jej warstwy testowej, nie z pluginu.

## 2.0.0 — 2026-07-16

- Move Request działa jako provider `ApprovalCenter`.
- Usunięto własne menu, panel akceptacji i zapis do `requests.json`.
- Zachowano przycisk hosta dla Classic i Modern.
- Dodano ponowną walidację praw approvera i stanu urządzenia przed wykonaniem.
- Przeniesienie jest chronione atomowym mechanizmem wykonania `ApprovalCenter`.
