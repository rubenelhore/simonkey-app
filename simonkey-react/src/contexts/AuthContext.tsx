import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, db } from '../services/firebase';
import { checkEmailVerificationStatus, getVerificationState, EmailVerificationState } from '../services/emailVerificationService';
import { getUserProfile } from '../services/userService';
import { UserProfile } from '../types/interfaces';
import { checkAndFixCurrentUser } from '../utils/adminUtils';
import { useUserType } from '../hooks/useUserType';

// Maintenance mode flag - DISABLE ALL FIREBASE OPERATIONS
const MAINTENANCE_MODE = false;

export interface AuthState {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  emailVerificationState: EmailVerificationState;
  isAuthenticated: boolean;
  isEmailVerified: boolean;
}

interface AuthContextType extends AuthState {
  refreshEmailVerification: () => Promise<boolean>;
  requiresEmailVerification: () => boolean;
  canAccessApp: () => boolean;
  logout: () => Promise<void>;
  refreshUserData: () => Promise<void>;
  updateVerificationState: () => Promise<boolean>;
  signOut: () => Promise<void>;
  refreshUserProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Global flag to ensure only one auth listener is set up
let globalAuthListenerSetup = false;
let globalAuthUnsubscribe: (() => void) | null = null;

// Función de diagnóstico global
const diagnoseAuthState = () => {
  console.log('🔍 === DIAGNÓSTICO DE AUTENTICACIÓN ===');
  console.log('🔐 Global Auth Listener Setup:', globalAuthListenerSetup);
  console.log('🔐 Global Auth Unsubscribe:', globalAuthUnsubscribe ? 'Configurado' : 'No configurado');
  console.log('👤 Usuario actual de Firebase Auth:', auth.currentUser);
  console.log('📧 Email del usuario actual:', auth.currentUser?.email);
  console.log('🆔 UID del usuario actual:', auth.currentUser?.uid);
  console.log('✅ Email verificado:', auth.currentUser?.emailVerified);
  console.log('=====================================');
};

// Exponer la función globalmente para diagnóstico
if (typeof window !== 'undefined') {
  (window as any).diagnoseAuthState = diagnoseAuthState;
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
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

  console.log('🔍 AuthProvider - Estado inicial:', authState);

  const authListenerRef = useRef<(() => void) | null>(null);
  const isInitializedRef = useRef(false);

  // If maintenance mode is enabled, return mock data and disable all Firebase operations
  if (MAINTENANCE_MODE) {
    const mockAuthContext: AuthContextType = {
      user: null,
      userProfile: null,
      loading: false,
      emailVerificationState: {
        isEmailVerified: false,
        verificationCount: 0,
      },
      isAuthenticated: false,
      isEmailVerified: false,
      signOut: async () => {
        console.log('🔧 Maintenance mode: signOut disabled');
      },
      refreshUserProfile: async () => {
        console.log('🔧 Maintenance mode: refreshUserProfile disabled');
      },
      refreshEmailVerification: async () => {
        console.log('🔧 Maintenance mode: refreshEmailVerification disabled');
        return false;
      },
      requiresEmailVerification: () => false,
      canAccessApp: () => false,
      logout: async () => {
        console.log('🔧 Maintenance mode: logout disabled');
      },
      refreshUserData: async () => {
        console.log('🔧 Maintenance mode: refreshUserData disabled');
      },
      updateVerificationState: async () => {
        console.log('🔧 Maintenance mode: updateVerificationState disabled');
        return false;
      },
    };

    return (
      <AuthContext.Provider value={mockAuthContext}>
        {children}
      </AuthContext.Provider>
    );
  }

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
      console.log(`🔍 loadUserProfile - Iniciando carga para: ${user.email} (${user.uid})`);
      
      // PRIMERO: Verificar si existe un usuario escolar vinculado con este UID de Google Auth
      console.log('🔍 Verificando si existe usuario escolar vinculado...');
      let linkedSchoolUserId = null;
      
      try {
        // Buscar en users por googleAuthUid
        const { collection, query, where, getDocs } = await import('firebase/firestore');
        const linkedUsersQuery = query(collection(db, 'users'), where('googleAuthUid', '==', user.uid));
        const linkedUsersSnapshot = await getDocs(linkedUsersQuery);
        
        if (!linkedUsersSnapshot.empty) {
          const linkedUserDoc = linkedUsersSnapshot.docs[0];
          const linkedUserData = linkedUserDoc.data();
          
          if (linkedUserData.subscription === 'SCHOOL') {
            linkedSchoolUserId = linkedUserDoc.id;
            console.log('✅ Usuario escolar vinculado encontrado:', {
              schoolUserId: linkedSchoolUserId,
              email: linkedUserData.email,
              subscription: linkedUserData.subscription,
              schoolRole: linkedUserData.schoolRole
            });
          }
        }
      } catch (linkError) {
        console.log('⚠️ Error verificando usuario vinculado:', linkError);
      }
      
      // Si encontramos un usuario escolar vinculado, usar ese ID
      const userIdToUse = linkedSchoolUserId || user.uid;
      console.log(`🔍 Usando ID para cargar perfil: ${userIdToUse} (original: ${user.uid})`);
      
      // Primero intentar obtener el perfil con el ID correcto
      let profile = await getUserProfile(userIdToUse);
      console.log(`🔍 loadUserProfile - Perfil obtenido con ID ${userIdToUse}:`, profile);
      
      // Si no se encuentra el perfil, verificar si hay un usuario vinculado
      if (!profile) {
        console.log('⚠️ Perfil no encontrado con ID correcto, verificando si hay usuario vinculado...');
        
        // Buscar si existe un usuario con el mismo email que tenga este UID de Google Auth vinculado
        try {
          const { checkUserExistsByEmail } = await import('../services/userService');
          
          if (user.email) {
            const existingUserCheck = await checkUserExistsByEmail(user.email);
            
            if (existingUserCheck.exists && existingUserCheck.userData) {
              console.log('🔍 Usuario existente encontrado con el mismo email:', existingUserCheck.userId);
              console.log('🔍 Datos del usuario existente:', existingUserCheck.userData);
              
              // Verificar si el usuario existente tiene este UID de Google Auth vinculado
              if (existingUserCheck.userData.googleAuthUid === user.uid && existingUserCheck.userId) {
                console.log('✅ Usuario vinculado encontrado, usando ID del usuario existente:', existingUserCheck.userId);
                profile = await getUserProfile(existingUserCheck.userId);
                console.log(`🔍 loadUserProfile - Perfil obtenido con ID de usuario existente:`, profile);
              } else {
                console.log('⚠️ Usuario existente no tiene este UID de Google Auth vinculado o no tiene ID válido');
              }
            }
          } else {
            console.log('⚠️ No hay email disponible para verificar usuario vinculado');
          }
        } catch (linkError) {
          console.log('⚠️ Error verificando usuario vinculado:', linkError);
        }
      }
      
      if (!profile) {
        console.log('⚠️ No se encontró perfil, creando perfil básico...');
        
        try {
          const { createUserProfile } = await import('../services/userService');
          const userData = {
            email: user.email || '',
            username: user.displayName || user.email?.split('@')[0] || 'Usuario',
            nombre: user.displayName || user.email?.split('@')[0] || 'Usuario',
            displayName: user.displayName || user.email?.split('@')[0] || 'Usuario',
            birthdate: ''
          };
          
          await createUserProfile(userIdToUse, userData);
          const newProfile = await getUserProfile(userIdToUse);
          console.log(`🔍 loadUserProfile - Perfil básico creado:`, newProfile);
          setAuthState(prev => ({
            ...prev,
            userProfile: newProfile
          }));
          return newProfile;
        } catch (createError) {
          console.error('Error creando perfil básico:', createError);
        }
      } else {
        console.log(`🔍 loadUserProfile - Perfil encontrado, subscription: ${profile.subscription}, schoolRole: ${profile.schoolRole}`);
      }
      
      setAuthState(prev => {
        console.log('🔍 loadUserProfile - setAuthState - Estado anterior:', prev);
        const newState = {
          ...prev,
          userProfile: profile
        };
        console.log('🔍 loadUserProfile - setAuthState - Nuevo estado:', newState);
        return newState;
      });
      return profile;
    } catch (error) {
      console.error('Error cargando perfil de usuario:', error);
      
      // Si hay error, intentar arreglar usuario huérfano
      try {
        console.log('⚠️ Error cargando perfil, verificando si es usuario huérfano...');
        const wasFixed = await checkAndFixCurrentUser();
        
        if (wasFixed) {
          console.log('✅ Usuario huérfano arreglado, recargando perfil...');
          const newProfile = await getUserProfile(user.uid);
          console.log(`🔍 loadUserProfile - Nuevo perfil después de arreglar (error):`, newProfile);
          setAuthState(prev => {
            console.log('🔍 loadUserProfile - setAuthState (primer arreglo) - Estado anterior:', prev);
            const newState = {
              ...prev,
              userProfile: newProfile
            };
            console.log('🔍 loadUserProfile - setAuthState (primer arreglo) - Nuevo estado:', newState);
            return newState;
          });
          return newProfile;
        }
      } catch (fixError) {
        console.error('Error arreglando usuario huérfano:', fixError);
      }
      
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

  // Efecto para manejar cambios de autenticación - SIMPLIFICADO
  useEffect(() => {
    console.log('🔐 Configurando listener de autenticación SIMPLIFICADO');
    
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('🔄 Estado de autenticación cambió:', user ? `Usuario logueado: ${user.email}` : 'No hay usuario');
      
      if (user) {
        console.log('👤 Usuario encontrado:', user.email);
        
        // Establecer estado de carga
        setAuthState(prev => ({
          ...prev,
          user,
          loading: true,
          isAuthenticated: true,
        }));
        
        try {
          console.log('🔍 Iniciando carga de perfil y verificación...');
          
          // Cargar perfil y verificación en paralelo
          const [profile, verificationResult] = await Promise.all([
            loadUserProfile(user),
            updateVerificationState(user)
          ]);
          
          console.log('✅ Carga completa. Perfil:', profile, 'Verificación:', verificationResult);

          // Actualizar estado final
          setAuthState(prev => ({
            ...prev,
            userProfile: profile,
            isEmailVerified: verificationResult,
            emailVerificationState: {
              ...prev.emailVerificationState,
              isEmailVerified: verificationResult,
            },
            loading: false,
          }));
          
        } catch (error) {
          console.error('❌ Error cargando información de usuario:', error);
          
          // En caso de error, mantener el usuario pero sin perfil
          setAuthState(prev => ({
            ...prev,
            userProfile: null,
            loading: false,
          }));
        }
      } else {
        console.log('❌ No hay usuario autenticado');
        
        // Resetear estado cuando no hay usuario
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
    });

    // Cleanup function
    return () => {
      console.log('🔐 Limpiando listener de autenticación');
      unsubscribe();
    };
  }, []); // Sin dependencias para que solo se ejecute una vez

  // Función de emergencia para forzar el estado
  const forceAuthState = () => {
    const currentUser = auth.currentUser;
    if (currentUser) {
      console.log('🚨 Forzando estado de autenticación para:', currentUser.email);
      setAuthState(prev => ({
        ...prev,
        user: currentUser,
        isAuthenticated: true,
        loading: false,
      }));
    }
  };

  // Exponer función de emergencia globalmente
  if (typeof window !== 'undefined') {
    (window as any).forceAuthState = forceAuthState;
  }

  const contextValue: AuthContextType = {
    // Estado
    ...authState,
    
    // Funciones de utilidad
    refreshEmailVerification,
    requiresEmailVerification,
    canAccessApp,
    logout,
    refreshUserData,
    
    // Funciones para componentes específicos
    updateVerificationState: () => authState.user ? updateVerificationState(authState.user) : Promise.resolve(false),
    signOut: logout,
    refreshUserProfile: refreshUserData
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};