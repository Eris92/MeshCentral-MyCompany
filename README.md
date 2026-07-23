# SIRK Management Platform 1.5.139

**Plugin:** `SIRK-Portal`  
**Nazwa skrócona w interfejsie:** `SIRK Platform`

SIRK Management Platform jest skonsolidowanym pluginem MeshCentral zawierającym wspólny backend, moduły administracyjne, automatyzację, akceptacje, zarządzanie urządzeniami oraz samodzielny SIRK Portal.

## Dokumentacja

- [Docelowa struktura repozytorium](docs/REPOSITORY-LAYOUT.md)
- [Aktualny stan projektu](docs/PROJECT-STATE.md)
- [Integracja SIRK Platform](docs/portal-integration.md)
- [AGENTS.md](AGENTS.md)

## Warstwy projektu

```text
backend Node/MeshCentral       -> server/
nowy SIRK Portal               -> public/portal/
adapter natywnego MeshCentral  -> public/native/
frontend wspólny               -> public/shared/ i public/modules/
panel administracyjny          -> web/admin/
ikony                          -> assets/icons/
narzędzia                      -> tools/
```

Aktualne katalogi `core/`, `modules/` i część płaskiego `public/` są migrowane etapami. Nowy kod nie może dodawać kolejnych plików do starych lokalizacji.

## Backend i frontend modułu

Moduł biznesowy może mieć dwie warstwy:

```text
server/modules/approvalcenter/index.js   # backend
public/modules/approvalcenter/index.js   # frontend
```

Nie są to dwa niezależne moduły. Backend obsługuje API, dane i uprawnienia, a frontend renderuje interfejs i korzysta ze wspólnego API.

## Moduły funkcjonalne

- Automation Scripts — skrypty i zarządzanie;
- Commands — polecenia;
- Approval Center — akceptacje;
- Move Requests — przenoszenie urządzeń;
- Jira Integration — integracja z Jira i Assets;
- Defender XDR — bezpieczeństwo;
- SIRK Portal — główny interfejs użytkownika.

Klucze migracyjne `myscripts`, `mycommands`, `myjira` i `MyCompany` mogą występować wyłącznie w warstwie kompatybilności dla istniejących ustawień i instalacji. Nie są nazwami wyświetlanymi ani nazwami nowych plików.

## Entry pointy

Kanoniczny entrypoint pluginu:

```text
SIRK-Portal.js
```

`MyCompany.js` pozostaje czasowo jako mały shim dla istniejących instalacji. Nowa instalacja nie powinna go używać.

## Instalacja

Docelowe nazwy narzędzi instalacyjnych będą znajdować się w `tools/install/`. Historyczne launchery `Install-MyCompany-*` są utrzymywane wyłącznie do czasu zakończenia migracji aktualizatora.

## SIRK Portal

SIRK Portal jest niezależnym dokumentem frontendowym. Nie modyfikuje core MeshCentral i korzysta z tego samego backendu co adapter natywnego interfejsu.

Widoki:

- Przegląd;
- Urządzenia;
- Akceptacje;
- Automatyzacja;
- Monitoring;
- Zasoby;
- Zarządzanie;
- Raporty;
- Bezpieczeństwo;
- Ustawienia.

## Dane trwałe

Kanoniczny katalog danych:

```text
meshcentral-data/sirk-platform-data
├── settings.json
├── requests.json
├── secrets.json
├── .secret.key
├── defender/
└── scripts/
```

Przy pierwszym uruchomieniu po zmianie nazwy dane z `mycompany-data` są przenoszone do `sirk-platform-data`. Dane runtime nie są częścią repozytorium i nie mogą być usuwane podczas aktualizacji pluginu.

## Testy

```bash
npm test
```

Walidator struktury kontroluje nazwę `SIRK-Portal`, nazwę wyświetlaną `SIRK Management Platform`, centralne ikony, pojedynczy renderer każdego modułu, katalog `web/admin/` i brak nowych implementacji pod historycznymi nazwami.
