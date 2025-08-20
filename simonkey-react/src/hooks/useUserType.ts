import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { auth } from '../services/firebase';
import { 
  getUserProfile, 
  getSubscriptionLimits, 
  canCreateNotebook, 
  canAddConcepts
} from '../services/userService';
import { UserProfile, SubscriptionLimits, UserSubscriptionType } from '../types/interfaces';

export const useUserType = () => {
  const { userProfile, loading, isAuthenticated } = useAuth();

  // Si no está autenticado, no necesitamos cargar el tipo de usuario
  if (!isAuthenticated) {
    return {
      isSuperAdmin: false,
      isTeacher: false,
      subscription: undefined,
      userProfile: null,
      loading: false,
      // Deprecated - mantener temporalmente para compatibilidad
      schoolRole: undefined,
      isSchoolUser: false,
      isSchoolTeacher: false,
      isSchoolStudent: false,
      isSchoolAdmin: false,
      isSchoolTutor: false,
      isUniversityUser: false
    };
  }

  // Valores por defecto mientras carga
  if (loading || !userProfile) {
    return {
      isSuperAdmin: false,
      isTeacher: false,
      subscription: undefined,
      userProfile: null,
      loading: true,
      // Deprecated - mantener temporalmente para compatibilidad
      schoolRole: undefined,
      isSchoolUser: false,
      isSchoolTeacher: false,
      isSchoolStudent: false,
      isSchoolAdmin: false,
      isSchoolTutor: false,
      isUniversityUser: false
    };
  }

  // Extraer datos del perfil
  const { subscription, email, isTeacher } = userProfile;
  
  // Lógica para determinar si es superadmin
  const isSuperAdmin = email === 'ruben.elhore@gmail.com' || subscription === UserSubscriptionType.SUPER_ADMIN;
  
  // El nuevo sistema: isTeacher viene directamente del perfil
  const isTeacherUser = isTeacher === true;

  return {
    isSuperAdmin,
    isTeacher: isTeacherUser,
    subscription,
    userProfile,
    loading: false,
    // DEPRECATED: Mantener temporalmente para no romper código existente
    // TODO: Eliminar estos campos después de actualizar todos los componentes
    schoolRole: undefined,
    isSchoolUser: false,
    isSchoolTeacher: false, // Ya no mapear - sistema escolar eliminado
    isSchoolStudent: false,
    isSchoolAdmin: false,
    isSchoolTutor: false,
    isUniversityUser: false
  };
}; 