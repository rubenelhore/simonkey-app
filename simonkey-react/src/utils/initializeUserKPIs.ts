import { auth, db } from '../services/firebase';
import { doc, getDoc, setDoc, serverTimestamp, collection, getDocs } from 'firebase/firestore';
import { kpiService } from '../services/kpiService';

/**
 * Función para inicializar los KPIs de un usuario
 * Ejecutar en la consola del navegador: window.initializeUserKPIs()
 */
export const initializeUserKPIs = async () => {
  console.log('🔧 === INICIALIZANDO KPIs DE USUARIO ===');
  
  try {
    // 1. Verificar usuario actual
    const currentUser = auth.currentUser;
    if (!currentUser) {
      console.log('❌ No hay usuario autenticado');
      return false;
    }
    
    console.log('👤 Usuario actual:', currentUser.email);
    console.log('🆔 UID:', currentUser.uid);
    
    // 2. Verificar si ya existen los KPIs
    const kpisDocRef = doc(db, 'users', currentUser.uid, 'kpis', 'dashboard');
    const kpisDoc = await getDoc(kpisDocRef);
    
    if (kpisDoc.exists()) {
      console.log('✅ KPIs ya existen en Firestore');
      const kpisData = kpisDoc.data();
      console.log('📊 KPIs actuales:', kpisData);
      return true;
    }
    
    // 3. Crear KPIs iniciales
    console.log('⚠️ KPIs no existen, creando...');
    
    // Obtener datos actuales del usuario para calcular KPIs
    console.log('📊 Calculando KPIs actuales...');
    
    // Contar notebooks
    const notebooksCollection = collection(db, 'notebooks');
    const notebooksSnapshot = await getDocs(notebooksCollection);
    const userNotebooks = notebooksSnapshot.docs.filter(doc => doc.data().userId === currentUser.uid);
    const notebookCount = userNotebooks.length;
    
    // Contar conceptos
    let totalConcepts = 0;
    let dominatedConcepts = 0;
    
    for (const notebook of userNotebooks) {
      const conceptsCollection = collection(db, 'notebooks', notebook.id, 'concepts');
      const conceptsSnapshot = await getDocs(conceptsCollection);
      totalConcepts += conceptsSnapshot.size;
      
      // Contar conceptos dominados
      conceptsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.domainLevel >= 5) {
          dominatedConcepts++;
        }
      });
    }
    
    // Crear estructura de KPIs inicial
    const initialKPIs = {
      // Datos principales
      totalStudyTime: 0,
      studyStreak: 0,
      lastStudyDate: null,
      conceptsDominated: dominatedConcepts,
      conceptsTotal: totalConcepts,
      
      // Datos de la semana
      weeklyStudyTime: 0,
      weekStartDate: new Date().toISOString(),
      
      // Datos de sesiones
      totalSessions: 0,
      averageSessionTime: 0,
      
      // Datos de notebooks
      activeNotebooks: notebookCount,
      totalNotebooks: notebookCount,
      
      // Tasa de éxito
      successRate: 0,
      totalQuizzes: 0,
      correctAnswers: 0,
      
      // Metadatos
      lastUpdated: serverTimestamp(),
      createdAt: serverTimestamp(),
      userId: currentUser.uid
    };
    
    // Guardar KPIs en Firestore
    await setDoc(kpisDocRef, initialKPIs);
    console.log('✅ KPIs creados exitosamente:', initialKPIs);
    
    // 4. Actualizar KPIs usando el servicio
    console.log('🔄 Actualizando KPIs con el servicio...');
    try {
      await kpiService.updateUserKPIs(currentUser.uid);
      console.log('✅ KPIs actualizados exitosamente');
    } catch (updateError) {
      console.log('⚠️ No se pudieron actualizar los KPIs:', updateError);
    }
    
    // 5. Verificar KPIs finales
    const finalKpisDoc = await getDoc(kpisDocRef);
    if (finalKpisDoc.exists()) {
      console.log('📊 KPIs finales:', finalKpisDoc.data());
    }
    
    console.log('✅ Proceso completado. Recarga la página para ver los cambios.');
    return true;
    
  } catch (error) {
    console.error('❌ Error inicializando KPIs:', error);
    return false;
  }
};

/**
 * Función para diagnosticar el estado de los KPIs
 */
export const diagnoseKPIs = async () => {
  console.log('🔍 === DIAGNOSTICANDO KPIs ===');
  
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      console.log('❌ No hay usuario autenticado');
      return;
    }
    
    console.log('👤 Usuario:', currentUser.email);
    console.log('🆔 UID:', currentUser.uid);
    
    // Verificar documento de usuario
    const userDocRef = doc(db, 'users', currentUser.uid);
    const userDoc = await getDoc(userDocRef);
    console.log('📋 Documento de usuario existe:', userDoc.exists());
    if (userDoc.exists()) {
      console.log('📋 Datos del usuario:', userDoc.data());
    }
    
    // Verificar KPIs
    const kpisDocRef = doc(db, 'users', currentUser.uid, 'kpis', 'dashboard');
    const kpisDoc = await getDoc(kpisDocRef);
    console.log('📊 Documento de KPIs existe:', kpisDoc.exists());
    if (kpisDoc.exists()) {
      console.log('📊 Datos de KPIs:', kpisDoc.data());
    }
    
    // Verificar colección de learningData
    const learningDataCollection = collection(db, 'users', currentUser.uid, 'learningData');
    const learningDataSnapshot = await getDocs(learningDataCollection);
    console.log('📚 Documentos en learningData:', learningDataSnapshot.size);
    
    // Verificar notebooks
    const notebooksCollection = collection(db, 'notebooks');
    const notebooksSnapshot = await getDocs(notebooksCollection);
    const userNotebooks = notebooksSnapshot.docs.filter(doc => doc.data().userId === currentUser.uid);
    console.log('📓 Notebooks del usuario:', userNotebooks.length);
    
    // Verificar materias
    const materiasCollection = collection(db, 'materias');
    const materiasSnapshot = await getDocs(materiasCollection);
    const userMaterias = materiasSnapshot.docs.filter(doc => doc.data().userId === currentUser.uid);
    console.log('📚 Materias del usuario:', userMaterias.length);
    
  } catch (error) {
    console.error('❌ Error en diagnóstico:', error);
  }
};

// Hacer las funciones disponibles globalmente
if (typeof window !== 'undefined') {
  (window as any).initializeUserKPIs = initializeUserKPIs;
  (window as any).diagnoseKPIs = diagnoseKPIs;
  console.log('🔧 Función initializeUserKPIs() disponible en la consola');
  console.log('🔍 Función diagnoseKPIs() disponible en la consola');
  console.log('💡 Ejecuta: window.initializeUserKPIs() para inicializar los KPIs');
  console.log('💡 Ejecuta: window.diagnoseKPIs() para diagnosticar el estado');
}