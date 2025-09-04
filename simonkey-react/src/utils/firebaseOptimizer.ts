// Utilidades para optimizar consultas a Firebase
import { collection, query, where, getDocs, DocumentSnapshot, DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';

// Cache para consultas recientes
const queryCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 30000; // 30 segundos

// Función para generar clave de cache
function getCacheKey(collectionName: string, filters: any[]): string {
  return `${collectionName}_${JSON.stringify(filters)}`;
}

// Función para verificar si el cache está válido
function isCacheValid(timestamp: number): boolean {
  return Date.now() - timestamp < CACHE_DURATION;
}

// Función para consultas con cache
export async function cachedQuery(
  collectionName: string, 
  filters: Array<{ field: string; operator: any; value: any }>
): Promise<QueryDocumentSnapshot<DocumentData>[]> {
  const cacheKey = getCacheKey(collectionName, filters);
  const cached = queryCache.get(cacheKey);
  
  if (cached && isCacheValid(cached.timestamp)) {
    console.log(`🎯 Cache hit para ${collectionName}`);
    return cached.data;
  }
  
  // Construir query
  let q = collection(db, collectionName);
  for (const filter of filters) {
    q = query(q as any, where(filter.field, filter.operator, filter.value)) as any;
  }
  
  const snapshot = await getDocs(q as any);
  const docs = snapshot.docs as QueryDocumentSnapshot<DocumentData>[];
  
  // Guardar en cache
  queryCache.set(cacheKey, {
    data: docs,
    timestamp: Date.now()
  });
  
  console.log(`📊 Query ejecutada y cacheada para ${collectionName}: ${docs.length} documentos`);
  return docs;
}

// Función para limpiar cache expirado
export function cleanExpiredCache(): void {
  const now = Date.now();
  for (const [key, value] of queryCache.entries()) {
    if (!isCacheValid(value.timestamp)) {
      queryCache.delete(key);
    }
  }
}

// Función para consultas en lote con límite de concurrencia
export async function batchedQuery<T>(
  items: T[],
  queryFn: (item: T) => Promise<any>,
  batchSize: number = 5,
  delay: number = 100
): Promise<any[]> {
  const results: any[] = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    
    try {
      const batchResults = await Promise.all(
        batch.map(item => queryFn(item))
      );
      results.push(...batchResults);
      
      // Pequeña pausa entre lotes para no saturar Firebase
      if (i + batchSize < items.length) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    } catch (error) {
      console.error(`Error en lote ${i / batchSize + 1}:`, error);
      // Continuar con el siguiente lote en caso de error
      results.push(...new Array(batch.length).fill(null));
    }
  }
  
  return results;
}

// Función para optimizar conteo de documentos
export async function optimizedCount(
  collectionName: string,
  filters: Array<{ field: string; operator: any; value: any }>
): Promise<number> {
  const cacheKey = `count_${getCacheKey(collectionName, filters)}`;
  const cached = queryCache.get(cacheKey);
  
  if (cached && isCacheValid(cached.timestamp)) {
    return cached.data;
  }
  
  const docs = await cachedQuery(collectionName, filters);
  const count = docs.length;
  
  queryCache.set(cacheKey, {
    data: count,
    timestamp: Date.now()
  });
  
  return count;
}

// Limpiar cache periódicamente
setInterval(cleanExpiredCache, 60000); // Cada minuto