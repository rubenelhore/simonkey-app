import { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { EnrollmentService } from '../services/enrollmentService';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { logger } from '../utils/logger';

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
        logger.debug(`Checking enrollment status for user: ${user.uid}`);
        
        const enrollmentService = new EnrollmentService();
        
        // Verificar si el usuario tiene inscripciones activas
        const enrollments = await enrollmentService.getStudentEnrollments(user.uid);
        const hasActiveEnrollments = enrollments.length > 0;
        
        logger.debug(`Enrollments found: ${enrollments.length}, current isEnrolled: ${userProfile.isEnrolled}, should be: ${hasActiveEnrollments}`);
        
        // Solo actualizar si el estado ha cambiado
        const needsUpdate = (
          (hasActiveEnrollments && !userProfile.isEnrolled) ||
          (!hasActiveEnrollments && userProfile.isEnrolled === true)
        );
        
        if (needsUpdate) {
          logger.info(`Updating isEnrolled from ${userProfile.isEnrolled} to ${hasActiveEnrollments}`);
          
          const userRef = doc(db, 'users', user.uid);
          await updateDoc(userRef, {
            isEnrolled: hasActiveEnrollments,
            updatedAt: serverTimestamp()
          });
          
          logger.info(`isEnrolled field updated to: ${hasActiveEnrollments}`);
          
          // Recargar la página para reflejar los cambios
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        } else {
          logger.debug('isEnrolled status is already correct, no update needed');
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