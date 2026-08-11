#!/bin/bash
set -e

# ============================================================
#  deploy-spa.sh — Despliega la SPA Angular al bucket S3 + CloudFront
#
#  Estrategia de deploy sin downtime:
#  1. Sube assets con hash (cache 1 año) — no afecta usuarios actuales
#  2. Sube index.html sin cache — activa la nueva versión
#  3. Invalida CloudFront (solo index.html) — fuerza refresco en edge
#  4. Espera 60s y limpia assets huérfanos
#
#  Uso: bash tools/deploy-spa.sh <stage> [dist-path]
#  Ejemplo: bash tools/deploy-spa.sh dev
#           bash tools/deploy-spa.sh prd ./dist/ind-hub-app-ngx-pri-gh/browser
#
#  Stages válidos: dev, prd
# ============================================================

STAGE=$1
DIST_PATH=${2:-./dist/ind-hub-app-ngx-pri-gh/browser}
REGION=${3:-us-east-1}

# --- Configuración por ambiente ---
case "$STAGE" in
  dev)
    PROFILE="pa-dev"
    BUCKET="ind-dev-hub-s3-dev-pri-use1"
    STACK_NAME="ind-hub-inf-cdn-dev"
    ;;
  prd)
    PROFILE="pa-prd"
    BUCKET="ind-prd-hub-s3-prd-pri-use1"
    STACK_NAME="ind-hub-inf-cdn-prd"
    ;;
esac

# --- Colores ---
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[36m'
NC='\033[0m'

# --- Validaciones ---
if [[ -z "$STAGE" ]]; then
  echo -e "${RED}Error: faltan argumentos${NC}"
  echo ""
  echo "Uso: $0 <dev|prd> [ruta-al-dist]"
  echo "Ejemplo: $0 dev"
  echo "         $0 prd ./dist/ind-hub-app-ngx-pri-gh/browser"
  exit 1
fi

if [[ "$STAGE" != "dev" && "$STAGE" != "prd" ]]; then
  echo -e "${RED}Error: stage debe ser dev o prd${NC}"
  exit 1
fi

if [[ ! -d "$DIST_PATH" ]]; then
  echo -e "${RED}Error: no existe el directorio $DIST_PATH${NC}"
  echo -e "${YELLOW}Asegúrate de haber ejecutado 'ng build' antes${NC}"
  exit 1
fi

if [[ ! -f "$DIST_PATH/index.html" ]]; then
  echo -e "${RED}Error: no se encontró index.html en $DIST_PATH${NC}"
  echo -e "${YELLOW}Verifica que la ruta apunte al directorio de output del build${NC}"
  exit 1
fi

echo ""
echo -e "${CYAN}================================================${NC}"
echo -e "${CYAN}  Deploy SPA Indómito Hub — $STAGE${NC}"
echo -e "${CYAN}================================================${NC}"
echo ""
echo -e "  Bucket:  ${GREEN}$BUCKET${NC}"
echo -e "  Profile: ${GREEN}$PROFILE${NC}"
echo -e "  Region:  ${GREEN}$REGION${NC}"
echo -e "  Source:  ${GREEN}$DIST_PATH${NC}"
echo ""

# --- Verificar credenciales AWS ---
echo -e "${YELLOW}▶ Verificando credenciales AWS...${NC}"
if ! aws sts get-caller-identity --profile "$PROFILE" --no-cli-pager > /dev/null 2>&1; then
  echo -e "${YELLOW}⟳ Sesión SSO expirada. Iniciando login...${NC}"
  aws sso login --profile "$PROFILE"
fi
ACCOUNT=$(aws sts get-caller-identity --profile "$PROFILE" --query Account --output text)
echo -e "${GREEN}✓ Autenticado — Account: $ACCOUNT${NC}"
echo ""

# --- Obtener Distribution ID del stack CloudFormation ---
echo -e "${YELLOW}▶ Obteniendo Distribution ID...${NC}"
DISTRIBUTION_ID=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='DistributionId'].OutputValue" \
  --output text \
  --region "$REGION" \
  --profile "$PROFILE" 2>/dev/null || echo "")

if [[ -z "$DISTRIBUTION_ID" || "$DISTRIBUTION_ID" == "None" ]]; then
  echo -e "${RED}Error: no se pudo obtener el Distribution ID${NC}"
  echo -e "${YELLOW}Verifica que el stack CDN esté desplegado en el repo de infra${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Distribution ID: $DISTRIBUTION_ID${NC}"
echo ""

# --- Paso 1: Subir assets con cache largo (1 año, immutable) ---
echo -e "${YELLOW}▶ [1/5] Subiendo assets (cache 1 año)...${NC}"
aws s3 sync "$DIST_PATH" "s3://$BUCKET" \
  --exclude "index.html" \
  --exclude "styles.css" \
  --exclude "styles.css.map" \
  --exclude "3rdpartylicenses.txt" \
  --cache-control "public, max-age=31536000, immutable" \
  --profile "$PROFILE" \
  --region "$REGION" \
  --no-cli-pager

ASSETS_COUNT=$(aws s3 ls "s3://$BUCKET" --recursive --profile "$PROFILE" --region "$REGION" | wc -l | tr -d ' ')
echo -e "${GREEN}✓ Assets sincronizados ($ASSETS_COUNT archivos en bucket)${NC}"
echo ""

