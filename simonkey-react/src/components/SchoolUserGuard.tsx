import React, { useEffect } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useUserType } from '../hooks/useUserType';

interface SchoolUserGuardProps {
  children: React.ReactNode;
}

const SchoolUserGuard: React.FC<SchoolUserGuardProps> = ({ children }) => {
  const { isSchoolTeacher, isSchoolStudent, isSchoolUser, userProfile, loading } = useUserType();
  const location = useLocation();
  const navigate = useNavigate();

  // Detectar usuarios escolares sin rol definido
  const isSchoolUserWithoutRole = isSchoolUser && userProfile && !userProfile.schoolRole;

  useEffect(() => {
    if (!loading) {
      console.log('🔍 SchoolUserGuard - Verificando permisos:');
      console.log('   - isSchoolUser:', isSchoolUser);
      console.log('   - isSchoolTeacher:', isSchoolTeacher);
      console.log('   - isSchoolStudent:', isSchoolStudent);
      console.log('   - isSchoolUserWithoutRole:', isSchoolUserWithoutRole);
      console.log('   - userProfile.schoolRole:', userProfile?.schoolRole);
      console.log('   - location.pathname:', location.pathname);

      // CASO 1: Usuario escolar sin rol definido - BLOQUEAR ACCESO
      if (isSchoolUserWithoutRole) {
        console.log('🚫 Usuario escolar sin rol definido - acceso bloqueado');
        return; // No redirigir, mostrar error
      }

      // CASO 2: Profesor escolar - Solo /school/teacher
      if (isSchoolTeacher) {
        if (location.pathname !== '/school/teacher') {
          console.log('🏫 Redirigiendo profesor escolar a su módulo');
          navigate('/school/teacher', { replace: true });
        }
      }
      
      // CASO 3: Estudiante escolar - Solo /school/student
      if (isSchoolStudent) {
        if (location.pathname !== '/school/student') {
          console.log('🎓 Redirigiendo estudiante escolar a su módulo');
          navigate('/school/student', { replace: true });
        }
      }
    }
  }, [isSchoolTeacher, isSchoolStudent, isSchoolUserWithoutRole, location.pathname, navigate, loading, isSchoolUser, userProfile]);

  // Mientras se carga, mostrar loading
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#f8f9fa'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '3px solid #e3e3e3',
            borderTop: '3px solid #667eea',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }}></div>
          <p style={{ 
            color: '#636e72',
            margin: 0,
            fontSize: '14px'
          }}>
            Verificando permisos...
          </p>
        </div>
      </div>
    );
  }

  // CASO ESPECIAL: Usuario escolar sin rol definido
  if (isSchoolUserWithoutRole) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#f8f9fa',
        padding: '20px',
        textAlign: 'center'
      }}>
        <div style={{
          backgroundColor: '#fff',
          padding: '40px',
          borderRadius: '12px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          maxWidth: '500px'
        }}>
          <div style={{
            fontSize: '48px',
            marginBottom: '16px'
          }}>🚫</div>
          <h2 style={{
            color: '#d63031',
            marginBottom: '16px',
            fontSize: '24px'
          }}>
            Acceso Restringido
          </h2>
          <p style={{
            color: '#636e72',
            marginBottom: '24px',
            lineHeight: '1.5'
          }}>
            Tu cuenta escolar no tiene un rol asignado. Contacta a tu administrador 
            para que te asigne el rol apropiado (Profesor o Estudiante).
          </p>
          <div style={{
            backgroundColor: '#f1f2f6',
            padding: '12px',
            borderRadius: '8px',
            fontSize: '14px',
            color: '#636e72'
          }}>
            <strong>Email:</strong> {userProfile?.email}<br/>
            <strong>Tipo de cuenta:</strong> Escolar<br/>
            <strong>Estado:</strong> Sin rol asignado
          </div>
        </div>
      </div>
    );
  }

  // Si es usuario escolar y no está en su ruta correcta, no renderizar nada
  // (la redirección se maneja en el useEffect)
  if (isSchoolTeacher && location.pathname !== '/school/teacher') {
    return null;
  }
  
  if (isSchoolStudent && location.pathname !== '/school/student') {
    return null;
  }

  // Si no es usuario escolar, o está en la ruta correcta, mostrar el contenido
  return <>{children}</>;
};

export default SchoolUserGuard; 