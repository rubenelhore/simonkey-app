# 🔒 Migración Segura de Gemini API a Cloud Functions

## 📋 Resumen

Esta migración traslada todas las llamadas a la API de Gemini desde el frontend al backend usando Firebase Cloud Functions, eliminando el grave riesgo de seguridad de exponer claves API en el navegador.

## ⚠️ Problema de Seguridad Resuelto

### **Antes (INSEGURO):**
- Clave API de Gemini expuesta en variables de entorno del frontend (`VITE_GEMINI_API_KEY`)
- Accesible desde el navegador por cualquier usuario
- Sin control de uso o límites
- Vulnerable a abuso y extracción maliciosa

### **Después (SEGURO):**
- Clave API protegida en Cloud Functions (`GEMINI_API_KEY`)
- No accesible desde el navegador
- Control de uso por tipo de usuario
- Autenticación y autorización requeridas
- Logging completo para auditoría

## 🚀 Funciones Cloud Implementadas

### 1. **`generateConcepts`**
- **Propósito**: Generar conceptos desde archivos subidos
- **Reemplaza**: Llamadas directas en `NotebookDetail.tsx`
- **Límites**: 5/día (FREE), 15/día (SCHOOL), 20/día (PRO), 50/día (SUPER_ADMIN)

### 2. **`explainConcept`**
- **Propósito**: Explicar conceptos con diferentes enfoques
- **Reemplaza**: Llamadas directas en `ExplainConcept.tsx`
- **Tipos**: simple, related, interests, mnemotecnia
- **Límites**: 15/día (FREE), 30/día (SCHOOL), 50/día (PRO), 100/día (SUPER_ADMIN)

### 3. **`generateContent`**
- **Propósito**: Generación general de contenido
- **Uso**: Para casos específicos no cubiertos por otras funciones
- **Límites**: 10/día (FREE), 20/día (SCHOOL), 30/día (PRO), 50/día (SUPER_ADMIN)

## 🔧 Configuración de Variables de Entorno

### **Cloud Functions (BACKEND)**
Configura la clave API de Gemini de forma segura:

```bash
# Navegar al directorio de functions
cd functions

# Configurar variable de entorno segura
firebase functions:config:set gemini.api_key="tu_clave_api_de_gemini_aqui"

# Desplegar las funciones con la nueva configuración
npm run deploy
```

### **Frontend (LIMPIEZA)**
Remover la clave API expuesta del frontend:

```bash
# .env.local (REMOVER esta línea)
# VITE_GEMINI_API_KEY=tu_clave_api  # ❌ YA NO USAR

# Las demás variables de Firebase pueden mantenerse
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
# etc.
```

## 📝 Cambios en el Código

### **Archivos Modificados:**

1. **`functions/src/index.ts`**
   - ✅ Agregadas 3 nuevas Cloud Functions
   - ✅ Importación de `@google/generative-ai`
   - ✅ Control de autenticación y autorización
   - ✅ Límites de uso por tipo de usuario
   - ✅ Manejo robusto de errores

2. **`functions/package.json`**
   - ✅ Agregada dependencia `@google/generative-ai`

3. **`src/services/firebaseFunctions.ts`**
   - ✅ Agregadas funciones del cliente para llamar Cloud Functions
   - ✅ Funciones utilitarias para conversión de archivos
   - ✅ Manejo específico de errores de Cloud Functions

4. **`src/pages/NotebookDetail.tsx`**
   - ✅ Reemplazada generación directa con `generateConcepts()`
   - ✅ Removidas importaciones de Gemini
   - ✅ Simplificado manejo de archivos

5. **`src/components/ExplainConcept.tsx`**
   - ✅ Reemplazada explicación directa con `explainConcept()`
   - ✅ Removidas referencias a API key
   - ✅ Mejorado manejo de errores

6. **`src/services/geminiService.ts`**
   - ✅ Deprecado con documentación completa
   - ✅ Advertencias para desarrolladores

## 🛡️ Beneficios de Seguridad

### **Protección de Claves API**
- Las claves nunca salen del servidor
- Acceso controlado mediante funciones autenticadas
- Cumplimiento de mejores prácticas de seguridad

### **Control de Uso**
- Límites diarios por tipo de usuario
- Prevención de abuso de la API
- Tracking de uso para análisis

### **Autenticación y Autorización**
- Solo usuarios autenticados pueden usar las funciones
- Verificación de permisos por función
- Logs detallados para auditoría

### **Manejo de Errores**
- Errores específicos para diferentes situaciones
- Mensajes informativos para el usuario
- Logging centralizado en Cloud Functions

## 📊 Control de Límites por Usuario

| Tipo de Usuario | Conceptos/día | Explicaciones/día | Contenido/día |
|----------------|---------------|-------------------|---------------|
| FREE           | 5             | 15                | 10            |
| PRO            | 20            | 50                | 30            |
| SCHOOL         | 15            | 30                | 20            |
| SUPER_ADMIN    | 50            | 100               | 50            |

## 🚀 Pasos de Despliegue

### **1. Instalar Dependencias**
```bash
cd functions
npm install
```

### **2. Configurar Variables de Entorno**
```bash
firebase functions:config:set gemini.api_key="tu_clave_api_de_gemini"
```

### **3. Desplegar Cloud Functions**
```bash
npm run deploy
```

### **4. Actualizar Frontend**
```bash
cd ..
npm install  # Si es necesario
npm run build
```

### **5. Verificar Funcionamiento**
- Probar generación de conceptos desde archivos
- Probar explicaciones de conceptos
- Verificar límites de uso
- Comprobar manejo de errores

## 🔍 Monitoreo y Debugging

### **Logs de Cloud Functions**
```bash
# Ver logs en tiempo real
firebase functions:log

# Ver logs específicos de una función
firebase functions:log --only generateConcepts
```

### **Métricas de Uso**
- Acceso a Firebase Console > Functions
- Revisar invocaciones y errores
- Monitorear uso de cuotas

## 🆘 Troubleshooting

### **Error: "Servicio de IA no disponible"**
- Verificar configuración de `GEMINI_API_KEY`
- Comprobar créditos de la API de Gemini
- Revisar logs de Cloud Functions

### **Error: "Límite diario alcanzado"**
- Esperado para usuarios con límites
- Verificar tipo de usuario en Firestore
- Considerar upgrade de plan

### **Error: "No autenticado"**
- Usuario debe estar logueado
- Verificar token de Firebase Auth
- Comprobar reglas de seguridad

## ✅ Lista de Verificación Post-Migración

- [ ] Cloud Functions desplegadas exitosamente
- [ ] Variable `GEMINI_API_KEY` configurada en Functions
- [ ] Generación de conceptos funciona desde archivos
- [ ] Explicaciones de conceptos funcionan correctamente
- [ ] Límites de uso se aplican apropiadamente
- [ ] Manejo de errores es correcto
- [ ] `VITE_GEMINI_API_KEY` removida del frontend
- [ ] No hay referencias a `geminiService.ts` en código activo
- [ ] Logs de Cloud Functions muestran actividad normal

## 📚 Recursos Adicionales

- [Firebase Cloud Functions Documentation](https://firebase.google.com/docs/functions)
- [Gemini API Documentation](https://ai.google.dev/docs)
- [Firebase Functions Configuration](https://firebase.google.com/docs/functions/config-env)

---

**Migración completada**: ✅ Las claves API ahora están seguras en el backend
**Fecha**: [Fecha actual]
**Responsable**: Sistema de migración automática