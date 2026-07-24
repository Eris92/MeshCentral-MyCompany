# Task execution router

## Zasada nadrzędna

Klasyfikuj każde podzadanie osobno. Proste czynności wykonuj w `FAST_PATH`, nawet gdy inne części zadania wymagają `DEEP_PATH`.

## FAST_PATH

Używaj dla deterministycznych operacji: status, wersja, wskazany plik, test, build, commit, push, restart albo istniejący Skill.

Kolejność:

1. przeczytaj `AGENTS.md` i `docs/INDEX.md`;
2. wybierz jeden indeks warstwy;
3. sprawdź Skill lub istniejący skrypt;
4. wykonaj polecenie;
5. bezpośrednio zweryfikuj wynik;
6. zakończ bez dodatkowego audytu.

Nie skanuj całego repozytorium, nie czytaj całej historii i nie otwieraj niezwiązanych modułów.

Domyślny budżet:

- jeden indeks warstwy;
- do trzech plików implementacji;
- do trzech poleceń diagnostycznych;
- minimalna weryfikacja.

Budżet można przekroczyć tylko po rzeczywistym błędzie, niejednoznaczności, braku mapowania albo ryzyku bezpieczeństwa.

## DEEP_PATH

Używaj dla zmian wielomodułowych, architektury, bezpieczeństwa, migracji, API, współbieżności i błędów bez jednoznacznej przyczyny.

Nawet w `DEEP_PATH` zaczynaj od indeksów. Rozszerzaj odczyt warstwami, a nie pełnym skanem repozytorium.

Po znalezieniu rozwiązania wróć do `FAST_PATH` dla zmian, testów, wersji i Git.

## Escalation

Przejdź z `FAST_PATH` do `DEEP_PATH` dopiero, gdy:

- operacja zwróciła błąd;
- weryfikacja nie potwierdziła sukcesu;
- wynik jest sprzeczny;
- indeks nie opisuje potrzebnej zależności;
- wykryto ryzyko bezpieczeństwa lub utraty danych.

## Evidence-first

Źródłem prawdy jest aktualny wynik polecenia, odczyt konkretnego pliku, route, loader, test albo status Git.

## Completion

Operacja jest zakończona, gdy została wykonana, zweryfikowana i nie zmieniła niepowiązanego zakresu.
