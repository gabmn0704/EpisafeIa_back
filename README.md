# EpisafeIa_back

API REST de **EpiSafe IA**, sistema inteligente de prevención y asistencia para personas con epilepsia.
Node 20+, Express, TypeScript estricto, PostgreSQL (`pg`), validación con `zod`, JWT, `bcryptjs`,
`helmet`, `cors`, `express-rate-limit`, `pino`, `vitest` + `supertest`.

Repos relacionados: `episafeIA` (docs e infra), `EpisafeIA_front` (web), `EpisafeIa_BD` (esquema PostgreSQL),
`episafeIA_IA` (servicio de IA).

## Puesta en marcha

```bash
npm install
cp .env.example .env        # ajusta JWT_SECRET (mínimo 32 caracteres)
npm run dev                 # http://localhost:4000/api/v1
```

- **Sin `DATABASE_URL`** la API arranca con repositorios en memoria y datos de demostración
  (`demo@episafe.app` / `Demo1234!`). Útil para desarrollar el frontend; los datos se pierden al reiniciar.
- **Con `DATABASE_URL`** usa PostgreSQL con el esquema del repo `EpisafeIa_BD`
  (`postgres://episafe:episafe_dev@localhost:5432/episafe` en desarrollo). En producción `DATABASE_URL` es obligatorio.
- Si el servicio de IA (`AI_SERVICE_URL`, por defecto `http://localhost:5000`) no responde, la API sigue
  funcionando con un cálculo local simple y marca `degraded: true` en las respuestas de IA.

## Scripts

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor con recarga (tsx) |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest (no necesita Postgres ni red) |
| `npm run coverage` | Pruebas con cobertura |
| `npm run build` / `npm start` | Compila a `dist/` y ejecuta |

## Variables de entorno

Ver [`.env.example`](.env.example). Las más importantes: `PORT`, `CORS_ORIGINS`, `DATABASE_URL`, `JWT_SECRET`,
`ACCESS_TOKEN_TTL` (15m), `REFRESH_TOKEN_TTL_DAYS` (7), `AI_SERVICE_URL`, `AI_TIMEOUT_MS`.

## API (`/api/v1`)

Errores uniformes: `{ "error": { "code": "VALIDATION_ERROR", "message": "…", "details": [...] } }`.
Detalle completo en [docs/API.md](docs/API.md). Resumen:

| Área | Endpoints |
| --- | --- |
| Auth | `POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `GET /auth/me` |
| Contactos | `GET\|POST /contacts`, `PUT\|DELETE /contacts/:id` |
| Medicamentos | `GET\|POST /medications`, `PUT\|DELETE /medications/:id`, `GET /medications/search?q=`, `/schedule/today`, `POST /medications/logs`, `GET /medications/adherence?days=` |
| Registro diario | `GET /daily-logs?from&to`, `GET\|PUT /daily-logs/:date`, `GET /daily-logs/template`, `POST /daily-logs/undo` |
| Crisis | `GET\|POST /seizures`, `GET\|PUT\|DELETE /seizures/:id`, `GET /seizures/stats` |
| Emergencia | `POST /emergency`, `POST /emergency/:id/resolve`, `/:id/false-alarm`, `GET /emergency/active` |
| Informe médico | `GET /reports/medical?from&to&format=json\|html` |
| IA | `GET /ai/insights`, `POST /ai/insights/refresh`, `GET /ai/risk/today`, `GET /ai/risk/history?days=` |
| Wearables | `GET\|POST /wearables/devices`, `DELETE /wearables/devices/:id`, `POST /wearables/samples`, `GET /wearables/live`, `/summary`, `/alerts`, `POST /wearables/alerts/:id/escalate` |
| Dashboard | `GET /dashboard/summary` |
| Salud | `GET /health` (sin autenticación) |
| Tiempo real | `GET /stream?token=<accessToken>` (SSE: `emergency`, `wearable_alert`, `risk_updated`) |

## Arquitectura

```
src/
  structures/   Estructuras de datos escritas a mano (con tests)
  patterns/     Singleton, Factory, Builder, Prototype, Proxy
  repositories/ Interfaz Table<T> + implementación en memoria y PostgreSQL
  modules/      auth, contacts, medications, dailyLogs, seizures, emergency,
                wearables, ai, reports, dashboard, stream, health
  http/         Middlewares (auth JWT, errores, rate limit, logging) y utilidades
  app.ts        Composición de Express   ·   container.ts  Inyección de dependencias
  server.ts     Arranque (pg o memoria) y apagado ordenado
