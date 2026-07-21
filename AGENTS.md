# AGENTS.md — MyCompany

## Zasada nadrzędna

`MyCompany` jest jedyną instalowaną wtyczką. `MyScripts`, `MyCommands`,
`MyJira`, `DefenderTools`, `ApprovalCenter` i `MoveRequests` są modułami
wewnętrznymi.

Nie wolno pobierać ani ładować kodu innych wtyczek, rejestrować modułów jako
osobnych pluginów ani duplikować wspólnych procedur.

Legacy migration może wyłącznie odczytać dane konfiguracyjne ze starych
katalogów. Nie może wykonywać ani `require()` kodu starej wtyczki.

Jeżeli procedura występuje w co najmniej dwóch modułach albo może być
sparametryzowana, musi zostać przeniesiona do `core/` lub `public/core.js`.

Wspólne elementy:

- ustawienia: `core/settings-store.js`;
- sekrety: `core/secret-store.js`;
- integracje i maskowanie credentials: `core/integration-service.js`;
- HTTP/HTTPS API client: `core/http-client.js`;
- jednorazowy import danych: `core/legacy-migration.js`;
- approval workflow: `core/approval-service.js`;
- urządzenia: `core/device-service.js`;
- parser skryptów: `core/script-library.js`;
- browser runtime: `public/core.js`, `public/runtime.js`;
- CSS: `public/main.css`.

Nie twórz osobnych klientów Jira, Graph ani Zabbix, jeżeli funkcjonalność
może użyć wspólnego `core/http-client.js` i `core/integration-service.js`.

Ciężkie operacje muszą być lazy-loaded. Nie uruchamiaj raportu Defender,
AQL ani pobierania Jira podczas startu MeshCentral.

Po każdej zmianie uruchom:

```bash
npm test
```
