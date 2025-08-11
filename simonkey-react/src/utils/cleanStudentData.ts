import { db } from '../services/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

export async function cleanStudentData() {
  const studentId = 'obdYcp6ui6aCVEiMYdohvE5EY7i1';
  
  console.log('🧹 === LIMPIANDO DATOS DEL ESTUDIANTE ===');
  
  try {
    // 1. Limpiar el documento del usuario
    console.log('📄 Limpiando documento del usuario...');
    const userDoc = await getDoc(doc(db, 'users', studentId));
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      console.log('Estado actual de idCuadernos:', userData.idCuadernos);
      
      // Limpiar idCuadernos
      await updateDoc(doc(db, 'users', studentId), {
        idCuadernos: []
      });
      console.log('✅ idCuadernos limpiado en users');
    }
    
    // 2. Limpiar los KPIs en la colección principal kpis/{userId}
    console.log('\n📊 Limpiando KPIs en colección principal...');
    const kpiDoc = await getDoc(doc(db, 'kpis', studentId));
    
    if (kpiDoc.exists()) {
      const kpiData = kpiDoc.data();
      console.log('KPIs actuales - cuadernos:', Object.keys(kpiData.cuadernos || {}));
      console.log('KPIs actuales - materias:', Object.keys(kpiData.materias || {}));
      
      // Resetear KPIs completamente
      await updateDoc(doc(db, 'kpis', studentId), {
        cuadernos: {},
        materias: {},
        tiempoEstudioSemanal: {},
        global: {
          scoreTotal: 0,
          tiempoEstudioTotal: 0,
          conceptosDominados: 0,
          conceptosEnAprendizaje: 0,
          conceptosSinEstudiar: 0,
          totalConceptos: 0,
          rachaActual: 0,
          rachaMasLarga: 0,
          diasEstudiados: 0,
          estudiosInteligentesCompletados: 0,
          estudiosLibresCompletados: 0,
          quizzesCompletados: 0,
          porcentajeExitoPromedio: 0,
          nivelGeneral: 1,
          experienciaTotal: 0,
          trofeos: 0,
          logros: 0
        },
        ultimaActualizacion: new Date()
      });
      
      // Verificar que se limpió
      const verifyDoc = await getDoc(doc(db, 'kpis', studentId));
      if (verifyDoc.exists()) {
        const verifyData = verifyDoc.data();
        console.log('✅ KPIs después de limpiar - cuadernos:', Object.keys(verifyData.cuadernos || {}));
        console.log('✅ KPIs después de limpiar - materias:', Object.keys(verifyData.materias || {}));
      }
    } else {
      console.log('⚠️ No se encontraron KPIs en colección principal');
    }
    
    // 2b. Limpiar los KPIs en users/{userId}/kpis/dashboard (¡IMPORTANTE!)
    console.log('\n📊 Limpiando KPIs en subcolección del usuario...');
    const dashboardKpiDoc = await getDoc(doc(db, 'users', studentId, 'kpis', 'dashboard'));
    
    if (dashboardKpiDoc.exists()) {
      const dashboardData = dashboardKpiDoc.data();
      console.log('Dashboard KPIs actuales - cuadernos:', Object.keys(dashboardData.cuadernos || {}));
      console.log('Dashboard KPIs actuales - materias:', Object.keys(dashboardData.materias || {}));
      
      // Resetear Dashboard KPIs completamente
      await updateDoc(doc(db, 'users', studentId, 'kpis', 'dashboard'), {
        cuadernos: {},
        materias: {},
        tiempoEstudioSemanal: {},
        global: {
          scoreTotal: 0,
          tiempoEstudioTotal: 0,
          conceptosDominados: 0,
          conceptosEnAprendizaje: 0,
          conceptosSinEstudiar: 0,
          totalConceptos: 0,
          rachaActual: 0,
          rachaMasLarga: 0,
          diasEstudiados: 0,
          estudiosInteligentesCompletados: 0,
          estudiosLibresCompletados: 0,
          quizzesCompletados: 0,
          porcentajeExitoPromedio: 0,
          nivelGeneral: 1,
          experienciaTotal: 0,
          trofeos: 0,
          logros: 0
        },
        ultimaActualizacion: new Date()
      });
      
      // Verificar que se limpió
      const verifyDashboardDoc = await getDoc(doc(db, 'users', studentId, 'kpis', 'dashboard'));
      if (verifyDashboardDoc.exists()) {
        const verifyDashboardData = verifyDashboardDoc.data();
        console.log('✅ Dashboard KPIs después de limpiar - cuadernos:', Object.keys(verifyDashboardData.cuadernos || {}));
        console.log('✅ Dashboard KPIs después de limpiar - materias:', Object.keys(verifyDashboardData.materias || {}));
      }
    } else {
      console.log('⚠️ No se encontraron Dashboard KPIs en subcolección del usuario');
    }
    
    // 3. Verificar schoolStudentKpis
    console.log('\n📊 Verificando schoolStudentKpis...');
    const schoolKpiDoc = await getDoc(doc(db, 'schoolStudentKpis', studentId));
    
    if (schoolKpiDoc.exists()) {
      const schoolKpiData = schoolKpiDoc.data();
      console.log('schoolStudentKpis encontrados:', {
        materias: Object.keys(schoolKpiData.materias || {}),
        cuadernos: Object.keys(schoolKpiData.cuadernos || {})
      });
      
      // Limpiar schoolStudentKpis
      await updateDoc(doc(db, 'schoolStudentKpis', studentId), {
        cuadernos: {},
        materias: {}
      });
      console.log('✅ schoolStudentKpis limpiados');
    } else {
      console.log('ℹ️ No se encontraron schoolStudentKpis');
    }
    
    console.log('\n✨ === LIMPIEZA COMPLETADA ===');
    console.log('El estudiante ahora tiene:');
    console.log('- 0 cuadernos asignados');
    console.log('- KPIs reseteados');
    console.log('- Datos limpios');
    console.log('\n💡 Próximo paso: Asignar los cuadernos correctos del profesor');
    
    return true;
  } catch (error) {
    console.error('❌ Error limpiando datos:', error);
    return false;
  }
}

