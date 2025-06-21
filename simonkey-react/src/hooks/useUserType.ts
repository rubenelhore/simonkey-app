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
  const { userProfile, loading } = useAuth();

  // Logs para depuración
  console.log('useUserType - loading:', loading);
  if (!loading) {
    console.log('useUserType - userProfile:', userProfile);
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

  // Determinar si es usuario escolar
  const isSchoolUser = subscription === 'school';
  const isSchoolTeacher = isSchoolUser && schoolRole === SchoolRole.TEACHER;
  const isSchoolStudent = isSchoolUser && schoolRole === SchoolRole.STUDENT;
  
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