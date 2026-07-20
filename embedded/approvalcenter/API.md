# Approval Center API v1

API służy do integracji serwer-serwer. Bazowa ścieżka to `/approvalcenter/api/v1` poprzedzona ścieżką domeny MeshCentral, jeżeli domena jej używa.

## Uwierzytelnienie

Site Admin tworzy token w `Approval Center → Settings → External API`. Token działa jako przypisany użytkownik MeshCentral, dlatego nie omija plugin permissions, praw do urządzeń ani grup approverów. W każdym żądaniu użyj:

```http
Authorization: Bearer ac1_...
```

Token może mieć scopes `providers:read`, `requests:read`, `requests:submit`, `requests:decide` oraz ograniczenie do provider types. Token jest pokazywany tylko raz i przechowywany jako SHA-256.

## Odkrywanie providerów

`GET /providers` zwraca schemat payloadu każdego dostępnego providera. `GET /providers/{type}/resources` zwraca dane potrzebne do zbudowania formularza, np. katalog skryptów i variables. Dostępne parametry:

- `moverequest`: `nodeId`;
- `mycommands`: `kind=scripts` albo `scriptPath`;
- `myscripts`: opcjonalny `scriptPath`;
- `mydefender`: bez parametrów.

## Składanie wniosku

```http
POST /requests
Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000
Content-Type: application/json

{
  "type": "myscripts",
  "requesterNote": "Request from ITSM",
  "payload": {
    "scriptPath": "Examples/Approval flow test.ps1",
    "variableValues": { "Message": "test", "IncludeEnvironment": true }
  }
}
```

Nowy wniosek zwraca HTTP `202`. Ponowienie z tym samym tokenem, providerem i `Idempotency-Key` zwraca ten sam rekord. Nowy klucz dla tego samego `resourceKey` może zastąpić wcześniejszy `pending` zgodnie z logiką providera.

## Odczyt i decyzja

```text
GET  /requests?type=myscripts&status=pending&page=1&perPage=20
GET  /requests/{id}
POST /requests/{id}/decision
```

Body decyzji:

```json
{ "decision": "approve", "note": "Approved in ITSM" }
```

Decyzja również wymaga `Idempotency-Key`. Konto przypisane do tokenu musi być Site Admin albo należeć do grupy approverów danego providera. Atomowy claim i `executionId` uniemożliwiają podwójne wykonanie.

## Odpowiedzi błędów

```json
{ "ok": false, "error": { "code": "scope_denied", "message": "..." } }
```

API zwraca m.in. `400` dla niepoprawnego żądania, `401` dla tokenu, `403` dla uprawnień, `404` dla zasobu i `409` dla konfliktu stanu. Przykłady PowerShell znajdują się w katalogu `examples`.
