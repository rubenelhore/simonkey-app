import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { auth } from '../services/firebase';
import { 
  getUserProfile, 
  getSubscriptionLimits, 
  canCreateNotebook, 
  canAddConcepts
} from '../services/userService';
import { UserProfile, SubscriptionLimits, UserSubscriptionType, SchoolRole } from '../types/interfaces';

export const useUserType = () => {
  const { userProfile, loading, isAuthenticated } = useAuth();

  // Logs para depuración
  console.log('useUserType - loading:', loading);
  console.log('useUserType - isAuthenticated:', isAuthenticated);
  if (!loading) {
    console.log('useUserType - userProfile:', userProfile);
  }

  // Si no está autenticado, no necesitamos cargar el tipo de usuario
  if (!isAuthenticated) {
    return {
      isSuperAdmin: false,
      subscription: undefined,
      schoolRole: undefined,
      isSchoolUser: false,
      isSchoolTeacher: false,
      isSchoolStudent: false,
      userProfile: null,
      loading: false // Cambiado de true a false
    };
  }

  // Valores por defecto mientras carga
  if (loading || !userProfile) {
    return {
      isSuperAdmin: false,
      subscription: undefined,
      schoolRole: undefined,
      isSchoolUser: false,
      isSchoolTeacher: false,
      isSchoolStudent: false,
      userProfile: null,
      loading: true
    };
  }

  // Extraer datos del perfil
  const { subscription, schoolRole, email } = userProfile;
  
  // Lógica mejorada para determinar si es superadmin
  const isSuperAdmin = email === 'ruben.elhore@gmail.com' || subscription === UserSubscriptionType.SUPER_ADMIN;
  
  // Log específico para superadmin
  console.log('useUserType - SuperAdmin check:');
  console.log('  - email:', email);
  console.log('  - subscription:', subscription);
  console.log('  - isSuperAdmin:', isSuperAdmin);

  // Normalizar subscription a minúsculas para evitar bugs por mayúsculas/minúsculas
  const normalizedSubscription = typeof subscription === 'string' ? subscription.toLowerCase() : subscription;
  const normalizedSchoolRole = typeof schoolRole === 'string' ? schoolRole.toLowerCase() : schoolRole;
  const isSchoolUser = normalizedSubscription === UserSubscriptionType.SCHOOL;
  const isSchoolTeacher = isSchoolUser && normalizedSchoolRole === SchoolRole.TEACHER;
  const isSchoolStudent = isSchoolUser && normalizedSchoolRole === SchoolRole.STUDENT;
  
  // Log de los roles calculados
  console.log('useUserType - Roles calculados:');
  console.log('  - isSchoolUser:', isSchoolUser);
  console.log('  - isSchoolTeacher:', isSchoolTeacher);
  console.log('  - isSchoolStudent:', isSchoolStudent);

  return {
    isSuperAdmin,
    subscription,
    schoolRole,
    isSchoolUser,
    isSchoolTeacher,
    isSchoolStudent,
    userProfile,
    loading: false
  };
}; 