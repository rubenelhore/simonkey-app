import { useState, useEffect } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../services/firebase';
import { checkEmailVerificationStatus, getVerificationState, EmailVerificationState } from '../services/emailVerificationService';
import { getUserProfile } from '../services/userService';
import { UserProfile } from '../types/interfaces';

export interface AuthState {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  emailVerificationState: EmailVerificationState;
  isAuthenticated: boolean;
  isEmailVerified: boolean;
}

export const useAuth = () => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    userProfile: null,
    loading: true,
    emailVerificationState: {
      isEmailVerified: false,
      verificationCount: 0
    },
    isAuthenticated: false,
    isEmailVerified: false
  });

  const [initializing, setInitializing] = useState(true);

  // Función para actualizar el estado de verificación
  const updateVerificationState = async (user: User) => {
    try {
      console.log('🔍 updateVerificationState - Iniciando verificación para:', user.email);
      console.log('🔍 updateVerificationState - user.emailVerified (antes de reload):', user.emailVerified);
      
      const isVerified = await checkEmailVerificationStatus(user);
      console.log('🔍 updateVerificationState - isVerified después de checkEmailVerificationStatus:', isVerified);
      
      // Intentar obtener el estado desde Firestore, pero no fallar si hay errores de permisos
      let verificationState;
      try {
        verificationState = await getVerificationState(user.uid);
        console.log('🔍 updateVerificationState - verificationState desde Firestore:', verificationState);
      } catch (firestoreError) {
        console.warn('⚠️ Error obteniendo estado desde Firestore (continuando con estado local):', firestoreError);
        verificationState = {
          isEmailVerified: isVerified,
          verificationCount: 0
        };
      }
      
      setAuthState(prev => ({
        ...prev,
        emailVerificationState: verificationState,
        isEmailVerified: isVerified
      }));
      
      console.log('🔍 updateVerificationState - Estado actualizado. isEmailVerified:', isVerified);
      return isVerified;
    } catch (error) {
      console.error('Error actualizando estado de verificación:', error);
      return false;
    }
  };

  // Función para cargar el perfil completo del usuario
  const loadUserProfile = async (user: User) => {
    try {
      const profile = await getUserProfile(user.uid);
      setAuthState(prev => ({
        ...prev,
        userProfile: profile
      }));
      return profile;
    } catch (error) {
      console.error('Error cargando perfil de usuario:', error);
      return null;
    }
  };

  // Función para refrescar la verificación de email
  const refreshEmailVerification = async (): Promise<boolean> => {
    const user = auth.currentUser;
    if (!user) return false;
    
    return await updateVerificationState(user);
  };

  // Función para verificar si el usuario necesita verificar su email
  const requiresEmailVerification = (): boolean => {
    return authState.isAuthenticated && !authState.isEmailVerified;
  };

  // Función para verificar si el usuario puede acceder a la aplicación
  const canAccessApp = (): boolean => {
    return authState.isAuthenticated && authState.isEmailVerified;
  };

  // Efecto para manejar cambios de autenticación
  useEffect(() => {
    console.log('🔐 Configurando listener de autenticación');
    
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('🔄 Estado de autenticación cambió:', user ? 'Usuario logueado' : 'No hay usuario');
      
      if (user) {
        console.log('👤 Usuario encontrado:', user.email);
        
        // Actualizar estado básico inmediatamente
        setAuthState(prev => ({
          ...prev,
          user,
          isAuthenticated: true,
          loading: false
        }));
        
        // Cargar perfil de usuario y verificar email en paralelo
        try {
          await Promise.all([
            loadUserProfile(user),
            updateVerificationState(user)
          ]);
          
          console.log('✅ Información de usuario cargada completamente');
        } catch (error) {
          console.error('❌ Error cargando información de usuario:', error);
          // No cambiar el estado de autenticación por errores de carga
        }
      } else {
        console.log('❌ No hay usuario autenticado');
        setAuthState({
          user: null,
          userProfile: null,
          loading: false,
          emailVerificationState: {
            isEmailVerified: false,
            verificationCount: 0
          },
          isAuthenticated: false,
          isEmailVerified: false
        });
      }
      
      if (initializing) {
        setInitializing(false);
      }
    });

    return () => {
      console.log('🔐 Limpiando listener de autenticación');
      unsubscribe();
    };
  }, [initializing]);

  // Función para hacer logout
  const logout = async (): Promise<void> => {
    try {
      await auth.signOut();
      console.log('👋 Usuario deslogueado exitosamente');
    } catch (error) {
      console.error('❌ Error al hacer logout:', error);
      throw error;
    }
  };

  // Función para refrescar toda la información del usuario
  const refreshUserData = async (): Promise<void> => {
    const user = auth.currentUser;
    if (!user) return;
    
    await Promise.all([
      loadUserProfile(user),
      updateVerificationState(user)
    ]);
  };

  return {
    // Estado
    ...authState,
    initializing,
    
    // Funciones de utilidad
    refreshEmailVerification,
    requiresEmailVerification,
    canAccessApp,
    logout,
    refreshUserData,
    
    // Funciones para componentes específicos
    updateVerificationState: () => authState.user ? updateVerificationState(authState.user) : Promise.resolve(false)
  };
};
