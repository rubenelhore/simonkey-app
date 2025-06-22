# 🚀 Sistema Pub/Sub Event-Driven para IA - Simonkey

## 📋 Resumen

Este documento describe la implementación del sistema Cloud Pub/Sub para crear una arquitectura event-driven escalable que desacopla las funcionalidades de IA de Simonkey. El sistema permite procesar historias, canciones, imágenes mnemotécnicas y otros contenidos de IA de manera paralela y resiliente.

## 🏗️ Arquitectura

### Beneficios del Sistema Event-Driven

- **📈 Escalabilidad**: Cada componente puede escalar independientemente según la carga
- **🔄 Resiliencia**: Un fallo en generar una imagen no afecta la extracción de conceptos
- **⚡ Paralelismo**: Múltiples tareas de IA se ejecutan simultáneamente
- **🔧 Mantenibilidad**: Fácil añadir o modificar pasos sin impactar el frontend
- **📊 Monitoreo**: Seguimiento detallado del estado de cada proceso

### Componentes Principales

```
Frontend → processAIContent() → Pub/Sub Topics → Subscriber Functions → Database
                ↓
        aiProcessingRequests (Estado)
                ↓
        educationalContent (Resultados)
```

## 📝 Tópicos Pub/Sub

| Tópico | Descripción | Función Subscriber |
|--------|-------------|-------------------|
| `concept-processing` | Extracción de conceptos con IA | `processConceptExtraction` |
| `story-generation` | Generación de historias educativas | `generateEducationalStory` |
| `song-generation` | Creación de canciones mnemotécnicas | `generateMnemonicSong` |
| `image-generation` | Generación de imágenes mnemotécnicas | `generateMnemonicImage` |
| `quiz-generation` | Creación de quizzes automáticos | *(Pendiente)* |
| `ai-results` | Notificaciones de resultados | *(Futuro)* |

## 🔧 Funciones Disponibles

### 1. `processAIContent` - Función Publisher Principal

**Propósito**: Punto de entrada para iniciar cualquier flujo de procesamiento de IA.

**Uso desde el Frontend**:
```javascript
const result = await processAIContent({
  type: 'CONCEPT_EXTRACTION', // o STORY_GENERATION, SONG_GENERATION, etc.
  userId: 'user123',
  notebookId: 'notebook456',
  data: {
    content: 'Texto a procesar con IA...'
  },
  priority: 'NORMAL' // LOW, NORMAL, HIGH
});

console.log('Request ID:', result.requestId);
console.log('Tiempo estimado:', result.estimatedProcessingTime);
```

### 2. Funciones Subscriber (Procesamiento)

#### `processConceptExtraction`
- Extrae conceptos del contenido usando IA
- Genera automáticamente eventos paralelos para historia, canción e imagen
- Tiempo: 2-3 minutos

#### `generateEducationalStory`
- Crea historias educativas basadas en conceptos
- Tiempo: 3-4 minutos

#### `generateMnemonicSong`
- Genera canciones para memorizar conceptos
- Tiempo: 2-3 minutos

#### `generateMnemonicImage`
- Crea imágenes mnemotécnicas
- Tiempo: 4-5 minutos

### 3. `getAIProcessingStatus` - Consulta de Estado

```javascript
const status = await getAIProcessingStatus({
  requestId: 'request123',
  userId: 'user123'
});

console.log('Estado:', status.status); // QUEUED, PROCESSING, COMPLETED, ERROR
console.log('Contenido generado:', status.generatedContent);
```

## 📊 Estados de Procesamiento

| Estado | Descripción |
|--------|-------------|
| `QUEUED` | Evento publicado, esperando procesamiento |
| `PROCESSING` | Función subscriber ejecutándose |
| `COMPLETED` | Procesamiento exitoso, contenido generado |
| `ERROR` | Error en el procesamiento |

## 🗄️ Estructura de Base de Datos

### Colección: `aiProcessingRequests`
```javascript
{
  type: 'CONCEPT_EXTRACTION',
  userId: 'user123',
  notebookId: 'notebook456',
  requestId: 'unique_request_id',
  status: 'COMPLETED',
  priority: 'NORMAL',
  createdAt: Timestamp,
  processingStartedAt: Timestamp,
  completedAt: Timestamp,
  result: {
    conceptsId: 'concepts123',
    conceptsCount: 5
  }
}
```

### Colección: `educationalContent`
```javascript
{
  type: 'STORY', // SONG, IMAGE
  userId: 'user123',
  notebookId: 'notebook456',
  conceptId: 'concept123',
  content: {
    title: 'Historia Educativa',
    content: 'Había una vez...',
    characters: ['Héroe', 'Concepto']
  },
  generatedBy: 'AI_STORY_GENERATOR',
  createdAt: Timestamp,
  metadata: {
    requestId: 'request123',
    conceptsUsed: 3
  }
}
```

## 🚀 Flujo de Procesamiento Típico

### 1. Extracción de Conceptos con Contenido Paralelo

```javascript
// 1. Frontend inicia extracción
const extraction = await processAIContent({
  type: 'CONCEPT_EXTRACTION',
  userId: 'user123',
  notebookId: 'notebook456',
  data: { content: 'Contenido educativo...' }
});

// 2. Sistema procesa y genera automáticamente:
// - Conceptos extraídos
// - Historia educativa (paralelo)
// - Canción mnemotécnica (paralelo)  
// - Imagen mnemotécnica (paralelo)

// 3. Frontend consulta estado
const status = await getAIProcessingStatus({
  requestId: extraction.requestId,
  userId: 'user123'
});
```

### 2. Generación Individual de Contenido

