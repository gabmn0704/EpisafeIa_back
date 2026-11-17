#!/usr/bin/env bash
# Despliegue de la API en AWS App Runner usando una imagen en ECR.
# Requisitos: AWS CLI v2 autenticado, Docker, y un servicio App Runner ya creado
# (ver docs/DEPLOY_AWS.md) o la variable CREATE_SERVICE=1 para crearlo.
set -euo pipefail

AWS_REGION="${AWS_REGION:-us-east-1}"
ECR_REPO="${ECR_REPO:-episafe-api}"
SERVICE_NAME="${SERVICE_NAME:-episafe-api}"
IMAGE_TAG="${IMAGE_TAG:-$(git rev-parse --short HEAD)}"

ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
REGISTRY="${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
IMAGE="${REGISTRY}/${ECR_REPO}:${IMAGE_TAG}"

echo "==> Verificando repositorio ECR ${ECR_REPO}"
aws ecr describe-repositories --repository-names "${ECR_REPO}" --region "${AWS_REGION}" >/dev/null 2>&1 \
  || aws ecr create-repository --repository-name "${ECR_REPO}" --region "${AWS_REGION}" \
       --image-scanning-configuration scanOnPush=true >/dev/null

echo "==> Autenticando Docker contra ECR"
aws ecr get-login-password --region "${AWS_REGION}" | docker login --username AWS --password-stdin "${REGISTRY}"

echo "==> Construyendo y subiendo ${IMAGE}"
docker build -t "${IMAGE}" -t "${REGISTRY}/${ECR_REPO}:latest" .
docker push "${IMAGE}"
docker push "${REGISTRY}/${ECR_REPO}:latest"

SERVICE_ARN="$(aws apprunner list-services --region "${AWS_REGION}" \
  --query "ServiceSummaryList[?ServiceName=='${SERVICE_NAME}'].ServiceArn | [0]" --output text)"

if [[ "${SERVICE_ARN}" == "None" || -z "${SERVICE_ARN}" ]]; then
  if [[ "${CREATE_SERVICE:-0}" != "1" ]]; then
    echo "No existe el servicio App Runner '${SERVICE_NAME}'. Créalo (docs/DEPLOY_AWS.md) o ejecuta con CREATE_SERVICE=1 y ECR_ACCESS_ROLE_ARN." >&2
    exit 1
  fi
  : "${ECR_ACCESS_ROLE_ARN:?Define ECR_ACCESS_ROLE_ARN (rol con AWSAppRunnerServicePolicyForECRAccess)}"
  echo "==> Creando servicio App Runner ${SERVICE_NAME}"
  aws apprunner create-service --region "${AWS_REGION}" --service-name "${SERVICE_NAME}" \
    --source-configuration "{\"AuthenticationConfiguration\":{\"AccessRoleArn\":\"${ECR_ACCESS_ROLE_ARN}\"},\"AutoDeploymentsEnabled\":false,\"ImageRepository\":{\"ImageIdentifier\":\"${IMAGE}\",\"ImageRepositoryType\":\"ECR\",\"ImageConfiguration\":{\"Port\":\"4000\"}}}" \
    --health-check-configuration "Protocol=HTTP,Path=/api/v1/health,Interval=10,Timeout=5,HealthyThreshold=1,UnhealthyThreshold=5" \
    --instance-configuration "Cpu=0.5 vCPU,Memory=1 GB"
else
  echo "==> Desplegando nueva imagen en ${SERVICE_ARN}"
  aws apprunner start-deployment --service-arn "${SERVICE_ARN}" --region "${AWS_REGION}"
fi

echo "Listo. Variables de entorno y secretos se configuran en App Runner (ver docs/DEPLOY_AWS.md)."
