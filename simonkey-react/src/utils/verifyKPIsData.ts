import { db } from '../services/firebase';
import { doc, getDoc } from 'firebase/firestore';

export const verifyKPIsData = async (userId: string) => {
  try {
    console.log('[VerifyKPIsData] === VERIFICANDO DATOS DE KPIs ===');
    console.log('[VerifyKPIsData] Usuario:', userId);
    
    // Obtener el documento de KPIs
    const kpisDocRef = doc(db, 'users', userId, 'kpis', 'dashboard');
    const kpisDoc = await getDoc(kpisDocRef);
    
    if (!kpisDoc.exists()) {
      console.log('[VerifyKPIsData] ❌ No se encontraron KPIs para este usuario');
      console.log('[VerifyKPIsData] Ejecuta testUpdateKPIs para generar los KPIs');
      return null;
    }
    
    const kpisData = kpisDoc.data();
    console.log('[VerifyKPIsData] ✅ KPIs encontrados');
    
    // Verificar datos globales
    console.log('\n[VerifyKPIsData] 🌍 DATOS GLOBALES:');
    console.log('  - Score Global:', kpisData.global?.scoreGlobal || 0);
    console.log('  - Percentil Global:', kpisData.global?.percentilPromedioGlobal || 0);
    console.log('  - Tiempo Estudio Global:', kpisData.global?.tiempoEstudioGlobal || 0, 'minutos');
    console.log('  - Estudios Inteligentes Global:', kpisData.global?.estudiosInteligentesGlobal || 0);
    
    // Verificar tiempo de estudio semanal
    console.log('\n[VerifyKPIsData] 📅 TIEMPO DE ESTUDIO SEMANAL:');
    if (kpisData.tiempoEstudioSemanal) {
      const tiempoSemanal = kpisData.tiempoEstudioSemanal;
      console.log('  - Domingo:', tiempoSemanal.domingo || 0, 'minutos');
      console.log('  - Lunes:', tiempoSemanal.lunes || 0, 'minutos');
      console.log('  - Martes:', tiempoSemanal.martes || 0, 'minutos');
      console.log('  - Miércoles:', tiempoSemanal.miercoles || 0, 'minutos');
      console.log('  - Jueves:', tiempoSemanal.jueves || 0, 'minutos');
      console.log('  - Viernes:', tiempoSemanal.viernes || 0, 'minutos');
      console.log('  - Sábado:', tiempoSemanal.sabado || 0, 'minutos');
      
      const totalSemanal = Object.values(tiempoSemanal).reduce((sum: number, time: any) => sum + (time || 0), 0);
      console.log('  TOTAL SEMANAL:', totalSemanal, 'minutos (', Math.round(totalSemanal / 60 * 10) / 10, 'horas)');
    } else {
      console.log('  ⚠️ No hay datos de tiempoEstudioSemanal');
      console.log('  ℹ️ Ejecuta testUpdateKPIs para actualizar los KPIs con el nuevo formato');
    }
    
    // Verificar cuadernos
    console.log('\n[VerifyKPIsData] 📚 CUADERNOS:');
    if (kpisData.cuadernos) {
      const cuadernosCount = Object.keys(kpisData.cuadernos).length;
      console.log(`  Total de cuadernos: ${cuadernosCount}`);
      
      Object.entries(kpisData.cuadernos).forEach(([cuadernoId, cuadernoData]: [string, any]) => {
        console.log(`  - ${cuadernoId}:`);
        console.log(`    Score: ${cuadernoData.scoreCuaderno || 0}`);
        console.log(`    Tiempo: ${cuadernoData.tiempoEstudioLocal || 0} min`);
        console.log(`    Estudios Inteligentes: ${cuadernoData.estudiosInteligentesLocal || 0}`);
      });
    }
    
    // Verificar materias
    console.log('\n[VerifyKPIsData] 📖 MATERIAS:');
    if (kpisData.materias) {
      const materiasCount = Object.keys(kpisData.materias).length;
      console.log(`  Total de materias: ${materiasCount}`);
      
      Object.entries(kpisData.materias).forEach(([materiaId, materiaData]: [string, any]) => {
        console.log(`  - ${materiaId}:`);
        console.log(`    Score: ${materiaData.scoreMateria || 0}`);
        console.log(`    Tiempo: ${materiaData.tiempoEstudioMateria || 0} min`);
      });
    }
    
    // Verificar última actualización
    console.log('\n[VerifyKPIsData] 🕐 ÚLTIMA ACTUALIZACIÓN:');
    if (kpisData.ultimaActualizacion) {
      const fecha = kpisData.ultimaActualizacion.toDate();
      console.log('  ', fecha.toLocaleString());
      
      const horasDesdeActualizacion = (Date.now() - fecha.getTime()) / (1000 * 60 * 60);
      if (horasDesdeActualizacion > 24) {
        console.log('  ⚠️ Los KPIs tienen más de 24 horas. Considera actualizarlos con testUpdateKPIs');
      }
    }
    
    console.log('\n[VerifyKPIsData] ===================================');
    
    return kpisData;
    
  } catch (error) {
    console.error('[VerifyKPIsData] Error:', error);
    throw error;
  }
};

// Exponer la función para poder usarla desde la consola
(window as any).verifyKPIsData = verifyKPIsData;