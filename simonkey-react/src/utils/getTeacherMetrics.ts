import { teacherKpiService } from '../services/teacherKpiService';
import { auth, db } from '../services/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

/**
 * Wrapper para obtener las métricas del profesor de forma correcta
 * Maneja la diferencia entre el UID de Firebase y el ID del documento
 */
export async function getTeacherMetricsWithProfile(userProfile: any) {
  if (!userProfile) {
    console.log('[getTeacherMetrics] No hay perfil');
    return null;
  }

  try {
    // Usar el ID del profesor del perfil, no el del usuario actual (que puede ser admin)
    const teacherUid = userProfile.id;
    console.log('[getTeacherMetrics] Teacher UID (del perfil):', teacherUid);
    console.log('[getTeacherMetrics] Current user UID:', auth.currentUser?.uid);
    
    // Si el profesor no tiene idInstitucion pero tiene idAdmin, obtenerla del admin
    let effectiveInstitutionId = userProfile.idInstitucion;
    
    if (!effectiveInstitutionId && userProfile.idAdmin) {
      console.log('[getTeacherMetrics] Profesor sin idInstitucion, buscando del admin:', userProfile.idAdmin);
      
      // Buscar el documento del admin
      const adminDoc = await getDoc(doc(db, 'users', userProfile.idAdmin));
      
      if (adminDoc.exists()) {
        const adminData = adminDoc.data();
        effectiveInstitutionId = adminData.idInstitucion;
        
        if (effectiveInstitutionId) {
          console.log('[getTeacherMetrics] ID Institución encontrado del admin:', effectiveInstitutionId);
          
          // Actualizar el profesor con la institución
          await updateDoc(doc(db, 'users', teacherUid), {
            idInstitucion: effectiveInstitutionId
          });
          
          console.log('[getTeacherMetrics] Profesor actualizado con idInstitucion');
          
          // Actualizar el userProfile local
          userProfile.idInstitucion = effectiveInstitutionId;
        }
      }
    }
    
    console.log('[getTeacherMetrics] ID Institución final:', effectiveInstitutionId);
    console.log('[getTeacherMetrics] ID Admin:', userProfile.idAdmin);

    // Primero intentar obtener métricas existentes
    let metrics = await teacherKpiService.getTeacherMetrics(teacherUid);
    
    if (!metrics) {
      console.log('[getTeacherMetrics] No hay métricas, creando nuevas...');
      
      // Asegurarse de que el userProfile tenga la institución
      if (effectiveInstitutionId && !userProfile.idInstitucion) {
        userProfile.idInstitucion = effectiveInstitutionId;
      }
      
      // Pasar el userProfile actualizado para que use el ID correcto en las consultas
      await teacherKpiService.updateTeacherMetrics(teacherUid, userProfile);
      
      // Obtener las métricas recién creadas
      metrics = await teacherKpiService.getTeacherMetrics(teacherUid);
    }

    return metrics;
  } catch (error) {
    console.error('[getTeacherMetrics] Error:', error);
    return null;
  }
}