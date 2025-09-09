import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useUserType } from '../hooks/useUserType';
import { updatePassword, signOut } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import '../styles/ChangePasswordRequired.css';

const ChangePasswordRequired: React.FC = () => {
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();
  const { isSchoolAdmin, isSchoolTeacher, isSchoolStudent } = useUserType();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const validatePassword = () => {
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return false;
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return false;
    }
    if (password.toLowerCase() === 'school123') {
      setError('Por favor elige una contraseña diferente a la predeterminada');
      return false;
    }
    return true;
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validatePassword()) {
      return;
    }

    setLoading(true);
    try {
      if (!user) throw new Error('No hay usuario autenticado');

      // Cambiar contraseña en Firebase Auth
      await updatePassword(user, password);
      console.log('✅ Contraseña actualizada en Firebase Auth');

      // Actualizar el perfil del usuario para quitar los flags
      const userId = userProfile?.id || user.uid;
      const updateData: any = {
        requiresPasswordChange: false,
        passwordLastChanged: new Date().toISOString()
      };
      
      // Si fue creado via bulk upload, marcar como que ya cambió la contraseña
      if (userProfile?.createdViaUpload) {
        updateData.createdViaUpload = false; // Ya no necesita cambiar contraseña
        updateData.hasChangedInitialPassword = true;
      }
      
      await updateDoc(doc(db, 'users', userId), updateData);
      console.log('✅ Flags de contraseña actualizados');

      // Mostrar mensaje de éxito
      alert('¡Contraseña cambiada exitosamente! Por favor inicia sesión nuevamente.');

      // Cerrar sesión para que el usuario inicie con su nueva contraseña
      await signOut(auth);
      navigate('/login');
    } catch (error: any) {
      console.error('Error cambiando contraseña:', error);
      if (error.code === 'auth/requires-recent-login') {
        setError('Por seguridad, debes cerrar sesión e iniciar nuevamente antes de cambiar tu contraseña');
        setTimeout(async () => {
          await signOut(auth);
          navigate('/login');
        }, 3000);
      } else {
        setError('Error al cambiar la contraseña. Por favor intenta nuevamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  return (
    <div className="change-password-required-container">
      <div className="change-password-card">
        <div className="card-header">
          <h1>🔒 {userProfile?.createdViaUpload ? 'Configura tu Contraseña' : 'Cambio de Contraseña Obligatorio'}</h1>
          <p className="subtitle">
            {userProfile?.createdViaUpload 
              ? 'Tu cuenta fue creada por un administrador. Por favor, configura una contraseña personal para continuar.'
              : 'Por tu seguridad, debes cambiar la contraseña predeterminada antes de continuar'
            }
          </p>
        </div>

        <div className="user-info">
          <p><strong>Usuario:</strong> {userProfile?.email}</p>
          <p><strong>Rol:</strong> {
            isSchoolAdmin ? 'Administrador Escolar' :
            isSchoolTeacher ? 'Profesor' :
            isSchoolStudent ? 'Estudiante' : 'Usuario'
          }</p>
        </div>

        <form onSubmit={handleChangePassword} className="password-form">
          <div className="form-group">
            <label htmlFor="password">Nueva Contraseña</label>
            <div className="password-input-wrapper">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                required
                disabled={loading}
              />
              <button
                type="button"
                className="toggle-password"
                onClick={() => setShowPassword(!showPassword)}
              >
                <i className={`fas fa-eye${showPassword ? '-slash' : ''}`}></i>
              </button>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirmar Contraseña</label>
            <input
              type={showPassword ? 'text' : 'password'}
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repite la contraseña"
              required
              disabled={loading}
            />
          </div>

          {error && (
            <div className="error-message">
              <i className="fas fa-exclamation-circle"></i>
              {error}
            </div>
          )}

          <div className="password-requirements">
            <h4>Requisitos de la contraseña:</h4>
            <ul>
              <li className={password.length >= 6 ? 'valid' : ''}>
                <i className={`fas fa-${password.length >= 6 ? 'check' : 'times'}-circle`}></i>
                Al menos 6 caracteres
              </li>
              <li className={password === confirmPassword && password !== '' ? 'valid' : ''}>
                <i className={`fas fa-${password === confirmPassword && password !== '' ? 'check' : 'times'}-circle`}></i>
                Las contraseñas coinciden
              </li>
              <li className={password.toLowerCase() !== 'school123' || password === '' ? 'valid' : ''}>
                <i className={`fas fa-${password.toLowerCase() !== 'school123' || password === '' ? 'check' : 'times'}-circle`}></i>
                Diferente a la contraseña predeterminada
              </li>
            </ul>
          </div>

          <div className="form-actions">
            <button
              type="submit"
              className="btn-primary"
              disabled={loading || !password || !confirmPassword}
            >
              {loading ? (
                <>
                  <i className="fas fa-spinner fa-spin"></i>
                  Cambiando contraseña...
                </>
              ) : (
                <>
                  <i className="fas fa-lock"></i>
                  Cambiar Contraseña
                </>
              )}
            </button>

            <button
              type="button"
              className="btn-secondary"
              onClick={handleLogout}
              disabled={loading}
            >
              <i className="fas fa-sign-out-alt"></i>
              Cerrar Sesión
            </button>
          </div>
        </form>

        <div className="security-note">
          <i className="fas fa-shield-alt"></i>
          <p>
            <strong>Nota de seguridad:</strong> Usa una contraseña única y segura. 
            No compartas tu contraseña con nadie.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ChangePasswordRequired;