```javascript
// Generar solo una historia
const story = await processAIContent({
  type: 'STORY_GENERATION',
  userId: 'user123',
  notebookId: 'notebook456',
  conceptId: 'existing_concept_id',
  data: { 
    concepts: [
      { concepto: 'Fotosíntesis', explicacion: '...' }
    ]
  }
});
```

## ⚙️ Configuración y Deployment

### 1. Dependencias Requeridas

```json
{
  "@google-cloud/pubsub": "^4.5.0",
  "firebase-functions": "^6.8.0",
  "firebase-admin": "^13.4.0"
}
```

### 2. Configuración de Tópicos Pub/Sub

Los tópicos se crean automáticamente al publicar mensajes, pero puedes crearlos manualmente:

```bash
# Crear tópicos
gcloud pubsub topics create concept-processing
gcloud pubsub topics create story-generation
gcloud pubsub topics create song-generation
gcloud pubsub topics create image-generation
gcloud pubsub topics create quiz-generation
```

### 3. Despliegue

```bash
# Instalar dependencias
cd functions
npm install

# Desplegar funciones
firebase deploy --only functions
```

## 🔍 Monitoreo y Debugging

### Logs Estructurados

Todas las funciones usan logging estructurado con emojis para fácil identificación:

- 🚀 Inicio de procesamiento
- 🧠 Extracción de conceptos
- 📚 Generación de historia
- 🎵 Generación de canción
- 🎨 Generación de imagen
- ✅ Procesamiento exitoso
- ❌ Errores

### Consulta de Logs

```bash
# Ver logs de todas las funciones de IA
firebase functions:log --only processAIContent,processConceptExtraction,generateEducationalStory

# Filtrar por request específico
firebase functions:log | grep "request123"
```

## 🛠️ Extensibilidad

### Agregar Nuevos Tipos de IA

1. **Agregar nuevo tipo al enum**:
```typescript
interface AIProcessingEvent {
  type: 'CONCEPT_EXTRACTION' | 'STORY_GENERATION' | 'SONG_GENERATION' | 
        'IMAGE_GENERATION' | 'QUIZ_GENERATION' | 'NEW_AI_TYPE';
  // ...
}
```

2. **Crear nuevo tópico**:
```typescript
const TOPICS = {
  // ... existentes
  NEW_AI_PROCESSING: 'new-ai-processing'
};
```

3. **Implementar función subscriber**:
```typescript
export const processNewAIType = onCall({
  maxInstances: 10,
  timeoutSeconds: 180,
  memory: "512MiB",
}, async (request) => {
  // Lógica de procesamiento
});
```

### Integración con Servicios de IA Reales

Reemplaza las funciones de simulación con llamadas reales:

```typescript
async function extractConceptsWithAI(content: string): Promise<any[]> {
  // Reemplazar con llamada real a GPT, Gemini, etc.
  const response = await geminiAPI.generateContent({
    prompt: `Extrae conceptos clave de: ${content}`,
    model: 'gemini-pro'
  });
  
  return parseConceptsFromResponse(response);
}
```

## 🔒 Seguridad y Límites

### Control de Acceso
- Todas las funciones requieren autenticación
- Verificación de propiedad de recursos (userId)
- Rate limiting configurado por función

### Límites de Recursos
- Timeouts configurados por tipo de procesamiento
- Memoria asignada según complejidad
- Máximo de instancias concurrentes

### Manejo de Errores
- Estados de error registrados en DB
- Logs detallados para debugging
- Reintentos automáticos (futuro)

## 📈 Métricas y Rendimiento

### Tiempos Estimados
- Extracción de conceptos: 2-3 minutos
- Generación de historia: 3-4 minutos
- Generación de canción: 2-3 minutos
- Generación de imagen: 4-5 minutos

### Escalabilidad
- Procesamiento paralelo de múltiples requests
- Auto-scaling basado en carga
- Desacoplamiento completo entre componentes

## 🎯 Próximos Pasos

1. **Integración de IA Real**: Conectar con servicios como GPT-4, Gemini
2. **Webhooks**: Notificaciones push cuando el procesamiento termina
3. **Reintentos**: Sistema automático de reintentos en fallos
4. **Caching**: Cache de resultados para contenido similar
5. **Analytics**: Métricas detalladas de uso y rendimiento
6. **Queue Management**: Priorización inteligente de requests

---

## 💡 Ejemplo Completo de Uso

```javascript
// Frontend - Inicio del flujo completo
async function processNotebookWithAI(notebookId, content) {
  try {
    // 1. Iniciar extracción (dispara contenido paralelo automáticamente)
    const extraction = await processAIContent({
      type: 'CONCEPT_EXTRACTION',
      userId: getCurrentUserId(),
      notebookId,
      data: { content },
      priority: 'HIGH'
    });
    
    // 2. Mostrar estado inicial
    setProcessingStatus('Iniciando extracción de conceptos...');
    
    // 3. Polling del estado
    const pollStatus = setInterval(async () => {
      const status = await getAIProcessingStatus({
        requestId: extraction.requestId,
        userId: getCurrentUserId()
      });
      
      if (status.status === 'COMPLETED') {
        clearInterval(pollStatus);
        setProcessingStatus('¡Procesamiento completado!');
        
        // 4. Mostrar todo el contenido generado
        displayGeneratedContent(status.generatedContent);
      } else if (status.status === 'ERROR') {
        clearInterval(pollStatus);
        setError('Error en el procesamiento');
      } else {
        setProcessingStatus(`Estado: ${status.status}`);
      }
    }, 5000);
    
  } catch (error) {
    console.error('Error:', error);
    setError('Error iniciando procesamiento');
  }
}
```

Esta implementación de Pub/Sub prepara a Simonkey para un crecimiento escalable de sus funcionalidades de IA, manteniendo una arquitectura limpia y mantenible.