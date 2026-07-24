# Validation scripts index

Główna komenda:

```bash
npm test
```

## Walidatory

| Cel | Plik |
|---|---|
| finalna struktura repozytorium | `validate-repository-layout.js` |
| kontrakty architektury | `validate-architecture.js` |
| standalone Portal | `validate-standalone.js` |

Pełna kolejność znajduje się w `package.json`.

Dla prostego sprawdzenia uruchom najpierw walidator najbliższy zmianie. Pełne `npm test` jest wymagane po zmianie runtime, loaderów, struktury katalogów, wspólnych komponentów albo bezpieczeństwa.
