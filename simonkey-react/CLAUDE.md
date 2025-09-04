# Claude Code - Configuración del Proyecto

## Comandos útiles para desarrollo

### Construcción y verificación
```bash
npm run build          # Construir la aplicación
npx tsc --noEmit       # Verificar errores de TypeScript
npm run dev            # Servidor de desarrollo
```

## Optimizaciones de Rendimiento - Página Materias

### Sistema de Lazy Loading para Progreso de Dominio

La página `/materias` ahora implementa un sistema inteligente de carga progresiva del progreso de dominio:

#### 🚀 **Carga Inicial Rápida**
- **Primeras 3 materias**: Se calcula automáticamente después de 500ms
- **Materias restantes**: Se calculan bajo demanda usando:
  - **Intersection Observer**: Cuando la materia entra en viewport
  - **Botón manual**: "Calcular progreso de X materias restantes"
  - **Al navegar**: Antes de entrar a una materia específica

#### 📊 **Componentes Optimizados**

**Archivo**: `src/pages/Materias.tsx`
- `calculateDomainProgress()`: Calcula progreso individual con cache
- `calculateAllRemainingProgress()`: Procesa todas las materias restantes en lotes
- `handleMateriaInView()`: Callback para Intersection Observer

**Archivo**: `src/components/MateriaList.tsx`
- Intersection Observer para detección automática
- Botón para carga manual de progreso restante
- Estados de loading por materia individual

**Archivo**: `src/utils/firebaseOptimizer.ts`
- Sistema de cache para consultas (30 segundos)
- Consultas en lotes con límite de concurrencia
- Conteos optimizados para evitar consultas duplicadas

#### 🎯 **Resultados Esperados**
- **Carga inicial 70% más rápida**: UI aparece inmediatamente
- **Escalabilidad mejorada**: Rendimiento constante con más materias
- **Uso inteligente de recursos**: Solo calcula lo que se necesita
- **Experiencia fluida**: Sin pantallas de carga largas

#### 🔧 **Estados de Progreso**
```typescript
// Estados por materia
progressLoadingStates: Record<string, boolean>

// Cálculo automático para materias visibles
useEffect(() => {
  // Solo primeras 3 materias inicialmente
  // Resto via Intersection Observer
}, [materiasLoaded]);
```

#### 📝 **Usar este Sistema en Otros Componentes**
```typescript
// Importar utilidades
import { cachedQuery, batchedQuery, optimizedCount } from '../utils/firebaseOptimizer';

// Consulta con cache
const docs = await cachedQuery('collection', [
  { field: 'userId', operator: '==', value: userId }
]);

// Procesamiento en lotes
const results = await batchedQuery(
  items,
  async (item) => await processItem(item),
  batchSize: 3,
  delay: 150
);
```

---

*Optimizaciones implementadas para mejorar la experiencia de usuario en `/materias`*