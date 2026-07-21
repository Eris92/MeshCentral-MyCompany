# MyCompany + SirK Portal

## Kierunek integracji

MyCompany jest właścicielem backendu, modułów, storage, permissions i konfiguracji.
SirK Portal jest opcjonalnym frontend shell ładowanym przez MyCompany.

Nie należy uruchamiać równolegle osobnej wtyczki `SirKPortal`, ponieważ rejestruje ona własny globalny shell oraz `domain.customFiles`.

## Moduły

```text
MyCompany
├── Approval Center
├── Move Requests
├── My Commands
├── My Scripts
├── My Jira
├── Defender Tools
├── integrations / encrypted secrets
└── Portal (optional frontend)
```

Portal nie posiada osobnego storage ani kopii logiki modułów.

## Nawigacja Portalu

| Portal | Źródło |
|---|---|
| Przegląd | Portal shell + dane widoczne w aktywnej sesji MeshCentral |
| Urządzenia | widoczne urządzenia i grupy MeshCentral |
| Zarządzanie | montowany moduł MyScripts |
| Akceptacje | montowany Approval Center |
| Ustawienia | panel administracyjny MyCompany, tylko Site Admin |
| Mesh | natywny interfejs MeshCentral |

## Lifecycle

- `modules.portal.enabled = false` jest ustawieniem domyślnym.
- Wyłączony Portal nie ładuje `public/portal.js` ani `public/portal.css`.
- Włączenie lub wyłączenie wymaga przeładowania głównej karty MeshCentral.
- Zmiana nie usuwa danych ani konfiguracji MyCompany.
- Portal jest ładowany po MyScripts i Approval Center, dzięki czemu montuje gotowe moduły przez `module.mount()`.

## Permissions

Portal nie tworzy nowego modelu uprawnień.
Każdy widok korzysta z access state odpowiedniego modułu MyCompany.
Ustawienia są dostępne tylko dla Site Admin.

## Migracja ze standalone SirKPortal

1. Wyłącz lub odinstaluj standalone `SirKPortal`.
2. Zrestartuj MeshCentral i sprawdź, czy nie są już ładowane jego globalne assets/customFiles.
3. Zaktualizuj MyCompany do wersji `1.4.0`.
4. Otwórz `MyCompany → Settings → SirK Portal`.
5. Zaznacz `Enable SirK Portal` i zapisz.
6. Po automatycznym przeładowaniu sprawdź Zarządzanie, Akceptacje, Ustawienia i powrót do Mesh.

Backendowe dane MyScripts, Approval Center, provider settings i integracje pozostają w MyCompany i nie wymagają migracji.
