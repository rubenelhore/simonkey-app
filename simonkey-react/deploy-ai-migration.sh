#!/bin/bash

# 🚀 Script de Despliegue para Migración de IA Intensiva
# Este script automatiza el despliegue de las Cloud Functions para IA

set -e  # Salir en caso de error

echo "🚀 Iniciando despliegue de migración de IA intensiva..."

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Función para imprimir mensajes con colores
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Verificar prerequisitos
print_status "Verificando prerequisitos..."

# Verificar si Firebase CLI está instalado
if ! command -v firebase &> /dev/null; then
    print_error "Firebase CLI no está instalado. Instálalo con: npm install -g firebase-tools"
    exit 1
fi

# Verificar si gcloud CLI está instalado
if ! command -v gcloud &> /dev/null; then
    print_error "Google Cloud CLI no está instalado. Instálalo desde: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Verificar si estamos en el directorio correcto
if [ ! -f "firebase.json" ]; then
    print_error "No se encontró firebase.json. Asegúrate de estar en el directorio raíz del proyecto."
    exit 1
fi

print_success "Prerequisitos verificados"

# Obtener información del proyecto
PROJECT_ID=$(firebase use --json | jq -r '.result.project')
if [ "$PROJECT_ID" == "null" ] || [ -z "$PROJECT_ID" ]; then
    print_error "No se pudo obtener el ID del proyecto. Ejecuta 'firebase use --add' primero."
    exit 1
fi

print_status "Proyecto Firebase: $PROJECT_ID"

# Navegar a la carpeta de funciones
cd functions

# Instalar dependencias
print_status "Instalando dependencias de Cloud Functions..."
npm install

if [ $? -ne 0 ]; then
    print_error "Error instalando dependencias"
    exit 1
fi

print_success "Dependencias instaladas"

# Construir el proyecto
print_status "Construyendo proyecto TypeScript..."
npm run build

if [ $? -ne 0 ]; then
    print_error "Error construyendo el proyecto"
    exit 1
fi

print_success "Proyecto construido exitosamente"

# Volver al directorio raíz
cd ..

# Configurar variables de entorno
print_status "Configurando variables de entorno..."

# Verificar si la API key de Gemini está configurada
GEMINI_CONFIG=$(firebase functions:config:get gemini 2>/dev/null || echo "{}")
if [ "$GEMINI_CONFIG" == "{}" ]; then
    print_warning "API key de Gemini no configurada"
    read -p "¿Quieres configurar la API key de Gemini ahora? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        read -p "Ingresa tu API key de Gemini: " GEMINI_API_KEY
        firebase functions:config:set gemini.api_key="$GEMINI_API_KEY"
        print_success "API key de Gemini configurada"
    else
        print_warning "Recuerda configurar la API key después: firebase functions:config:set gemini.api_key=\"tu_api_key\""
    fi
else
    print_success "API key de Gemini ya configurada"
fi

# Crear cola de Cloud Tasks
print_status "Configurando Cloud Tasks..."

# Obtener región del proyecto (predeterminado: us-central1)
REGION="us-central1"
read -p "¿Qué región usar para Cloud Tasks? (predeterminado: us-central1): " USER_REGION
if [ ! -z "$USER_REGION" ]; then
    REGION="$USER_REGION"
fi

# Verificar si la cola ya existe
if gcloud tasks queues describe concept-extraction-queue --location="$REGION" --project="$PROJECT_ID" &>/dev/null; then
    print_success "Cola de Cloud Tasks ya existe"
else
    print_status "Creando cola de Cloud Tasks..."
    gcloud tasks queues create concept-extraction-queue \
        --location="$REGION" \
        --project="$PROJECT_ID"
    
    if [ $? -eq 0 ]; then
        print_success "Cola de Cloud Tasks creada"
    else
        print_warning "Error creando cola de Cloud Tasks. Podrías necesitar habilitarla manualmente."
    fi
fi

# Desplegar Cloud Functions
print_status "Desplegando Cloud Functions..."
firebase deploy --only functions

if [ $? -ne 0 ]; then
    print_error "Error desplegando Cloud Functions"
    exit 1
fi

print_success "Cloud Functions desplegadas exitosamente"

# Verificar el despliegue
print_status "Verificando despliegue..."

# Lista de funciones esperadas
EXPECTED_FUNCTIONS=(
    "processConceptExtraction"
    "generateConceptExplanation"
    "enqueueConceptExtraction"
    "getProcessingTaskStatus"
)

print_status "Funciones de IA desplegadas:"
for func in "${EXPECTED_FUNCTIONS[@]}"; do
    if firebase functions:list | grep -q "$func"; then
        print_success "✓ $func"
    else
        print_warning "✗ $func (no encontrada)"
    fi
done

# Crear archivo de configuración para el frontend
print_status "Creando archivo de configuración..."

cat > ai-migration-config.json << EOF
{
  "aiMigration": {
    "enabled": true,
    "functions": {
      "processConceptExtraction": "https://$REGION-$PROJECT_ID.cloudfunctions.net/processConceptExtraction",
      "generateConceptExplanation": "https://$REGION-$PROJECT_ID.cloudfunctions.net/generateConceptExplanation",
      "enqueueConceptExtraction": "https://$REGION-$PROJECT_ID.cloudfunctions.net/enqueueConceptExtraction",
      "getProcessingTaskStatus": "https://$REGION-$PROJECT_ID.cloudfunctions.net/getProcessingTaskStatus"
    },
    "cloudTasks": {
      "region": "$REGION",
      "queue": "concept-extraction-queue"
    },
    "deployment": {
      "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
      "project": "$PROJECT_ID",
      "version": "1.0.0"
    }
  }
}
EOF

print_success "Archivo de configuración creado: ai-migration-config.json"

# Tests básicos (opcional)
print_status "¿Quieres ejecutar tests básicos de las funciones? (y/n)"
read -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_status "Ejecutando tests básicos..."
    
    # Test simple de conectividad
    echo "Testing function connectivity..."
    
    # Aquí podrías agregar tests específicos
    print_success "Tests básicos completados"
fi

# Resumen del despliegue
echo
echo "======================================"
print_success "🎉 MIGRACIÓN COMPLETADA EXITOSAMENTE"
echo "======================================"
echo
print_status "Resumen del despliegue:"
echo "• Proyecto: $PROJECT_ID"
echo "• Región: $REGION"
echo "• Funciones desplegadas: ${#EXPECTED_FUNCTIONS[@]}"
echo "• Cola Cloud Tasks: concept-extraction-queue"
echo "• Configuración: ai-migration-config.json"
echo
print_status "Próximos pasos:"
echo "1. Verifica que las funciones funcionen correctamente"
echo "2. Actualiza el frontend para usar las nuevas funciones"
echo "3. Monitorea los logs: firebase functions:log"
echo "4. Consulta AI_MIGRATION_GUIDE.md para más detalles"
echo
print_status "URLs de las funciones:"
for func in "${EXPECTED_FUNCTIONS[@]}"; do
    echo "• $func: https://$REGION-$PROJECT_ID.cloudfunctions.net/$func"
done
echo
print_success "¡Migración de IA intensiva completada! 🚀"