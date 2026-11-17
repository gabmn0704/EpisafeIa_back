# Referencia de la API

Base: `/api/v1`. JSON. Autenticación `Authorization: Bearer <accessToken>` salvo `/health`, `/auth/*` y `/stream`
(que usa `?token=`). Errores: `{ "error": { "code", "message", "details" } }` con códigos
`VALIDATION_ERROR` (400), `UNAUTHORIZED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `CONFLICT` (409),
`RATE_LIMITED` (429) e `INTERNAL_ERROR` (500).

## Auth
- `POST /auth/register` `{ email, password, fullName, birthDate?, timezone? }` → 201 `{ user, accessToken, refreshToken }`.
  La contraseña requiere 8+ caracteres con letra y número.
- `POST /auth/login` `{ email, password }` → `{ user, accessToken, refreshToken }`. 5 fallos bloquean la cuenta 15 min (429).
- `POST /auth/refresh` `{ refreshToken }` → nuevo par de tokens (el anterior queda revocado).
- `POST /auth/logout` `{ refreshToken? }` → `{ ok: true }`.
- `GET /auth/me` → `{ user }`.

## Contactos de emergencia
`GET /contacts` (ordenados por prioridad) · `POST /contacts` `{ name, phone?|email?, relationship?, priority, notifySms, notifyEmail }`
· `PUT /contacts/:id` · `DELETE /contacts/:id` (204). Se exige teléfono o correo.

## Medicamentos
- CRUD en `/medications` (`scheduleTimes` como `HH:MM`).
- `GET /medications/search?q=lev&limit=10` → autocompletado por prefijo (Trie).
- `GET /medications/schedule/today` → dosis de hoy en la zona horaria del usuario, con estado y `overdue`.
- `POST /medications/logs` `{ medicationId, scheduledFor, status }` (`taken|missed|skipped|pending`), idempotente por dosis.
- `GET /medications/adherence?days=30` → tasa, racha, tasa de 7 días y detalle por medicamento.

## Registro diario
`GET /daily-logs?from&to` · `GET /daily-logs/:date` · `PUT /daily-logs/:date` (upsert; 201 si crea, 200 si actualiza)
· `GET /daily-logs/template` (plantilla clonada del último registro) · `POST /daily-logs/undo` (deshace el último cambio).

## Crisis
`GET /seizures?from&to&page&limit` (más recientes primero) · `POST /seizures` · `GET /seizures/:id`
(incluye `navigation: { previousId, nextId }`) · `PUT|DELETE /seizures/:id` · `GET /seizures/stats`
(totales, por hora, severidad, tipo, correlación con sueño corto y grafo de desencadenantes).

## Emergencia
`POST /emergency` `{ latitude?, longitude?, note? }` registra la hora, crea la crisis y el evento y notifica a los
contactos por prioridad. `POST /emergency/:id/resolve` · `POST /emergency/:id/false-alarm` · `GET /emergency/active`.

## Informe médico
`GET /reports/medical?from=YYYY-MM-DD&to=YYYY-MM-DD&format=json|html` (por defecto últimos 30 días).

## IA
`GET /ai/insights` · `POST /ai/insights/refresh` · `GET /ai/risk/today` · `GET /ai/risk/history?days=30`.
Si el servicio de IA falla se usa un cálculo local y la respuesta lleva `degraded: true`.

## Wearables
- `GET|POST /wearables/devices`, `DELETE /wearables/devices/:id`.
- `POST /wearables/samples` `{ deviceId?, samples: [{ sampledAt, heartRate?, hrvMs?, spo2?, motionIntensity?, skinTempC?, steps? }] }`
  (1 a 200 muestras). La ingesta evalúa reglas en streaming y puede crear alertas.
- `GET /wearables/live?minutes=10` · `GET /wearables/summary?hours=24` · `GET /wearables/alerts`.
- `POST /wearables/alerts/:id/escalate` convierte la alerta en una emergencia.

Reglas: taquicardia sostenida en reposo (≥120 lpm, 5 muestras), movimiento convulsivo (≥4 de 6 muestras con
intensidad ≥0.7), caída (impacto ≥0.9 seguido de quietud) y anomalía de pulso (z-score robusto con MAD ≥3.5).
Cada tipo de alerta tiene un enfriamiento de 5 minutos.

## Dashboard
`GET /dashboard/summary` → riesgo de hoy, adherencia, última crisis, racha sin crisis, pulso actual, alertas activas.

## Tiempo real (SSE)
`GET /stream?token=<accessToken>` → eventos `ready`, `emergency`, `wearable_alert`, `risk_updated`.

## Salud
`GET /health` → `{ status, db, uptimeSeconds, version }` (503 si la base de datos no responde).