# --- Paso 2: Subir index.html sin cache ---
echo -e "${YELLOW}▶ [2/5] Subiendo index.html (sin cache)...${NC}"
aws s3 cp "$DIST_PATH/index.html" "s3://$BUCKET/index.html" \
  --cache-control "no-cache, no-store, must-revalidate" \
  --content-type "text/html; charset=utf-8" \
  --profile "$PROFILE" \
  --region "$REGION" \
  --no-cli-pager
echo -e "${GREEN}✓ index.html subido${NC}"
echo ""

# --- Paso 2b: Subir styles.css sin cache (no tiene hash en el nombre) ---
if [[ -f "$DIST_PATH/styles.css" ]]; then
  echo -e "${YELLOW}▶ [2b/5] Subiendo styles.css (sin cache)...${NC}"
  aws s3 cp "$DIST_PATH/styles.css" "s3://$BUCKET/styles.css" \
    --cache-control "no-cache, no-store, must-revalidate" \
    --content-type "text/css; charset=utf-8" \
    --profile "$PROFILE" \
    --region "$REGION" \
    --no-cli-pager
  echo -e "${GREEN}✓ styles.css subido${NC}"

  if [[ -f "$DIST_PATH/styles.css.map" ]]; then
    aws s3 cp "$DIST_PATH/styles.css.map" "s3://$BUCKET/styles.css.map" \
      --cache-control "no-cache, no-store, must-revalidate" \
      --content-type "application/json" \
      --profile "$PROFILE" \
      --region "$REGION" \
      --no-cli-pager
  fi
  echo ""
fi

# --- Paso 3: Subir archivos adicionales (si existen) ---
echo -e "${YELLOW}▶ [3/5] Subiendo archivos adicionales (si existen)...${NC}"
EXTRA_COUNT=0

if [[ -f "$DIST_PATH/3rdpartylicenses.txt" ]]; then
  aws s3 cp "$DIST_PATH/3rdpartylicenses.txt" "s3://$BUCKET/3rdpartylicenses.txt" \
    --cache-control "public, max-age=86400" \
    --content-type "text/plain" \
    --profile "$PROFILE" \
    --region "$REGION" \
    --no-cli-pager
  EXTRA_COUNT=$((EXTRA_COUNT + 1))
fi

if [[ $EXTRA_COUNT -gt 0 ]]; then
  echo -e "${GREEN}✓ $EXTRA_COUNT archivos adicionales subidos${NC}"
else
  echo -e "${GREEN}✓ No hay archivos adicionales${NC}"
fi
echo ""

# --- Paso 4: Invalidar cache de CloudFront ---
echo -e "${YELLOW}▶ [4/5] Invalidando cache de CloudFront...${NC}"
INVALIDATION_ID=$(aws cloudfront create-invalidation \
  --distribution-id "$DISTRIBUTION_ID" \
  --paths "/index.html" "/styles.css" \
  --query "Invalidation.Id" \
  --output text \
  --profile "$PROFILE" \
  --no-cli-pager)
echo -e "${GREEN}✓ Invalidación creada: $INVALIDATION_ID${NC}"
echo -e "  (Se propaga a todos los edge locations en ~30-60 segundos)"
echo ""

# --- Paso 5: Limpiar assets huérfanos de deploys anteriores ---
echo -e "${YELLOW}▶ [5/5] Esperando 60s para que la invalidación se propague...${NC}"
sleep 60
echo -e "${GREEN}✓ Propagación completada${NC}"
echo ""
echo -e "${YELLOW}▶ Limpiando assets huérfanos...${NC}"

# Listar archivos en S3
S3_FILES=$(aws s3 ls "s3://$BUCKET" --recursive --profile "$PROFILE" --region "$REGION" \
  | awk '{print $4}' | sort)

# Listar archivos en el dist local
LOCAL_FILES=$(find "$DIST_PATH" -type f | sed "s|$DIST_PATH/||" | sort)

# Encontrar archivos en S3 que no están en el dist local
ORPHANED=0
while IFS= read -r s3_file; do
  [[ -z "$s3_file" ]] && continue
  if ! echo "$LOCAL_FILES" | grep -qxF "$s3_file"; then
    aws s3 rm "s3://$BUCKET/$s3_file" --profile "$PROFILE" --region "$REGION" --no-cli-pager > /dev/null 2>&1
    ORPHANED=$((ORPHANED + 1))
  fi
done <<< "$S3_FILES"

if [[ $ORPHANED -gt 0 ]]; then
  echo -e "${GREEN}✓ $ORPHANED archivos huérfanos eliminados${NC}"
else
  echo -e "${GREEN}✓ No hay archivos huérfanos${NC}"
fi
echo ""

# --- Resumen ---
echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}  ✓ Deploy completado — $STAGE${NC}"
echo -e "${GREEN}================================================${NC}"
echo ""
echo -e "  Distribution: $DISTRIBUTION_ID"
echo -e "  Invalidación: $INVALIDATION_ID"
echo ""
echo -e "  ${CYAN}Los usuarios obtendrán la nueva versión en su próxima visita.${NC}"
echo -e "  ${CYAN}No es necesario borrar cache del navegador.${NC}"
echo ""
