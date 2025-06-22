import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '../services/firebase';
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
      const profile = await getUserProfile(user.uid);
      
      console.log(`🔍 loadUserProfile - Perfil obtenido:`, profile);
      
      // Si no se encuentra el perfil, verificar si es un usuario huérfano
      if (!profile) {
        console.log('⚠️ Perfil de usuario no encontrado, verificando si es usuario huérfano...');
        
        // Intentar arreglar usuario huérfano usando la función local primero
        try {
          const { fixOrphanUser } = await import('../utils/authDebug');
          const wasFixed = await fixOrphanUser();
          
          if (wasFixed) {
            console.log('✅ Usuario huérfano arreglado localmente, recargando perfil...');
            // Recargar el perfil después de arreglarlo
            const newProfile = await getUserProfile(user.uid);
            console.log(`🔍 loadUserProfile - Nuevo perfil después de arreglar:`, newProfile);
            setAuthState(prev => ({
              ...prev,
              userProfile: newProfile
            }));
            return newProfile;
          }
        } catch (localFixError) {
          console.log('⚠️ Error arreglando usuario localmente, intentando con cloud function...');
        }
        
        // Si el arreglo local falló, intentar con cloud function
        try {
          const wasFixed = await checkAndFixCurrentUser();
          
          if (wasFixed) {
            console.log('✅ Usuario huérfano arreglado con cloud function, recargando perfil...');
            // Recargar el perfil después de arreglarlo
            const newProfile = await getUserProfile(user.uid);
            console.log(`🔍 loadUserProfile - Nuevo perfil después de arreglar:`, newProfile);
            setAuthState(prev => ({
              ...prev,
              userProfile: newProfile
            }));
            return newProfile;
          }
        } catch (fixError) {
          console.error('Error arreglando usuario huérfano:', fixError);
        }
        
        // Si no se pudo arreglar, crear un perfil básico
        console.log('⚠️ No se pudo arreglar usuario huérfano, creando perfil básico...');
        try {
          const { createUserProfile } = await import('../services/userService');
          const userData = {
            email: user.email || '',
            username: user.displayName || user.email?.split('@')[0] || 'Usuario',
            nombre: user.displayName || user.email?.split('@')[0] || 'Usuario',
            displayName: user.displayName || user.email?.split('@')[0] || 'Usuario',
            birthdate: ''
          };
          
          await createUserProfile(user.uid, userData);
          const newProfile = await getUserProfile(user.uid);
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

  // Efecto para manejar cambios de autenticación - GLOBAL Y ÚNICO
  useEffect(() => {
    // Solo configurar el listener si no existe uno previo GLOBALMENTE
    if (globalAuthListenerSetup) {
      console.log('🔐 Listener de autenticación GLOBAL ya configurado, saltando...');
      return;
    }

    console.log('🔐 Configurando listener de autenticación GLOBAL');
    globalAuthListenerSetup = true;
    
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('🔄 Estado de autenticación cambió:', user ? `Usuario logueado: ${user.email}` : 'No hay usuario');
      
      if (user) {
        // Mantener el estado de carga mientras se obtiene el perfil
        setAuthState(prev => ({
          ...prev,
          loading: true,
        }));

        console.log('👤 Usuario encontrado:', user.email);
        
        try {
          console.log('🔍 Iniciando carga de perfil y verificación...');
          const [profile, verificationResult] = await Promise.all([
            loadUserProfile(user),
            updateVerificationState(user)
          ]);
          
          console.log('✅ Carga completa. Perfil:', profile, 'Verificación:', verificationResult);

          // Actualizar todo el estado de una vez
          setAuthState(prev => ({
            ...prev,
            user,
            userProfile: profile,
            isAuthenticated: true,
            isEmailVerified: verificationResult,
            emailVerificationState: {
              ...prev.emailVerificationState, // Mantener el conteo si ya existe
              isEmailVerified: verificationResult,
            },
            loading: false, // Ahora sí, la carga ha terminado
          }));
          
        } catch (error) {
          console.error('❌ Error cargando información de usuario:', error);
          // Si hay un error, terminar la carga y dejar al usuario sin perfil
          setAuthState(prev => ({
            ...prev,
            user, // Mantener el usuario de Auth
            isAuthenticated: true,
            userProfile: null,
            loading: false,
          }));
        }
      } else {
        console.log('❌ No hay usuario autenticado');
        setAuthState({
          user: null,
          userProfile: null,
          loading: false, // La carga termina, no hay usuario
          emailVerificationState: {
            isEmailVerified: false,
            verificationCount: 0
          },
          isAuthenticated: false,
          isEmailVerified: false
        });
      }
    });

    // Guardar la función de limpieza globalmente
    globalAuthUnsubscribe = unsubscribe;

    // Cleanup function
    return () => {
      console.log('🔐 Limpiando listener de autenticación GLOBAL');
      if (globalAuthUnsubscribe) {
        globalAuthUnsubscribe();
        globalAuthUnsubscribe = null;
        globalAuthListenerSetup = false;
      }
    };
  }, []); // Sin dependencias para que solo se ejecute una vez

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