#!/bin/bash

# ==============================================================================
# Script: sync_db.sh
# Descripción: Sincroniza la base de datos de producción a la de desarrollo.
# Uso: ./scripts/sync_db.sh [nombre_contenedor_origen]
# ==============================================================================

# Configuración por defecto
SRC_CONTAINER=${1:-"ski_prod-postgres-1"}
DST_CONTAINER="ski_dev-postgres-1"
DB_USER="postgres"
DB_NAME="postgres"

# Colores para la terminal
BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}===================================================${NC}"
echo -e "${BLUE}   Sincronizador de Base de Datos: Prod -> Dev      ${NC}"
echo -e "${BLUE}===================================================${NC}"

# 1. Verificar si el contenedor de desarrollo (destino) está corriendo
if [ "$(docker ps -q -f name=$DST_CONTAINER)" ]; then
    echo -e "${GREEN}[OK]${NC} Contenedor de destino ($DST_CONTAINER) detectado."
else
    echo -e "${RED}[ERROR]${NC} El contenedor de destino ($DST_CONTAINER) no está encendido."
    echo -e "       Asegúrate de ejecutar: docker compose -f docker-compose.dev.yml up -d"
    exit 1
fi

# 2. Verificar si el contenedor de origen está corriendo localmente
if [ "$(docker ps -q -f name=$SRC_CONTAINER)" ]; then
    echo -e "${GREEN}[OK]${NC} Contenedor de origen ($SRC_CONTAINER) detectado."
    
    # Preguntar confirmación
    echo -e "${YELLOW}ADVERTENCIA: Se borrarán todos los datos en DESARROLLO ($DST_CONTAINER)${NC}"
    read -p "¿Deseas continuar con la sobrescritura? (s/n): " confirm
    if [[ ! $confirm =~ ^[sS]$ ]]; then
        echo "Operación cancelada."
        exit 0
    fi

    echo -e "${BLUE}Copiando datos desde $SRC_CONTAINER a $DST_CONTAINER...${NC}"
    
    # Ejecutar dump y restore en un solo flujo
    # --clean: Limpia el destino antes de insertar
    # --if-exists: Evita errores de limpieza si las tablas no existen
    # --no-owner y --no-privileges: Para evitar conflictos de permisos de roles
    docker exec -t "$SRC_CONTAINER" pg_dump -U "$DB_USER" "$DB_NAME" --clean --if-exists --no-owner --no-privileges | \
    docker exec -i "$DST_CONTAINER" psql -U "$DB_USER" "$DB_NAME"

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}¡Éxito! La base de datos de desarrollo ha sido actualizada.${NC}"
    else
        echo -e "${RED}[ERROR]${NC} Falló la transferencia de datos."
    fi

else
    echo -e "${YELLOW}[INFO]${NC} No se encontró el contenedor '$SRC_CONTAINER' corriendo localmente."
    echo -e ""
    echo -e "Opciones:"
    echo -e "1. Si el contenedor de producción tiene otro nombre, pásalo como argumento:"
    echo -e "   ${GREEN}./scripts/sync_db.sh nombre_del_contenedor${NC}"
    echo -e ""
    echo -e "2. Si la producción está en un SERVIDOR REMOTO, usa SSH para el dump:"
    echo -e "   ${BLUE}ssh usuario@tu-servidor 'docker exec -t $SRC_CONTAINER pg_dump -U $DB_USER $DB_NAME --clean --if-exists --no-owner' | docker exec -i $DST_CONTAINER psql -U $DB_USER $DB_NAME${NC}"
    echo -e ""
    echo -e "${YELLOW}Nota:${NC} Asegúrate de tener configurado el acceso SSH sin contraseña o usa el comando manualmente."
fi
echo -e "${BLUE}===================================================${NC}"