```

Los servicios dependen de la interfaz `Table<T>`; las pruebas de integración usan la implementación
en memoria, por lo que corren sin base de datos. `PgTable` genera SQL parametrizado (verificado con un pool falso).

### Estructuras de datos y dónde se usan

Todas implementadas desde cero en `src/structures/` (sin librerías). Detalle en
[docs/DATA_STRUCTURES.md](docs/DATA_STRUCTURES.md).

| Estructura | Uso real |
| --- | --- |
| `DoublyLinkedList` | Navegación anterior/siguiente en el historial de crisis (`GET /seizures/:id`) |
| `LinkedList` / `Queue` | Cola FIFO de envíos de notificaciones de emergencia |
| `Stack` | Deshacer cambios del registro diario (`POST /daily-logs/undo`) |
| `MinHeap` / `PriorityQueue` | Orden de contactos por prioridad; top-k de insights y factores de riesgo |
| `CircularBuffer` | Ventana en vivo de muestras del reloj (`GET /wearables/live`) |
| `HashTable` | Bloqueo de login por intentos, buffers por usuario, enfriamiento de alertas |
| `BinarySearchTree` | Índice por fecha del registro diario |
| `AVLTree` | Índice de crisis por fecha con consultas por rango |
| `Trie` | Autocompletado de medicamentos |
| `Graph` | Co-ocurrencia de desencadenantes: BFS/DFS, PageRank |
| `LRUCache` | Caché de índices y riesgo; base del Proxy de repositorios |
| `BloomFilter` | Correos registrados y refresh tokens revocados |
| `FenwickTree` / `SegmentTree` | Sumas por rango (sueño, adherencia) y mínimo por rango en el informe |

Patrones de diseño: **Singleton** (`ConfigProvider`, `Database`), **Factory** (`NotificationChannelFactory`),
**Builder** (`MedicalReportBuilder`), **Prototype** (`DailyLogTemplate`), **Proxy** (`CachedTable`).

## Seguridad

- Contraseñas con bcrypt; JWT de acceso (15 min) y refresh con rotación y revocación (hash SHA-256 en BD).
- Bloqueo temporal tras 5 intentos fallidos de login, rate limiting global y específico de `/auth`.
- `helmet`, CORS por lista de orígenes, validación `zod` en todas las entradas, SQL parametrizado.
- Cada recurso se filtra por usuario; un recurso ajeno responde 404.
- Los logs ocultan `Authorization`, contraseñas y refresh tokens.
- Las notificaciones (SMS/email) son **simuladas** (se registran en logs); la fábrica permite conectar
  proveedores reales (SES, SNS) sin tocar el resto del código.
- Aviso: EpiSafe IA no ofrece diagnóstico ni cambia dosis; consulta siempre a tu neurólogo.

## Docker y despliegue

```bash
docker build -t episafe-api .
docker run --rm -p 4000:4000 -e JWT_SECRET=... -e DATABASE_URL=... episafe-api
```

Despliegue en AWS (ECR + App Runner) con `scripts/deploy-aws.sh`; guía en [docs/DEPLOY_AWS.md](docs/DEPLOY_AWS.md).
CI en GitHub Actions: lint, typecheck, pruebas y build en cada push y PR.
