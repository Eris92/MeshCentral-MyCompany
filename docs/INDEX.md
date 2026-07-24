# Indeks repozytorium SIRK-Portal

Ten plik jest drugim krokiem po root `AGENTS.md`. Służy do wyboru najmniejszego zakresu odczytu.

## Indeksy warstw

| Zadanie | Najpierw przeczytaj |
|---|---|
| backend, storage, API, integracje, permissions | `server/INDEX.md` |
| samodzielny Portal, native UI, shared UI, renderery | `public/INDEX.md` |
| panel administracyjny | `web/INDEX.md` |
| walidatory, build, kontrola struktury | `scripts/INDEX.md` |
| wybór testu lub analiza regresji | `test/INDEX.md` |
| architektura katalogów i loaderów | `docs/REPOSITORY-LAYOUT.md` |
| bieżący stan i ograniczenia | `docs/PROJECT-STATE.md` |
| integracja Portalu z MeshCentral | `docs/portal-integration.md` |
| reguły pracy agenta | `docs/agent/11-Agent-SIRK-Portal.md` |

## Reguła selektywnego odczytu

1. Wybierz dokładnie jeden indeks główny odpowiadający zadaniu.
2. Odczytaj wskazany entrypoint lub moduł.
3. Przejdź tylko po bezpośrednich importach, mapach assetów, route’ach i testach związanych z tym elementem.
4. Nie czytaj równolegle backendu, frontendu, panelu admina i testów, jeżeli zadanie dotyczy tylko jednej warstwy.
5. Pełne wyszukiwanie repozytorium jest wyjątkiem dla rename, audytu bezpieczeństwa, zmiany publicznego API albo braku mapowania w indeksach.

## Dokumenty kanoniczne

- nazwy i struktura: `docs/REPOSITORY-LAYOUT.md`;
- stan wersji i migracji: `docs/PROJECT-STATE.md`;
- zachowanie Portalu: `docs/portal-integration.md`;
- router instrukcji: `AGENTS.md`;
- reguły projektu: `docs/agent/11-Agent-SIRK-Portal.md`.

Dokument nieujęty w tym indeksie nie powinien być czytany automatycznie tylko dlatego, że znajduje się w `docs/`.