export async function assignTeacherNotebooks() {
  const studentId = 'obdYcp6ui6aCVEiMYdohvE5EY7i1';
  const teacherNotebooks = [
    '3NRiU9gfysxNkoMHi8EO', // Algas Verdes
    'jQycIQMUec2hiv9Ylhn6', // Platanos
    'IqQmOv2AobKgMQM7DbiI'  // Biología Marina
  ];
  
  console.log('📚 === ASIGNANDO CUADERNOS DEL PROFESOR ===');
  
  try {
    console.log('Asignando cuadernos:', teacherNotebooks);
    
    await updateDoc(doc(db, 'users', studentId), {
      idCuadernos: teacherNotebooks
    });
    
    console.log('✅ Cuadernos asignados correctamente');
    
    // Verificar
    const userDoc = await getDoc(doc(db, 'users', studentId));
    if (userDoc.exists()) {
      console.log('Verificación - idCuadernos:', userDoc.data().idCuadernos);
    }
    
    console.log('\n💡 Nota: Los KPIs se actualizarán automáticamente cuando el estudiante interactúe con los cuadernos');
    
    return true;
  } catch (error) {
    console.error('❌ Error asignando cuadernos:', error);
    return false;
  }
}

// Función para limpiar el caché local
export function clearLocalCache() {
  console.log('🗑️ Limpiando caché local...');
  
  // Limpiar localStorage de KPIs
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.includes('kpi') || key.includes('KPI') || key.includes('cuaderno') || key.includes('materia'))) {
      keysToRemove.push(key);
    }
  }
  
  keysToRemove.forEach(key => {
    console.log(`   Eliminando del localStorage: ${key}`);
    localStorage.removeItem(key);
  });
  
  // Limpiar sessionStorage
  sessionStorage.clear();
  console.log('✅ Caché local limpiado');
}

// Hacer las funciones disponibles globalmente
if (typeof window !== 'undefined') {
  (window as any).cleanStudentData = cleanStudentData;
  (window as any).assignTeacherNotebooks = assignTeacherNotebooks;
  (window as any).clearLocalCache = clearLocalCache;
  
  console.log('🧹 Funciones de limpieza disponibles:');
  console.log('   - window.cleanStudentData() - Limpia todos los datos del estudiante');
  console.log('   - window.assignTeacherNotebooks() - Asigna los 3 cuadernos del profesor');
  console.log('   - window.clearLocalCache() - Limpia el caché local del navegador');
}