# Despliegue en AWS (ECR + App Runner)

La API es un contenedor sin estado. Necesita PostgreSQL (RDS o Aurora) con el esquema del repo `EpisafeIa_BD`.

## 1. Prerrequisitos
- AWS CLI v2 autenticado (`aws sts get-caller-identity`) y Docker.
- Base de datos PostgreSQL accesible desde App Runner (RDS en una VPC + *VPC connector*, o una base pública con SSL).
- Servicio de IA (`episafeIA_IA`) desplegado y su URL pública o interna.

## 2. Publicar la imagen y desplegar
```bash
export AWS_REGION=us-east-1
./scripts/deploy-aws.sh
```
El script crea el repositorio ECR si no existe (con escaneo al subir), construye y sube la imagen etiquetada con
el *commit* y `latest`, y lanza un nuevo despliegue si el servicio App Runner ya existe.

Primera vez, creando el servicio:
```bash
export ECR_ACCESS_ROLE_ARN=arn:aws:iam::<cuenta>:role/AppRunnerECRAccessRole   # política AWSAppRunnerServicePolicyForECRAccess
CREATE_SERVICE=1 ./scripts/deploy-aws.sh
```

## 3. Configuración del servicio
Variables de entorno (guardar `JWT_SECRET` y `DATABASE_URL` en **Secrets Manager** o SSM y referenciarlos desde App Runner):

| Variable | Valor |
| --- | --- |
| `NODE_ENV` | `production` |
| `PORT` | `4000` |
| `DATABASE_URL` | `postgres://usuario:clave@host:5432/episafe?sslmode=require` |
| `JWT_SECRET` | cadena aleatoria de 32+ caracteres (`openssl rand -base64 48`) |
| `CORS_ORIGINS` | URL del frontend, p. ej. `https://app.ejemplo.com` |
| `AI_SERVICE_URL` | URL del servicio de IA |

Comprobación de salud: `HTTP` en `/api/v1/health`.

## 4. Alternativa sin ECR
`apprunner.yaml` permite desplegar desde el repositorio de código (runtime Node 20) conectando App Runner a GitHub.

## 5. Notas
- Rate limiting y cachés son por instancia; con varias instancias los contadores no se comparten (aceptable para este alcance).
- SSE (`/stream`) mantiene conexiones abiertas; App Runner las soporta, pero las cierra al redesplegar y el cliente debe reconectar.
- Las notificaciones SMS/email son simuladas; para producción registrar canales reales (SES/SNS) en `NotificationChannelFactory`.
