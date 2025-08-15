import { teacherKpiService } from '../services/teacherKpiService';
import { auth } from '../services/firebase';

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
    console.log('[getTeacherMetrics] UserProfile completo:', JSON.stringify(userProfile, null, 2));
    console.log('[getTeacherMetrics] Campos del UserProfile:');
    Object.keys(userProfile).forEach(key => {
      console.log(`  - ${key}:`, userProfile[key]);
    });
    console.log('[getTeacherMetrics] ID Institución (idInstitucion):', userProfile.idInstitucion);
    console.log('[getTeacherMetrics] ID Escuela (idEscuela):', userProfile.idEscuela);
    console.log('[getTeacherMetrics] School Data:', userProfile.schoolData);
    console.log('[getTeacherMetrics] ID Admin:', userProfile.idAdmin);

    // Primero intentar obtener métricas existentes
    let metrics = await teacherKpiService.getTeacherMetrics(teacherUid);
    
    if (!metrics) {
      console.log('[getTeacherMetrics] No hay métricas, creando nuevas...');
      
      // Pasar el userProfile para que use el ID correcto en las consultas
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