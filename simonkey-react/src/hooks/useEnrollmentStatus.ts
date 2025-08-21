import { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { EnrollmentService } from '../services/enrollmentService';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';

/**
 * Hook para verificar y actualizar automáticamente el estado isEnrolled del usuario
 * basado en sus enrollments activos
 */
export const useEnrollmentStatus = () => {
  const { user, userProfile } = useAuth();
  const hasChecked = useRef(false);

  useEffect(() => {
    const checkAndUpdateEnrollmentStatus = async () => {
      if (!user?.uid || !userProfile || hasChecked.current) {
        return;
      }

      try {
        console.log('🔍 Verificando estado de inscripciones para usuario:', user.uid);
        
        const enrollmentService = new EnrollmentService();
        
        // Verificar si el usuario tiene inscripciones activas
        const enrollments = await enrollmentService.getStudentEnrollments(user.uid);
        const hasActiveEnrollments = enrollments.length > 0;
        
        console.log(`📊 Inscripciones encontradas: ${enrollments.length}`);
        console.log(`📊 Estado actual isEnrolled: ${userProfile.isEnrolled}`);
        console.log(`📊 Debería ser isEnrolled: ${hasActiveEnrollments}`);
        
        // Solo actualizar si el estado ha cambiado
        const needsUpdate = (
          (hasActiveEnrollments && !userProfile.isEnrolled) ||
          (!hasActiveEnrollments && userProfile.isEnrolled === true)
        );
        
        if (needsUpdate) {
          console.log(`🔄 Actualizando isEnrolled de ${userProfile.isEnrolled} a ${hasActiveEnrollments}`);
          
          const userRef = doc(db, 'users', user.uid);
          await updateDoc(userRef, {
            isEnrolled: hasActiveEnrollments,
            updatedAt: serverTimestamp()
          });
          
          console.log(`✅ Campo isEnrolled actualizado a: ${hasActiveEnrollments}`);
          
          // Recargar la página para reflejar los cambios
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        } else {
          console.log('✅ Estado isEnrolled ya está correcto, no necesita actualización');
        }
        
        hasChecked.current = true;
        
      } catch (error) {
        console.error('❌ Error verificando estado de inscripciones:', error);
      }
    };

    // Ejecutar la verificación después de un pequeño delay para asegurar que el perfil esté cargado
    const timeoutId = setTimeout(checkAndUpdateEnrollmentStatus, 2000);
    
    return () => clearTimeout(timeoutId);
  }, [user?.uid, userProfile]);
};