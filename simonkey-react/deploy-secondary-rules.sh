#!/bin/bash

echo "🚀 Desplegando reglas de Firestore para la base de datos secundaria..."

# Primero, hacer backup de las reglas actuales
cp firestore.rules firestore.rules.backup

# Copiar las reglas secundarias al archivo principal temporalmente
cp firestore-secondary.rules firestore.rules

# Desplegar las reglas específicamente para la base de datos simonkey-general
firebase deploy --only firestore:rules --project simonkey-5c78f

# Restaurar las reglas originales
cp firestore.rules.backup firestore.rules

echo "✅ Reglas desplegadas exitosamente"