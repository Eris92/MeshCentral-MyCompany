# Core agent rules

## Zakres

Ten moduł zawiera wspólne zasady obowiązujące przy każdym zadaniu.

## Pierwszeństwo instrukcji

Instrukcje platformy i bieżące polecenie użytkownika mają pierwszeństwo. W projekcie stosuj kolejność:

1. instrukcja najbardziej specyficzna dla komponentu;
2. moduł domenowy;
3. moduł technologiczny;
4. wspólne moduły procesu;
5. ten moduł Core.

## Index-first

Przed odczytem kodu:

1. ustal root, branch i status;
2. przeczytaj `AGENTS.md`;
3. przeczytaj `docs/INDEX.md`;
4. wybierz indeks właściwej warstwy;
5. czytaj tylko wskazany entrypoint, moduł i bezpośrednie zależności.

Nie skanuj całego repozytorium, wszystkich dokumentów, historii Git ani dużych logów bez potwierdzonej potrzeby. Jeżeli indeks nie wystarcza, rozszerz zakres minimalnie i wskaż brak mapowania.

## Język i komunikacja

- komunikuj się po polsku;
- zachowuj standardową nomenklaturę techniczną;
- raportuj wynik, zmiany i dowody weryfikacji;
- nie ujawniaj wewnętrznego toku rozumowania.

## Sposób pracy

1. ustal rzeczywisty zakres;
2. wybierz indeks;
3. sprawdź bieżący stan zamiast zgadywać;
4. wykonaj najmniejszą zmianę;
5. zweryfikuj rezultat adekwatnie do ryzyka;
6. sprawdź, czy nie zmieniono rzeczy niepowiązanych;
7. podaj jednoznaczny wynik.

## Granice

- zapis plików jest dozwolony, gdy wynika z polecenia;
- publikacja, restart, instalacja, migracja i działania destrukcyjne wymagają jawnego zakresu;
- nie rozszerzaj pracy na inne repozytoria, środowiska ani konta;
- nie obchodź zabezpieczeń, hooków ani sandboxa.

## Stan niepełny

Jeżeli zadania nie można zakończyć:

- wykonaj bezpieczne kontrole;
- wskaż konkretną blokadę;
- nie przedstawiaj częściowego wyniku jako sukcesu;
- nie zastępuj brakujących danych przypuszczeniem.

## Zakończenie

Zadanie jest zakończone, gdy rezultat istnieje, został zweryfikowany, zakres zmian jest kontrolowany i użytkownik otrzymał jednoznaczny raport.
