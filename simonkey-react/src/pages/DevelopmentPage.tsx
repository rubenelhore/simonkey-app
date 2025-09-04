// src/pages/DevelopmentPage.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useUserType } from '../hooks/useUserType';
import { UserSubscriptionType } from '../types/interfaces';
import HeaderWithHamburger from '../components/HeaderWithHamburger';
import '../styles/DevelopmentPage.css';

// Componentes experimentales importados aquí en el futuro
// import FunStudyDemo from '../components/Development/FunStudyDemo';
// import VoiceRecognitionDemo from '../components/Development/VoiceRecognitionDemo';

interface ExperimentalModule {
  id: string;
  title: string;
  description: string;
  status: 'planning' | 'development' | 'testing' | 'ready';
  component?: React.ComponentType;
  route?: string;
  icon: string;
}

const DevelopmentPage: React.FC = () => {
  const { user, userProfile } = useAuth();
  const { isSuperAdmin, subscription } = useUserType();
  const navigate = useNavigate();
  const [selectedModule, setSelectedModule] = useState<string | null>(null);

  // Lista de módulos experimentales
  const experimentalModules: ExperimentalModule[] = [
    {
      id: 'fun-study',
      title: 'Estudio Divertido',
      description: 'Sistema de estudio con reconocimiento de voz, fill-in-the-blank, y gamificación',
      status: 'planning',
      icon: '🎮',
      route: '/development/fun-study'
    },
    {
      id: 'voice-recognition',
      title: 'Reconocimiento de Voz',
      description: 'Pruebas de Web Speech API para respuestas por voz',
      status: 'planning',
      icon: '🎤'
    },
    {
      id: 'fill-blank',
      title: 'Fill in the Blank',
      description: 'Generación automática de ejercicios de rellenar espacios',
      status: 'planning',
      icon: '📝'
    },
    {
      id: 'ai-feedback',
      title: 'Feedback con IA',
      description: 'Evaluación inteligente de respuestas usando OpenAI',
      status: 'planning',
      icon: '🤖'
    },
    {
      id: 'study-games',
      title: 'Juegos de Estudio',
      description: 'Mini-juegos educativos: memory, quiz battle, speed mode',
      status: 'planning',
      icon: '🎯'
    }
  ];

  // Verificar si el usuario tiene acceso a development
  const hasAccess = user && (
    // Developers principales
    user.email === 'rubenelhore@gmail.com' ||
    user.email === 'ruben@simonkey.ai' ||
    // Super administradores
    isSuperAdmin ||
    // Usuarios PRO
    subscription === UserSubscriptionType.PRO
  );

  if (!hasAccess) {
    return (
      <div className="development-container">
        <HeaderWithHamburger title="Acceso Denegado" />
        <div className="access-denied">
          <div className="access-denied-icon">🚫</div>
          <h2>Área de Desarrollo</h2>
          <p>Esta sección está reservada para desarrolladores, super administradores y usuarios PRO.</p>
          <button onClick={() => navigate('/materias')} className="btn-back">
            Volver a Materias
          </button>
        </div>
      </div>
    );
  }

  const getStatusColor = (status: ExperimentalModule['status']) => {
    switch (status) {
      case 'planning': return '#FF9500';
      case 'development': return '#007AFF';
      case 'testing': return '#FF3B30';
      case 'ready': return '#34C759';
      default: return '#8E8E93';
    }
  };

  const getStatusText = (status: ExperimentalModule['status']) => {
    switch (status) {
      case 'planning': return 'Planeando';
      case 'development': return 'Desarrollo';
      case 'testing': return 'Testing';
      case 'ready': return 'Listo';
      default: return 'Desconocido';
    }
  };

  const handleModuleClick = (module: ExperimentalModule) => {
    if (module.route) {
      navigate(module.route);
    } else if (module.component) {
      setSelectedModule(module.id);
    } else {
      alert(`${module.title} está en fase de ${getStatusText(module.status).toLowerCase()}`);
    }
  };

  return (
    <div className="development-container">
      <HeaderWithHamburger title="🧪 Área de Desarrollo" />
      
      <div className="development-content">
        <div className="development-header">
          <div className="dev-badge">EXPERIMENTAL</div>
          <h1>Playground de Desarrollo</h1>
          <p className="dev-subtitle">
            Área para probar nuevas funcionalidades antes de lanzarlas a producción
          </p>
          
          <div className="dev-info">
            <div className="dev-info-item">
              <span className="dev-info-label">Usuario:</span>
              <span className="dev-info-value">{user?.email}</span>
            </div>
            <div className="dev-info-item">
              <span className="dev-info-label">Rol:</span>
              <span className="dev-info-value">
                {user?.email?.includes('ruben') 
                  ? 'Developer' 
                  : isSuperAdmin 
                    ? 'Super Admin' 
                    : subscription === UserSubscriptionType.PRO 
                      ? 'PRO User' 
                      : 'Beta Tester'}
              </span>
            </div>
          </div>
        </div>

        <div className="modules-section">
          <h2>Módulos Experimentales</h2>
          
          <div className="modules-grid">
            {experimentalModules.map((module) => (
              <div 
                key={module.id} 
                className={`module-card ${module.status}`}
                onClick={() => handleModuleClick(module)}
              >
                <div className="module-header">
                  <span className="module-icon">{module.icon}</span>
                  <div className="module-status">
                    <span 
                      className="status-indicator"
                      style={{ backgroundColor: getStatusColor(module.status) }}
                    ></span>
                    <span className="status-text">{getStatusText(module.status)}</span>
                  </div>
                </div>
                
                <div className="module-content">
                  <h3 className="module-title">{module.title}</h3>
                  <p className="module-description">{module.description}</p>
                </div>
                
                <div className="module-actions">
                  {module.route ? (
                    <button className="btn-test">Probar</button>
                  ) : module.component ? (
                    <button className="btn-demo">Demo</button>
                  ) : (
                    <button className="btn-soon" disabled>Próximamente</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="dev-tools-section">
          <h2>Herramientas de Desarrollo</h2>
          
          <div className="dev-tools-grid">
            <div className="tool-card">
              <span className="tool-icon">🔧</span>
              <h3>Feature Flags</h3>
              <p>Activar/desactivar funcionalidades en desarrollo</p>
              <button className="btn-tool" disabled>Próximamente</button>
            </div>
            
            <div className="tool-card">
              <span className="tool-icon">📊</span>
              <h3>Analytics de Prueba</h3>
              <p>Métricas de uso de funcionalidades experimentales</p>
              <button className="btn-tool" disabled>Próximamente</button>
            </div>
            
            <div className="tool-card">
              <span className="tool-icon">🐛</span>
              <h3>Debug Console</h3>
              <p>Consola de debug para testing en vivo</p>
              <button className="btn-tool" disabled>Próximamente</button>
            </div>
          </div>
        </div>

        <div className="feedback-section">
          <h2>📝 Feedback</h2>
          <p>¿Tienes ideas o encontraste bugs? Envíanos feedback sobre las funcionalidades experimentales.</p>
          <button 
            className="btn-feedback"
            onClick={() => window.open('mailto:ruben@simonkey.ai?subject=Feedback%20Development%20Area', '_blank')}
          >
            Enviar Feedback
          </button>
        </div>
      </div>
    </div>
  );
};

export default DevelopmentPage;