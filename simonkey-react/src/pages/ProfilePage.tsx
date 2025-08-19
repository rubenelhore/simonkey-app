// src/pages/ProfilePage.tsx
import React, { useState, useEffect } from 'react';

declare global {
  interface Window {
    recaptchaVerifier: any;
  }
}
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useUserType } from '../hooks/useUserType';
import HeaderWithHamburger from '../components/HeaderWithHamburger';
import { db, auth } from '../services/firebase';
import { doc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { 
  updatePassword, 
  reauthenticateWithCredential, 
  EmailAuthProvider, 
  deleteUser,
  multiFactor,
  PhoneAuthProvider,
  PhoneMultiFactorGenerator,
  RecaptchaVerifier,
  getMultiFactorResolver
} from 'firebase/auth';
import { SchoolRole, UserSubscriptionType } from '../types/interfaces';
import '../styles/ProfilePage.css';

interface ProfileStats {
  totalNotebooks: number;
  totalConcepts: number;
  conceptsDominated: number;
  studyStreak: number;
  totalStudyTime: number;
  weeklyGoal: number;
  achievementsCount: number;
  averageSessionTime: number;
}

interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';
  language: string;
  notifications: {
    email: boolean;
    push: boolean;
    studyReminders: boolean;
    achievements: boolean;
  };
  study: {
    dailyGoalMinutes: number;
    preferredTimes: string[];
    difficultyLevel: 'beginner' | 'intermediate' | 'advanced';
    learningStyle: 'visual' | 'auditory' | 'kinesthetic' | 'mixed';
  };
  privacy: {
    profilePublic: boolean;
    showStats: boolean;
    showProgress: boolean;
  };
}

