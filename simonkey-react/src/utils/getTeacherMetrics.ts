import { teacherKpiService } from '../services/teacherKpiService';
import { auth } from '../services/firebase';

/**
 * Wrapper para obtener las métricas del profesor de forma correcta
 * Maneja la diferencia entre el UID de Firebase y el ID del documento
 */
export async function getTeacherMetricsWithProfile(userProfile: any) {
  if (!auth.currentUser || !userProfile) {
    console.log('[getTeacherMetrics] No hay usuario o perfil');
    return null;
  }

  try {
    const uid = auth.currentUser.uid;
    console.log('[getTeacherMetrics] UID de Firebase:', uid);
    console.log('[getTeacherMetrics] ID del documento:', userProfile.id);
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
    let metrics = await teacherKpiService.getTeacherMetrics(uid);
    
    if (!metrics) {
      console.log('[getTeacherMetrics] No hay métricas, creando nuevas...');
      
      // Pasar el userProfile para que use el ID correcto en las consultas
      await teacherKpiService.updateTeacherMetrics(uid, userProfile);
      
      // Obtener las métricas recién creadas
      metrics = await teacherKpiService.getTeacherMetrics(uid);
    }

    return metrics;
  } catch (error) {
    console.error('[getTeacherMetrics] Error:', error);
    return null;
  }
}