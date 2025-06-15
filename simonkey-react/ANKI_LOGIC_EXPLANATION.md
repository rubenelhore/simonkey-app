# 📚 Explicación de la Lógica Anki en Simonkey

## ¿Qué es Anki?

Anki es un sistema de **Repetición Espaciada (Spaced Repetition)** que optimiza el aprendizaje basándose en cómo funciona la memoria humana. El principio fundamental es que **revisar información en intervalos cada vez más largos** mejora significativamente la retención a largo plazo.

## 🧠 Cómo Funciona la Memoria

### Curva del Olvido
- **Inmediatamente**: Recordamos ~100% de la información
- **1 día después**: Recordamos ~30-40%
- **1 semana después**: Recordamos ~10-20%
- **1 mes después**: Recordamos ~5-10%

### Repetición Espaciada
La repetición espaciada **"resetea"** la curva del olvido, haciendo que cada vez sea más fácil recordar la información.

## 🔄 Algoritmo SM-2 (SuperMemo 2)

Nuestro sistema usa una versión simplificada del algoritmo SM-2:

### Variables Clave
```typescript
interface LearningData {
  easeFactor: number;    // Factor de facilidad (2.5 por defecto)
  interval: number;      // Intervalo en días hasta el próximo repaso
  repetitions: number;   // Número de repasos exitosos consecutivos
  nextReviewDate: Date;  // Próxima fecha de repaso
}
```

### Lógica Simplificada

#### Cuando el usuario marca "Dominado" ✅
```typescript
if (quality === ResponseQuality.MASTERED) {
  // Primera vez: repasar en 1 día
  if (repetitions === 0) {
    interval = 1;
  }
  // Segunda vez: repasar en 6 días
  else if (repetitions === 1) {
    interval = 6;
  }
  // Después: intervalo = intervalo anterior × factor de facilidad
  else {
    interval = Math.round(interval * easeFactor);
  }
  
  repetitions++;
  // Aumentar ligeramente el factor de facilidad
  easeFactor = Math.min(2.5, easeFactor + 0.1);
}
```

#### Cuando el usuario marca "Revisar después" 🔄
```typescript
else {
  // Reiniciar el proceso
  repetitions = 0;
  interval = 1; // Repasar mañana
  
  // Reducir el factor de facilidad
  easeFactor = Math.max(1.3, easeFactor - 0.2);
}
```

## 📊 Ejemplo Práctico

### Concepto: "Photosíntesis"

**Día 1 - Concepto recién creado:**
- Concepto disponible inmediatamente en estudio inteligente
- `interval = 1`, `repetitions = 0`, `easeFactor = 2.5`
- **Próximo repaso**: HOY (disponible para estudiar)

**Día 1 - Primera vez estudiado:**
- Usuario marca "Dominado"
- `interval = 1`, `repetitions = 1`, `easeFactor = 2.6`
- **Próximo repaso**: Día 2

**Día 2 - Segundo repaso:**
- Usuario marca "Dominado"
- `interval = 6`, `repetitions = 2`, `easeFactor = 2.7`
- **Próximo repaso**: Día 8

**Día 8 - Tercer repaso:**
- Usuario marca "Dominado"
- `interval = 16` (6 × 2.7), `repetitions = 3`, `easeFactor = 2.8`
- **Próximo repaso**: Día 24

**Día 24 - Cuarto repaso:**
- Usuario marca "Revisar después"
- `interval = 1`, `repetitions = 0`, `easeFactor = 2.6`
- **Próximo repaso**: Día 25 (reinicio)

## 🎯 Beneficios del Sistema

### 1. **Optimización del Tiempo**
- Solo repasas lo que necesitas repasar
- No pierdes tiempo con conceptos que ya dominas
- Enfocas tu atención en lo que es difícil

### 2. **Retención a Largo Plazo**
- Los conceptos se graban profundamente en la memoria
- Puedes recordar información meses o años después
- Construyes una base sólida de conocimiento

### 3. **Adaptación Personal**
- El sistema se adapta a tu ritmo de aprendizaje
- Conceptos fáciles aparecen menos frecuentemente
- Conceptos difíciles aparecen más frecuentemente

## 🔧 Cómo Funciona en Simonkey

### Modos de Estudio

#### 1. **Modo Estudio** 📖
- Prioriza conceptos nuevos
- Si marcas "Revisar después", se agrega a la cola de repaso
- Al final de la sesión, repasas los conceptos pendientes

#### 2. **Modo Repaso Inteligente** 🔄
- Muestra conceptos que están "vencidos" (due for review) HOY
- **Incluye conceptos nuevos** que están disponibles inmediatamente
- Conceptos que el algoritmo determina que necesitas repasar
- Optimizado para máxima eficiencia de aprendizaje

#### 3. **Modo Evaluación** 🎯
- Mezcla de conceptos aprendidos recientemente
- No afecta el algoritmo SRS
- Solo para evaluar tu progreso

### Cola de Repaso
- Los conceptos marcados como "Revisar después" se agregan a una cola
- Se repasan al final de la sesión actual
- Si no los dominas, aparecerán en el próximo repaso programado

## 📈 Métricas y Progreso

### Estadísticas que se Rastrean
- **Total de conceptos estudiados**
- **Conceptos dominados** (marcados como "Dominado")
- **Conceptos para repasar** (marcados como "Revisar después")
- **Tiempo de estudio**
- **Factor de facilidad promedio**

### Próxima Sesión Recomendada
- El sistema calcula cuándo deberías estudiar nuevamente
- Basado en los conceptos que están próximos a vencer
- Optimizado para máxima retención

## 🚀 Consejos para Usar el Sistema

### 1. **Sé Honesto**
- Solo marca "Dominado" si realmente recuerdas el concepto
- Es mejor marcar "Revisar después" que mentir

### 2. **Estudia Regularmente**
- La repetición espaciada funciona mejor con sesiones frecuentes
- 15-30 minutos diarios es más efectivo que 3 horas una vez por semana

### 3. **Confía en el Algoritmo**
- El sistema está diseñado para optimizar tu aprendizaje
- No te preocupes si algunos conceptos aparecen "muy seguido"

### 4. **Usa el Modo Repaso**
- Cuando tengas conceptos pendientes, usa el botón "Repasar Pendientes"
- Esto te ayuda a mantener el progreso

## 🔬 Ciencia Detrás del Sistema

### Investigación que lo Respalda
- **Hermann Ebbinghaus** (1885): Descubrió la curva del olvido
- **SuperMemo** (1987): Desarrolló el algoritmo SM-2
- **Anki** (2006): Popularizó la repetición espaciada

### Efectividad
- **Estudios muestran** que la repetición espaciada puede mejorar la retención en un 200-400%
- **Médicos, estudiantes de idiomas, y profesionales** usan este método
- **Compatible con el funcionamiento natural del cerebro**

---

*Este sistema está diseñado para ayudarte a aprender de manera más eficiente y efectiva. ¡Confía en el proceso y verás resultados increíbles!* 🎓 