const ProfilePage: React.FC = () => {
  const { user, userProfile, loading: authLoading, logout } = useAuth();
  const { schoolRole, isSchoolUser, isSchoolStudent, isSuperAdmin, subscription } = useUserType();
  const navigate = useNavigate();
  
  const [isEditing, setIsEditing] = useState(false);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  
  const [editedProfile, setEditedProfile] = useState({
    nombre: '',
    username: '',
    bio: '',
    birthdate: '',
    location: '',
    interests: [] as string[],
    learningGoal: '',
    photoURL: ''
  });

  const [preferences, setPreferences] = useState<UserPreferences>({
    theme: 'auto',
    language: 'es',
    notifications: {
      email: true,
      push: true,
      studyReminders: true,
      achievements: true
    },
    study: {
      dailyGoalMinutes: 30,
      preferredTimes: ['morning'],
      difficultyLevel: 'intermediate',
      learningStyle: 'mixed'
    },
    privacy: {
      profilePublic: false,
      showStats: true,
      showProgress: true
    }
  });
  
  const [stats, setStats] = useState<ProfileStats>({
    totalNotebooks: 0,
    totalConcepts: 0,
    conceptsDominated: 0,
    studyStreak: 0,
    totalStudyTime: 0,
    weeklyGoal: 210, // 30 min * 7 days
    achievementsCount: 0,
    averageSessionTime: 0
  });
  
  const [saving, setSaving] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [fieldErrors, setFieldErrors] = useState({
    currentPassword: false,
    newPassword: false,
    confirmPassword: false
  });
  const [showPasswords, setShowPasswords] = useState({
    currentPassword: false,
    newPassword: false,
    confirmPassword: false
  });
  const [pasteAttempted, setPasteAttempted] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);
  
  // 2FA States with Firebase MFA
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [step2FA, setStep2FA] = useState<'phone' | 'verify' | 'success'>('phone');
  const [is2FAEnabled, setIs2FAEnabled] = useState(false);
  const [setting2FA, setSetting2FA] = useState(false);
  const [error2FA, setError2FA] = useState('');
  const [verificationId, setVerificationId] = useState('');
  const [resolver, setResolver] = useState<any>(null);
  const [showReauthModal, setShowReauthModal] = useState(false);
  const [reauthPassword, setReauthPassword] = useState('');
  
  // Avatar modal states
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Limpiar reCAPTCHA al desmontar el componente
  useEffect(() => {
    return () => {
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
        window.recaptchaVerifier = null;
      }
    };
  }, []);
  
  useEffect(() => {
    if (userProfile) {
      setEditedProfile({
        nombre: userProfile.nombre || '',
        username: userProfile.username || '',
        bio: userProfile.bio || '',
        birthdate: userProfile.birthdate || '',
        location: userProfile.location || '',
        interests: userProfile.interests || [],
        learningGoal: userProfile.learningGoal || '',
        photoURL: userProfile.photoURL || ''
      });
      
      // Load preferences from userProfile
      if (userProfile.preferences) {
        setPreferences({
          ...preferences,
          ...userProfile.preferences
        });
      }
      
      // Load stats (in production these would come from Firebase/KPI service)
      setStats({
        totalNotebooks: userProfile.notebookCount || 0,
        totalConcepts: userProfile.conceptCount || Math.floor(Math.random() * 100) + 50,
        conceptsDominated: Math.floor((userProfile.conceptCount || 50) * 0.7),
        studyStreak: userProfile.studyStreak || Math.floor(Math.random() * 30) + 1,
        totalStudyTime: userProfile.totalStudyTime || Math.floor(Math.random() * 50) + 10,
        weeklyGoal: userProfile.weeklyGoal || 210,
        achievementsCount: userProfile.achievementsCount || Math.floor(Math.random() * 10) + 1,
        averageSessionTime: userProfile.averageSessionTime || 25
      });
    }
  }, [userProfile]);
  
  // Check if 2FA is enabled with Firebase MFA
  useEffect(() => {
    if (user) {
      const mfa = multiFactor(user);
      setIs2FAEnabled(mfa.enrolledFactors.length > 0);
    }
  }, [user]);

  const handleSaveSection = async (section: string) => {
    if (!user) return;
    
    setSaving(true);
    try {
      let updateData: any = {};
      
      if (section === 'personal') {
        updateData = {
          nombre: editedProfile.nombre,
          username: editedProfile.username,
          bio: editedProfile.bio,
          birthdate: editedProfile.birthdate,
          location: editedProfile.location,
          interests: editedProfile.interests,
          learningGoal: editedProfile.learningGoal,
          photoURL: editedProfile.photoURL,
          updatedAt: new Date()
        };
      } else if (section === 'preferences') {
        updateData = {
          preferences: preferences,
          updatedAt: new Date()
        };
      }

      await updateDoc(doc(db, 'users', user.uid), updateData);
      setEditingSection(null);
    } catch (error) {
      console.error('Error updating profile:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const validatePassword = (password: string) => {
    // Mínimo 8 caracteres
    if (password.length < 8) {
      return { isValid: false, message: 'La nueva contraseña debe tener al menos 8 caracteres' };
    }
    
    // Al menos una letra
    if (!/[a-zA-Z]/.test(password)) {
      return { isValid: false, message: 'La nueva contraseña debe contener al menos una letra' };
    }
    
    // Al menos un número
    if (!/[0-9]/.test(password)) {
      return { isValid: false, message: 'La nueva contraseña debe contener al menos un número' };
    }
    
    // Al menos un símbolo especial
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password)) {
      return { isValid: false, message: 'La nueva contraseña debe contener al menos un símbolo especial (!@#$%^&*()_+-=[]{}|;:,.<>?)' };
    }
    
    return { isValid: true, message: '' };
  };

  const getPasswordRequirements = (password: string) => {
    return [
      {
        text: 'Al menos 8 caracteres',
        valid: password.length >= 8
      },
      {
        text: 'Al menos una letra',
        valid: /[a-zA-Z]/.test(password)
      },
      {
        text: 'Al menos un número',
        valid: /[0-9]/.test(password)
      },
      {
        text: 'Al menos un símbolo (!@#$%^&*)',
        valid: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password)
      }
    ];
  };

  // Función para prevenir pegado desde portapapeles
  const handlePreventPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    setPasteAttempted(true);
    // Ocultar el mensaje después de 3 segundos
    setTimeout(() => setPasteAttempted(false), 3000);
  };

  // Función para prevenir arrastrar y soltar
  const handlePreventDrop = (e: React.DragEvent<HTMLInputElement>) => {
    e.preventDefault();
  };

  const handleClosePasswordModal = () => {
    setShowPasswordModal(false);
    setPasswordError('');
    setPasswordSuccess('');
    setFieldErrors({
      currentPassword: false,
      newPassword: false,  
      confirmPassword: false
    });
    setShowPasswords({
      currentPassword: false,
      newPassword: false,
      confirmPassword: false
    });
    setPasswordData({
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    });
    setPasteAttempted(false);
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    
    // Validar que el usuario escribió "ELIMINAR"
    if (deleteConfirmText !== 'ELIMINAR') {
      setDeleteError('Debes escribir ELIMINAR para confirmar');
      return;
    }
    
    setDeleting(true);
    setDeleteError('');
    
    try {
      // Primero eliminar los datos del usuario de Firestore
      await deleteDoc(doc(db, 'users', user.uid));
      
      // Luego eliminar la cuenta de autenticación
      await deleteUser(user);
      
      // Navegar a la página de inicio
      navigate('/');
    } catch (error: any) {
      console.error('Error deleting account:', error);
      
      if (error.code === 'auth/requires-recent-login') {
        setDeleteError('Por seguridad, necesitas iniciar sesión nuevamente antes de eliminar tu cuenta');
      } else {
        setDeleteError('Error al eliminar la cuenta. Por favor, inténtalo de nuevo más tarde');
      }
    } finally {
      setDeleting(false);
    }
  };

  const handleCloseDeleteModal = () => {
    setShowDeleteModal(false);
    setDeleteConfirmText('');
    setDeleteError('');
  };

  // 2FA Functions with Firebase MFA
  const setupRecaptcha = () => {
    try {
      // Limpiar cualquier verificador anterior
      if (window.recaptchaVerifier) {
        try {
          window.recaptchaVerifier.clear();
        } catch (e) {
          console.log('Could not clear existing verifier');
        }
        window.recaptchaVerifier = null;
      }
      
      // Asegurar que el elemento existe
      const recaptchaContainer = document.getElementById('recaptcha-container');
      if (!recaptchaContainer) {
        console.error('recaptcha-container element not found');
        return null;
      }
      
      // Crear nuevo verificador
      window.recaptchaVerifier = new RecaptchaVerifier('recaptcha-container', {
        size: 'invisible',
        callback: (response: any) => {
          console.log('reCAPTCHA solved:', response);
        },
        'expired-callback': () => {
          console.log('reCAPTCHA expired');
          setError2FA('El captcha ha expirado. Por favor, intenta de nuevo.');
        }
      }, auth);
      
      // Intentar renderizar el widget
      window.recaptchaVerifier.render().then((widgetId: any) => {
        console.log('RecaptchaVerifier rendered with widget ID:', widgetId);
      }).catch((error: any) => {
        console.error('Error rendering recaptcha:', error);
      });
      
      console.log('RecaptchaVerifier created successfully');
      return window.recaptchaVerifier;
    } catch (error) {
      console.error('Error setting up recaptcha:', error);
      setError2FA('Error al configurar la verificación. Por favor, recarga la página.');
      return null;
    }
  };

  const handleSendVerificationCode = async () => {
    if (!user || !phoneNumber) {
      setError2FA('Por favor ingresa tu número de teléfono');
      return;
    }

    setSetting2FA(true);
    setError2FA('');

    try {
      console.log('Starting phone verification process...');
      console.log('Phone number:', phoneNumber);
      console.log('User:', user.uid);
      
      const recaptchaVerifier = setupRecaptcha();
      if (!recaptchaVerifier) {
        setError2FA('Error al configurar la verificación. Por favor, recarga la página.');
        setSetting2FA(false);
        return;
      }
      
      console.log('Getting MFA session...');
      const session = await multiFactor(user).getSession();
      console.log('MFA session obtained');
      
      const phoneAuthProvider = new PhoneAuthProvider(auth);
      
      const phoneInfoOptions = {
        phoneNumber: phoneNumber,
        session: session
      };
      
      console.log('Verifying phone number with options:', phoneInfoOptions);
      const verificationId = await phoneAuthProvider.verifyPhoneNumber(
        phoneInfoOptions,
        recaptchaVerifier
      );
      
      setVerificationId(verificationId);
      setStep2FA('verify');
    } catch (error: any) {
      console.error('Error sending verification:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      
      if (error.code === 'auth/requires-recent-login') {
        setError2FA(''); // Clear error message
        setShowReauthModal(true);
        setShow2FAModal(false); // Close 2FA modal
        setSetting2FA(false);
      } else if (error.code === 'auth/invalid-phone-number') {
        setError2FA('Número de teléfono inválido. Incluye el código de país (ej: +52 para México)');
      } else if (error.code === 'auth/too-many-requests') {
        setError2FA('Demasiados intentos. Por favor espera unos minutos.');
      } else if (error.code === 'auth/invalid-app-credential') {
        setError2FA('Error de configuración. Por favor, contacta al soporte.');
      } else {
        setError2FA('Error al enviar el código. Verifica tu número e intenta de nuevo.');
      }
    } finally {
      setSetting2FA(false);
    }
  };

  const handleReauthenticate = async () => {
    if (!user || !user.email || !reauthPassword) {
      setError2FA('Por favor ingresa tu contraseña');
      return;
    }

    setSetting2FA(true);
    setError2FA('');

    try {
      const credential = EmailAuthProvider.credential(user.email, reauthPassword);
      await reauthenticateWithCredential(user, credential);
      
      // Successfully reauthenticated, now retry 2FA setup
      setShowReauthModal(false);
      setReauthPassword('');
      setShow2FAModal(true); // Reopen 2FA modal
      
      // Clear any existing recaptcha before retrying
      if (window.recaptchaVerifier) {
        try {
          window.recaptchaVerifier.clear();
        } catch (error) {
          console.error('Error clearing recaptcha:', error);
        }
        window.recaptchaVerifier = null;
      }
      
      // Small delay to ensure modal is rendered
      setTimeout(async () => {
        await handleSendVerificationCode();
      }, 100);
    } catch (error: any) {
      console.error('Error during reauthentication:', error);
      if (error.code === 'auth/wrong-password') {
        setError2FA('Contraseña incorrecta. Por favor intenta de nuevo.');
      } else if (error.code === 'auth/too-many-requests') {
        setError2FA('Demasiados intentos fallidos. Por favor espera unos minutos.');
      } else {
        setError2FA('Error al verificar tu contraseña. Por favor intenta de nuevo.');
      }
    } finally {
      setSetting2FA(false);
    }
  };

  const handleVerifyAndEnroll = async () => {
    if (!user || !verificationCode || !verificationId) {
      setError2FA('Por favor ingresa el código de verificación');
      return;
    }

    setSetting2FA(true);
    setError2FA('');

    try {
      const cred = PhoneAuthProvider.credential(verificationId, verificationCode);
      const multiFactorAssertion = PhoneMultiFactorGenerator.assertion(cred);
      
      await multiFactor(user).enroll(multiFactorAssertion, phoneNumber);
      
      setIs2FAEnabled(true);
      setStep2FA('success');
      
      // Update user profile
      await updateDoc(doc(db, 'users', user.uid), {
        twoFactorEnabled: true,
        phoneNumber: phoneNumber,
        updatedAt: new Date()
      });
      
      setTimeout(() => {
        handleClose2FAModal();
      }, 3000);
    } catch (error: any) {
      console.error('Error verifying code:', error);
      if (error.code === 'auth/invalid-verification-code') {
        setError2FA('Código incorrecto. Por favor verifica e intenta de nuevo.');
      } else if (error.code === 'auth/code-expired') {
        setError2FA('El código ha expirado. Por favor solicita uno nuevo.');
      } else {
        setError2FA('Error al verificar el código. Intenta de nuevo.');
      }
    } finally {
      setSetting2FA(false);
    }
  };

  const handleDisable2FA = async () => {
    if (!user) return;
    
    setSetting2FA(true);
    setError2FA('');
    
    try {
      const mfa = multiFactor(user);
      const factors = mfa.enrolledFactors;
      
      if (factors.length > 0) {
        await mfa.unenroll(factors[0]);
        
        await updateDoc(doc(db, 'users', user.uid), {
          twoFactorEnabled: false,
          phoneNumber: null,
          updatedAt: new Date()
        });
        
        setIs2FAEnabled(false);
        handleClose2FAModal();
      }
    } catch (error: any) {
      console.error('Error disabling 2FA:', error);
      setError2FA('Error al desactivar 2FA. Por favor intenta de nuevo.');
    } finally {
      setSetting2FA(false);
    }
  };

  const handleClose2FAModal = () => {
    setShow2FAModal(false);
    setPhoneNumber('');
    setVerificationCode('');
    setVerificationId('');
    setStep2FA('phone');
    setError2FA('');
    if (window.recaptchaVerifier) {
      window.recaptchaVerifier.clear();
      window.recaptchaVerifier = null;
    }
  };

  const handlePasswordChange = async () => {
    if (!user) return;

    setPasswordError('');
    setPasswordSuccess('');
    setFieldErrors({
      currentPassword: false,
      newPassword: false,
      confirmPassword: false
    });

    // Validaciones
    if (!passwordData.currentPassword) {
      setFieldErrors(prev => ({ ...prev, currentPassword: true }));
      setPasswordError('Por favor ingresa tu contraseña actual para verificar tu identidad');
      return;
    }

    if (!passwordData.newPassword) {
      setFieldErrors(prev => ({ ...prev, newPassword: true }));
      setPasswordError('Por favor ingresa una nueva contraseña');
      return;
    }

    if (!passwordData.confirmPassword) {
      setFieldErrors(prev => ({ ...prev, confirmPassword: true }));
      setPasswordError('Por favor confirma tu nueva contraseña');
      return;
    }

    // Validar la nueva contraseña
    const passwordValidation = validatePassword(passwordData.newPassword);
    if (!passwordValidation.isValid) {
      setFieldErrors(prev => ({ ...prev, newPassword: true }));
      setPasswordError(passwordValidation.message);
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setFieldErrors(prev => ({ ...prev, newPassword: true, confirmPassword: true }));
      setPasswordError('Las contraseñas no coinciden. Asegúrate de escribir la misma contraseña en ambos campos');
      return;
    }

    if (passwordData.newPassword === passwordData.currentPassword) {
      setFieldErrors(prev => ({ ...prev, newPassword: true }));
      setPasswordError('La nueva contraseña debe ser diferente a la actual por seguridad');
      return;
    }

    setSaving(true);

    try {
      // Reautenticar al usuario
      const credential = EmailAuthProvider.credential(user.email!, passwordData.currentPassword);
      await reauthenticateWithCredential(user, credential);

      // Cambiar la contraseña
      await updatePassword(user, passwordData.newPassword);

      setPasswordSuccess('¡Contraseña cambiada exitosamente! Tu cuenta ahora está más segura.');
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });

      // Cerrar modal después de 2 segundos
      setTimeout(() => {
        handleClosePasswordModal();
      }, 2000);

    } catch (error: any) {
      console.error('Error changing password:', error);
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-login-credentials') {
        setFieldErrors(prev => ({ ...prev, currentPassword: true }));
        setPasswordError('La contraseña actual es incorrecta. Por favor verifica que hayas escrito correctamente tu contraseña actual');
      } else if (error.code === 'auth/weak-password') {
        setFieldErrors(prev => ({ ...prev, newPassword: true }));
        setPasswordError('La nueva contraseña es muy débil. Debe tener al menos 8 caracteres con letras, números y símbolos especiales');
      } else if (error.code === 'auth/requires-recent-login') {
        setPasswordError('Por seguridad, necesitas iniciar sesión nuevamente antes de cambiar tu contraseña');
      } else if (error.code === 'auth/too-many-requests') {
        setPasswordError('Demasiados intentos fallidos. Por favor espera unos minutos antes de intentar de nuevo');
      } else if (error.code === 'auth/network-request-failed') {
        setPasswordError('Error de conexión. Por favor verifica tu conexión a internet e inténtalo de nuevo');
      } else if (error.code === 'auth/user-disabled') {
        setPasswordError('Tu cuenta ha sido deshabilitada. Contacta al soporte para más información');
      } else if (error.code === 'auth/user-not-found') {
        setPasswordError('Usuario no encontrado. Por favor inicia sesión nuevamente');
      } else {
        setPasswordError(`Error al cambiar la contraseña: ${error.message || 'Error desconocido'}. Por favor inténtalo de nuevo`);
      }
    } finally {
      setSaving(false);
    }
  };

  const getSubscriptionBadge = () => {
    if (isSuperAdmin) return { text: 'Super Admin', color: '#6147FF', icon: 'fas fa-crown' };
    if (isSchoolUser) {
      if (schoolRole === SchoolRole.TEACHER) return { text: 'Profesor', color: '#10b981', icon: 'fas fa-chalkboard-teacher' };
      if (schoolRole === SchoolRole.STUDENT) return { text: 'Estudiante', color: '#3b82f6', icon: 'fas fa-user-graduate' };
    }
    if (subscription === UserSubscriptionType.PRO) return { text: 'Pro', color: '#f59e0b', icon: 'fas fa-star' };
    return { text: 'Free', color: '#6b7280', icon: 'fas fa-user' };
  };



  if (authLoading) {
    return (
      <div className="profile-page-container">
        <HeaderWithHamburger title="Mi Perfil" />
        <div className="profile-loading">
          <div className="loading-spinner"></div>
          <p>Cargando tu perfil...</p>
        </div>
      </div>
    );
  }

  if (!user || !userProfile) {
    return (
      <div className="profile-page-container">
        <HeaderWithHamburger title="Mi Perfil" />
        <div className="profile-error">
          <i className="fas fa-exclamation-circle"></i>
          <p>No se pudo cargar el perfil</p>
          <button onClick={() => navigate('/login')} className="profile-error-button">
            Iniciar sesión
          </button>
        </div>
      </div>
    );
  }

  const subscriptionInfo = getSubscriptionBadge();

  return (
    <div className="profile-page-container single-module">
      <HeaderWithHamburger title="Mi Perfil" />
      
      {/* Single Module Content */}
      <div className="profile-content">
        {/* Hero Section */}
        <div className="profile-hero-modern">
          <div className="profile-hero-background">
            <div className="hero-pattern"></div>
          </div>
          <div className="profile-hero-content">
            <div className="profile-avatar-section">
              <div className="profile-avatar-large">
                {editedProfile.photoURL ? (
                  editedProfile.photoURL.startsWith('http') ? (
                    <img src={editedProfile.photoURL} alt="Avatar" />
                  ) : (
                    <div className="profile-avatar-emoji">
                      {editedProfile.photoURL}
                    </div>
                  )
                ) : (
                  <div className="profile-avatar-placeholder">
                    🐒
                  </div>
                )}
                <button className="avatar-edit-btn" onClick={() => setShowAvatarModal(true)}>
                  <i className="fas fa-camera"></i>
                </button>
              </div>
              <div className={`profile-subscription-badge ${subscriptionInfo.text.toLowerCase().replace(' ', '-')}`}>
                <i className={`badge-icon ${subscriptionInfo.icon}`}></i>
                <span className="badge-text">{subscriptionInfo.text}</span>
              </div>
            </div>
            <div className="profile-info-section">
              <h1 className="profile-name">{editedProfile.nombre || 'Usuario'}</h1>
              <p className="profile-username">@{editedProfile.username || user.email?.split('@')[0]}</p>
              <p className="profile-email">{user.email}</p>
            </div>
          </div>
        </div>

        {/* Personal Information and Security in two columns */}
        <div className="profile-content-main">
          <div className="profile-personal">
            <div className="profile-section-card">
              <div className="section-header">
                <h3>Información Personal</h3>
                <button 
                  className="edit-section-btn"
                  onClick={() => setEditingSection(editingSection === 'personal' ? null : 'personal')}
                >
                  <i className={`fas fa-${editingSection === 'personal' ? 'times' : 'edit'}`}></i>
                </button>
              </div>
              <div className="section-content">
                {editingSection === 'personal' ? (
                  <div className="edit-form">
                    <div className="form-row">
                      <div className="form-group">
                        <label>Nombre completo</label>
                        <input
                          type="text"
                          value={editedProfile.nombre}
                          onChange={(e) => setEditedProfile({ ...editedProfile, nombre: e.target.value })}
                          placeholder="Tu nombre completo"
                        />
                      </div>
                    </div>
                    
                    <div className="form-row">
                      <div className="form-group">
                        <label>Fecha de nacimiento</label>
                        <input
                          type="date"
                          value={editedProfile.birthdate}
                          onChange={(e) => setEditedProfile({ ...editedProfile, birthdate: e.target.value })}
                        />
                      </div>
                    </div>
                    
                    <div className="form-row">
                      <div className="form-group">
                        <label>Intereses</label>
                        <input
                          type="text"
                          placeholder="Agrega un interés y presiona Enter"
                          onKeyPress={(e) => {
                            if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                              e.preventDefault();
                              setEditedProfile({
                                ...editedProfile,
                                interests: [...editedProfile.interests, e.currentTarget.value.trim()]
                              });
                              e.currentTarget.value = '';
                            }
                          }}
                        />
                        {editedProfile.interests.length > 0 && (
                          <div className="interests-list" style={{ marginTop: '0.5rem' }}>
                            {editedProfile.interests.map((interest, index) => (
                              <span key={index} className="interest-tag editable">
                                {interest}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditedProfile({
                                      ...editedProfile,
                                      interests: editedProfile.interests.filter((_, i) => i !== index)
                                    });
                                  }}
                                  className="remove-interest"
                                >
                                  <i className="fas fa-times"></i>
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="form-actions">
                      <button 
                        onClick={() => handleSaveSection('personal')}
                        disabled={saving}
                        className="btn-primary"
                      >
                        {saving ? (
                          <>
                            <i className="fas fa-spinner fa-spin"></i>
                            Guardando...
                          </>
                        ) : (
                          <>
                            <i className="fas fa-save"></i>
                            Guardar cambios
                          </>
                        )}
                      </button>
                      <button 
                        onClick={() => setEditingSection(null)}
                        className="btn-secondary"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="info-display">
                    <div className="info-item">
                      <label>Nombre completo</label>
                      <span>{editedProfile.nombre || 'No especificado'}</span>
                    </div>
                    <div className="info-item">
                      <label>Email</label>
                      <span>{user.email}</span>
                    </div>
                    <div className="info-item">
                      <label>Fecha de nacimiento</label>
                      <span>{editedProfile.birthdate || 'No especificado'}</span>
                    </div>
                    <div className="info-item">
                      <label>Intereses</label>
                      <span>
                        {editedProfile.interests.length > 0 ? (
                          <div className="interests-list">
                            {editedProfile.interests.map((interest, index) => (
                              <span key={index} className="interest-tag">
                                {interest}
                              </span>
                            ))}
                          </div>
                        ) : (
                          'No especificado'
                        )}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Security Section */}
          <div className="profile-security">
            <div className="profile-section-card">
              <div className="section-header">
                <h3>Seguridad de la cuenta</h3>
              </div>
              <div className="section-content">
                <div className="security-actions">
                  <div className="security-item">
                    <div className="security-info">
                      <i className="fas fa-key"></i>
                      <div>
                        <h4>Cambiar contraseña</h4>
                        <p>Actualiza tu contraseña regularmente</p>
                      </div>
                    </div>
                    <button 
                      className="btn-outline security-action-btn"
                      onClick={() => setShowPasswordModal(true)}
                    >
                      Cambiar
                    </button>
                  </div>
                  
                  <div className="security-item">
                    <div className="security-info">
                      <i className="fas fa-shield-alt"></i>
                      <div>
                        <h4>Autenticación de dos factores</h4>
                        <p>{is2FAEnabled ? 'Protección adicional activada' : 'Añade una capa extra de seguridad'}</p>
                      </div>
                    </div>
                    <button 
                      className={`btn-outline security-action-btn ${is2FAEnabled ? 'btn-success' : ''}`}
                      onClick={() => setShow2FAModal(true)}
                    >
                      {is2FAEnabled ? 'Gestionar' : 'Configurar'}
                    </button>
                  </div>
                  
                  <div className="security-item">
                    <div className="security-info">
                      <i className="fas fa-graduation-cap"></i>
                      <div>
                        <h4>Tutorial de introducción</h4>
                        <p>Volver a ver el tutorial de bienvenida de Simonkey</p>
                      </div>
                    </div>
                    <button 
                      className="btn-outline security-action-btn"
                      onClick={() => {
                        // Reiniciar InteractiveTour
                        localStorage.removeItem('hasCompletedOnboarding');
                        localStorage.removeItem('tourStep'); // Resetear el paso del tour al paso 1
                        if (user) {
                          updateDoc(doc(db, 'users', user.uid), {
                            hasCompletedOnboarding: false,
                            updatedAt: new Date()
                          }).then(() => {
                            // Recargar la página para activar el tour interactivo
                            window.location.reload();
                          });
                        }
                      }}
                    >
                      Reiniciar Tutorial
                    </button>
                  </div>
                  
                  <div className="security-item danger-item">
                    <div className="security-info">
                      <i className="fas fa-exclamation-triangle"></i>
                      <div>
                        <h4>Eliminar cuenta</h4>
                        <p>Esta acción no se puede deshacer</p>
                      </div>
                    </div>
                    <button 
                      className="btn-danger"
                      onClick={() => setShowDeleteModal(true)}
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Logout Button - Always visible */}
      <div className="profile-footer">
        <button onClick={handleLogout} className="logout-btn">
          <i className="fas fa-sign-out-alt"></i>
          Cerrar sesión
        </button>
      </div>

      {/* Password Change Modal */}
      {showPasswordModal && (
        <div className="modal-overlay" onClick={handleClosePasswordModal}>
          <div className="password-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                <i className="fas fa-key"></i>
                Actualizar Contraseña
              </h3>
              <button 
                className="modal-close-btn"
                onClick={handleClosePasswordModal}
                title="Cerrar"
              >
                ×
              </button>
            </div>
            
            <div className="modal-body">
              {/* Mensaje de intento de pegado */}
              {pasteAttempted && (
                <div className="paste-blocked-message">
                  <i className="fas fa-exclamation-triangle"></i>
                  <span>Por seguridad, no se permite pegar contraseñas. Escríbela manualmente.</span>
                </div>
              )}
              <div className="form-group">
                <label>Contraseña actual</label>
                <div className="password-input-container">
                  <input
                    type={showPasswords.currentPassword ? "text" : "password"}
                    value={passwordData.currentPassword}
                    onChange={(e) => {
                      setPasswordData({
                        ...passwordData,
                        currentPassword: e.target.value
                      });
                      // Clear field error when user starts typing
                      if (fieldErrors.currentPassword) {
                        setFieldErrors(prev => ({ ...prev, currentPassword: false }));
                        setPasswordError('');
                      }
                    }}
                    onPaste={handlePreventPaste}
                    onDrop={handlePreventDrop}
                    onDragOver={(e) => e.preventDefault()}
                    placeholder="Ingresa tu contraseña actual"
                    className={fieldErrors.currentPassword ? 'error' : ''}
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowPasswords(prev => ({ 
                      ...prev, 
                      currentPassword: !prev.currentPassword 
                    }))}
                    title={showPasswords.currentPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  >
                    <i className={showPasswords.currentPassword ? "fas fa-eye-slash" : "fas fa-eye"}></i>
                  </button>
                </div>
              </div>
              
              <div className="form-group">
                <label>Nueva contraseña</label>
                <div className="password-input-container">
                  <input
                    type={showPasswords.newPassword ? "text" : "password"}
                    value={passwordData.newPassword}
                    onChange={(e) => {
                      setPasswordData({
                        ...passwordData,
                        newPassword: e.target.value
                      });
                      // Clear field error when user starts typing
                      if (fieldErrors.newPassword) {
                        setFieldErrors(prev => ({ ...prev, newPassword: false }));
                        setPasswordError('');
                      }
                    }}
                    onPaste={handlePreventPaste}
                    onDrop={handlePreventDrop}
                    onDragOver={(e) => e.preventDefault()}
                    placeholder="Ingresa tu nueva contraseña"
                    className={fieldErrors.newPassword ? 'error' : ''}
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowPasswords(prev => ({ 
                      ...prev, 
                      newPassword: !prev.newPassword,
                      // Si mostramos nueva contraseña, ocultamos confirmación
                      confirmPassword: prev.newPassword ? prev.confirmPassword : false
                    }))}
                    title={showPasswords.newPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  >
                    <i className={showPasswords.newPassword ? "fas fa-eye-slash" : "fas fa-eye"}></i>
                  </button>
                </div>
                
                {/* Mostrar requisitos de contraseña solo si hay texto */}
                {passwordData.newPassword && (
                  <div className="password-requirements">
                    {getPasswordRequirements(passwordData.newPassword).map((req, index) => (
                      <div key={index}>
                        <div className={`password-requirement ${req.valid ? 'valid' : 'invalid'}`}>
                          <i className={req.valid ? 'fas fa-check' : 'fas fa-times'}></i>
                          <span>{req.text}</span>
                        </div>
                        {/* Mostrar ejemplos de símbolos si es el requisito de símbolos y no es válido */}
                        {index === 3 && !req.valid && passwordData.newPassword && (
                          <div className="password-symbols-hint">
                            Ejemplo: ! @ # $ % ^ & * ( ) _ + - = [ ]
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="form-group">
                <label>Confirmar nueva contraseña</label>
                <div className="password-input-container">
                  <input
                    type={showPasswords.confirmPassword ? "text" : "password"}
                    value={passwordData.confirmPassword}
                    onChange={(e) => {
                      setPasswordData({
                        ...passwordData,
                        confirmPassword: e.target.value
                      });
                      // Clear field error when user starts typing
                      if (fieldErrors.confirmPassword) {
                        setFieldErrors(prev => ({ ...prev, confirmPassword: false }));
                        setPasswordError('');
                      }
                    }}
                    onPaste={handlePreventPaste}
                    onDrop={handlePreventDrop}
                    onDragOver={(e) => e.preventDefault()}
                    placeholder="Confirma tu nueva contraseña"
                    className={fieldErrors.confirmPassword ? 'error' : ''}
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowPasswords(prev => ({ 
                      ...prev, 
                      confirmPassword: !prev.confirmPassword,
                      // Si mostramos confirmación, ocultamos nueva contraseña
                      newPassword: prev.confirmPassword ? prev.newPassword : false
                    }))}
                    title={showPasswords.confirmPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  >
                    <i className={showPasswords.confirmPassword ? "fas fa-eye-slash" : "fas fa-eye"}></i>
                  </button>
                </div>
              </div>
              
              {passwordError && (
                <div className="password-error">
                  <i className="fas fa-exclamation-circle"></i>
                  {passwordError}
                </div>
              )}
              
              {passwordSuccess && (
                <div className="password-success">
                  <i className="fas fa-check-circle"></i>
                  {passwordSuccess}
                </div>
              )}
            </div>
            
            <div className="modal-footer">
              <button 
                className="btn-secondary"
                onClick={handleClosePasswordModal}
                disabled={saving}
              >
                Cancelar
              </button>
              <button 
                className="btn-primary"
                onClick={handlePasswordChange}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <i className="fas fa-spinner fa-spin"></i>
                    Cambiando...
                  </>
                ) : (
                  <>
                    <i className="fas fa-save"></i>
                    Cambiar Contraseña
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Account Modal */}
      {showDeleteModal && (
        <div className="modal-overlay" onClick={handleCloseDeleteModal}>
          <div className="delete-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header danger">
              <h3>
                <i className="fas fa-exclamation-triangle"></i>
                ⚠️ Eliminar Cuenta Permanentemente
              </h3>
              <button 
                className="modal-close-btn"
                onClick={handleCloseDeleteModal}
                title="Cerrar"
              >
                ×
              </button>
            </div>
            
            <div className="modal-body">
              <div className="delete-warning">
                <p className="warning-text">
                  <strong>¡ADVERTENCIA!</strong> Esta acción es irreversible y tendrá las siguientes consecuencias:
                </p>
                <ul className="consequences-list">
                  <li>Se eliminarán todos tus cuadernos y conceptos</li>
                  <li>Se perderá todo tu progreso de estudio</li>
                  <li>Se eliminarán tus logros y estadísticas</li>
                  <li>No podrás recuperar tu cuenta ni tu información</li>
                  <li>Se cancelará tu suscripción actual</li>
                </ul>
              </div>
              
              <div className="delete-confirmation">
                <p>Para confirmar que deseas eliminar tu cuenta permanentemente, escribe <strong>ELIMINAR</strong> en el campo de abajo:</p>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="Escribe ELIMINAR para confirmar"
                  className={deleteError ? 'error' : ''}
                />
              </div>
              
              {deleteError && (
                <div className="delete-error">
                  <i className="fas fa-exclamation-circle"></i>
                  {deleteError}
                </div>
              )}
            </div>
            
            <div className="modal-footer">
              <button 
                className="btn-secondary"
                onClick={handleCloseDeleteModal}
                disabled={deleting}
              >
                Cancelar
              </button>
              <button 
                className="btn-danger-confirm"
                onClick={handleDeleteAccount}
                disabled={deleting || deleteConfirmText !== 'ELIMINAR'}
              >
                {deleting ? (
                  <>
                    <i className="fas fa-spinner fa-spin"></i>
                    Eliminando...
                  </>
                ) : (
                  <>
                    <i className="fas fa-trash"></i>
                    Eliminar mi cuenta
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2FA Configuration Modal */}
      {/* Reauthentication Modal */}
      {showReauthModal && (
        <div className="modal-overlay" onClick={() => setShowReauthModal(false)}>
          <div className="twofa-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header twofa">
              <h3>
                <i className="fas fa-lock"></i>
                Confirmar Identidad
              </h3>
              <button 
                className="close-btn" 
                onClick={() => setShowReauthModal(false)}
                disabled={setting2FA}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            
            <div className="modal-body twofa">
              <p className="twofa-description">
                Por seguridad, necesitas confirmar tu contraseña antes de configurar la autenticación de dos factores.
              </p>
              
              <div className="twofa-form">
                <label htmlFor="reauth-password">Contraseña actual:</label>
                <input
                  id="reauth-password"
                  type="password"
                  value={reauthPassword}
                  onChange={(e) => setReauthPassword(e.target.value)}
                  placeholder="Ingresa tu contraseña"
                  disabled={setting2FA}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !setting2FA) {
                      handleReauthenticate();
                    }
                  }}
                />
                
                {error2FA && (
                  <div className="error-message twofa">
                    <i className="fas fa-exclamation-circle"></i>
                    {error2FA}
                  </div>
                )}
                
                <div className="twofa-actions">
                  <button 
                    className="btn-secondary"
                    onClick={() => {
                      setShowReauthModal(false);
                      setReauthPassword('');
                      setError2FA('');
                    }}
                    disabled={setting2FA}
                  >
                    Cancelar
                  </button>
                  <button 
                    className="btn-primary"
                    onClick={handleReauthenticate}
                    disabled={setting2FA || !reauthPassword}
                  >
                    {setting2FA ? (
                      <>
                        <i className="fas fa-spinner fa-spin"></i>
                        Verificando...
                      </>
                    ) : (
                      'Confirmar'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2FA Setup Modal */}
      {show2FAModal && (
        <div className="modal-overlay" onClick={handleClose2FAModal}>
          <div className="twofa-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header twofa">
              <h3>
                <i className="fas fa-shield-alt"></i>
                {is2FAEnabled ? 'Gestionar 2FA' : 'Configurar Autenticación de Dos Factores'}
              </h3>
              <button 
                className="modal-close-btn"
                onClick={handleClose2FAModal}
                title="Cerrar"
              >
                ×
              </button>
            </div>
            
            <div className="modal-body">
              {/* reCAPTCHA container */}
              <div id="recaptcha-container"></div>
              
              {is2FAEnabled ? (
                <div className="twofa-status">
                  <div className="status-active">
                    <i className="fas fa-check-circle"></i>
                    <h4>2FA Activado</h4>
                    <p>Tu cuenta está protegida con autenticación de dos factores.</p>
                  </div>
                  
                  <div className="twofa-warning">
                    <p>Si desactivas 2FA, tu cuenta será menos segura. Solo necesitarás tu contraseña para iniciar sesión.</p>
                  </div>
                  
                  <button 
                    className="btn-danger"
                    onClick={handleDisable2FA}
                    disabled={setting2FA}
                  >
                    {setting2FA ? (
                      <>
                        <i className="fas fa-spinner fa-spin"></i>
                        Desactivando...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-shield-slash"></i>
                        Desactivar 2FA
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <>
                  {step2FA === 'phone' && (
                    <div className="twofa-setup">
                      <div className="setup-intro">
                        <i className="fas fa-mobile-alt" style={{ fontSize: '3rem', color: '#10b981', marginBottom: '1rem' }}></i>
                        <h4>Protege tu cuenta con 2FA</h4>
                        <p>La autenticación de dos factores añade una capa adicional de seguridad.</p>
                        <p>Te enviaremos un código SMS cada vez que inicies sesión.</p>
                      </div>
                      
                      <div className="form-group">
                        <label>Número de teléfono</label>
                        <input
                          type="tel"
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          placeholder="+52 55 1234 5678"
                          className={error2FA ? 'error' : ''}
                        />
                        <small>Incluye el código de país (ej: +52 para México, +1 para USA)</small>
                      </div>
                      
                      {error2FA && (
                        <div className="twofa-error">
                          <i className="fas fa-exclamation-circle"></i>
                          {error2FA}
                        </div>
                      )}
                      
                      <button 
                        className="btn-primary"
                        onClick={handleSendVerificationCode}
                        disabled={setting2FA || !phoneNumber}
                      >
                        {setting2FA ? (
                          <>
                            <i className="fas fa-spinner fa-spin"></i>
                            Enviando SMS...
                          </>
                        ) : (
                          <>
                            <i className="fas fa-sms"></i>
                            Enviar código SMS
                          </>
                        )}
                      </button>
                    </div>
                  )}
                  
                  {step2FA === 'verify' && (
                    <div className="twofa-verify">
                      <div className="verify-intro">
                        <i className="fas fa-comment-dots" style={{ fontSize: '2.5rem', color: '#10b981', marginBottom: '1rem' }}></i>
                        <h4>Verifica tu número</h4>
                        <p>Hemos enviado un código SMS a:</p>
                        <p className="phone-display-verify">{phoneNumber}</p>
                      </div>
                      
                      <div className="form-group">
                        <label>Código de verificación</label>
                        <input
                          type="text"
                          value={verificationCode}
                          onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                          placeholder="123456"
                          maxLength={6}
                          className={`verification-input ${error2FA ? 'error' : ''}`}
                        />
                      </div>
                      
                      {error2FA && (
                        <div className="twofa-error">
                          <i className="fas fa-exclamation-circle"></i>
                          {error2FA}
                        </div>
                      )}
                      
                      <div className="verify-actions">
                        <button 
                          className="btn-secondary"
                          onClick={() => {
                            setStep2FA('phone');
                            setVerificationCode('');
                            setError2FA('');
                          }}
                        >
                          Cambiar número
                        </button>
                        <button 
                          className="btn-primary"
                          onClick={handleVerifyAndEnroll}
                          disabled={setting2FA || verificationCode.length !== 6}
                        >
                          {setting2FA ? (
                            <>
                              <i className="fas fa-spinner fa-spin"></i>
                              Verificando...
                            </>
                          ) : (
                            <>
                              <i className="fas fa-check"></i>
                              Verificar y activar
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {step2FA === 'success' && (
                    <div className="twofa-success">
                      <i className="fas fa-check-circle"></i>
                      <h4>¡2FA Activado con éxito!</h4>
                      <p>Tu cuenta ahora está protegida con autenticación de dos factores.</p>
                      <p>A partir de ahora, necesitarás tu teléfono para iniciar sesión.</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Avatar Selection Modal */}
      {showAvatarModal && (
        <div className="modal-overlay" onClick={() => setShowAvatarModal(false)}>
          <div className="avatar-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                <i className="fas fa-user-circle"></i>
                Seleccionar Avatar
              </h3>
              <button 
                className="close-btn" 
                onClick={() => setShowAvatarModal(false)}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            
            <div className="modal-body">
              <div className="avatar-grid">
                {/* Avatares predefinidos */}
                {[
                  '🧑‍🎓', '👨‍🏫', '👩‍🏫', '🧑‍💻', '👨‍💻', '👩‍💻',
                  '🧑‍🔬', '👨‍🔬', '👩‍🔬', '🧑‍🚀', '👨‍🚀', '👩‍🚀',
                  '🦸', '🦸‍♂️', '🦸‍♀️', '🧙', '🧙‍♂️', '🧙‍♀️',
                  '🐵', '🐶', '🐱', '🐭', '🐹', '🐰',
                  '🦊', '🐻', '🐼', '🐨', '🐯', '🦁'
                ].map((emoji, index) => (
                  <button
                    key={index}
                    className={`avatar-option ${selectedAvatar === emoji ? 'selected' : ''}`}
                    onClick={() => setSelectedAvatar(emoji)}
                    style={{ fontSize: '2.5rem' }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              
              <div className="avatar-actions">
                <button 
                  className="btn-secondary"
                  onClick={() => {
                    setShowAvatarModal(false);
                    setSelectedAvatar('');
                  }}
                >
                  Cancelar
                </button>
                <button 
                  className="btn-primary"
                  onClick={async () => {
                    if (selectedAvatar && user) {
                      setUploadingAvatar(true);
                      try {
                        // Actualizar el avatar en Firestore
                        await updateDoc(doc(db, 'users', user.uid), {
                          photoURL: selectedAvatar,
                          updatedAt: new Date()
                        });
                        
                        // Actualizar el estado local
                        setEditedProfile(prev => ({ ...prev, photoURL: selectedAvatar }));
                        setShowAvatarModal(false);
                        setSelectedAvatar('');
                        
                        // Recargar el perfil para mostrar el cambio
                        window.location.reload();
                      } catch (error) {
                        console.error('Error updating avatar:', error);
                        alert('Error al actualizar el avatar. Por favor intenta de nuevo.');
                      } finally {
                        setUploadingAvatar(false);
                      }
                    }
                  }}
                  disabled={!selectedAvatar || uploadingAvatar}
                >
                  {uploadingAvatar ? (
                    <>
                      <i className="fas fa-spinner fa-spin"></i>
                      Guardando...
                    </>
                  ) : (
                    'Guardar'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;