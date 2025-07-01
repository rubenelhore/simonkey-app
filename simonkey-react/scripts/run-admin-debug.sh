#!/bin/bash

# Script para ejecutar el debug con Admin SDK
# Necesitas configurar estas variables con tus credenciales de servicio

echo "🔍 Para ejecutar este script necesitas:"
echo "1. Descargar la clave de servicio desde Firebase Console"
echo "2. Ir a: Configuración del proyecto > Cuentas de servicio"
echo "3. Generar nueva clave privada"
echo "4. Guardar el archivo JSON descargado"
echo ""
echo "Luego ejecuta:"
echo "export GOOGLE_APPLICATION_CREDENTIALS='/ruta/a/tu/archivo-de-credenciales.json'"
echo "node scripts/debug-teacher-admin.js"
echo ""
echo "O puedes ejecutar directamente con las credenciales en línea:"
echo "FIREBASE_PROJECT_ID='simonkey-5c78f' \\"
echo "FIREBASE_CLIENT_EMAIL='tu-email-de-servicio@simonkey-5c78f.iam.gserviceaccount.com' \\"
echo "FIREBASE_PRIVATE_KEY='-----BEGIN PRIVATE KEY-----\\nTU_CLAVE_PRIVADA\\n-----END PRIVATE KEY-----\\n' \\"
echo "node scripts/debug-teacher-admin.js"