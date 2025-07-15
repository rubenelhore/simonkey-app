// src/components/Onboarding/Onboarding.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../services/firebase';
import './OnboardingComponent.css';

// Componentes para cada paso
import WelcomeStep from './Steps/WelcomeStep';
import NotebooksStep from './Steps/NotebooksStep';
import ConceptsStep from './Steps/ConceptsStep';
import StudyToolsStep from './Steps/StudyToolsStep';

interface OnboardingProps {
  onComplete: () => void;  // Descomenta esta línea o añádela si no existe
}

const Onboarding: React.FC<OnboardingProps> = (props) => {
  console.log('🎬 OnboardingComponent - Renderizando, props:', props);
  const [currentStep, setCurrentStep] = useState(0);
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasNavigated, setHasNavigated] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Simplificar: No verificar el estado del onboarding aquí
    // ya que eso se maneja en App.tsx
    console.log('🎬 OnboardingComponent montado');
    setIsLoading(false);
  }, []);

  const handleNext = () => {
    if (currentStep < 3) {
      setCurrentStep(prev => prev + 1);
    } else {
      completeOnboarding();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSkip = () => {
    completeOnboarding();
  };

  const completeOnboarding = async () => {
    try {
      if (auth.currentUser) {
        const userDocRef = doc(db, 'users', auth.currentUser.uid);
        await setDoc(userDocRef, { hasCompletedOnboarding: true }, { merge: true });
      }
      // Llamar a la función onComplete que viene como prop
      props.onComplete();
      // Redirigir a la página de notebooks
      navigate('/notebooks');
    } catch (error) {
      console.error("Error al completar onboarding:", error);
    }
  };

  // Si está cargando o el usuario ya ha visto el onboarding, no mostrar nada
  if (isLoading) {
    console.log('🎬 OnboardingComponent - Mostrando loading');
    return (
      <div className="onboarding-loading">
        <div className="loading-spinner"></div>
        <p>Cargando...</p>
      </div>
    );
  }
  
  // Remover la verificación de hasSeenOnboarding ya que se maneja en App.tsx

  // Componentes para cada paso con props para navegación
  const steps = [
    <WelcomeStep onNext={handleNext} />,
    <NotebooksStep onNext={handleNext} onPrev={handlePrev} />,
    <ConceptsStep onNext={handleNext} onPrev={handlePrev} />,
    <StudyToolsStep onFinish={handleNext} onPrev={handlePrev} />
  ];

  // Indicador de progreso
  const ProgressIndicator = () => (
    <div className="step-indicator">
      {[0, 1, 2, 3].map((step) => (
        <div 
          key={step} 
          className={`step-dot ${currentStep === step ? 'active' : ''} ${currentStep > step ? 'completed' : ''}`}
        />
      ))}
    </div>
  );

  return (
    <div className="onboarding-container">
      <div className="onboarding-content">
        <ProgressIndicator />
        
        <div className="step-content">
          {steps[currentStep]}
        </div>
        
        <div className="onboarding-actions">
          {currentStep > 0 && (
            <button onClick={handlePrev} className="back-button">
              <i className="fas fa-arrow-left"></i> Atrás
            </button>
          )}
          
          <div className="right-actions">
            <button onClick={handleSkip} className="skip-button">
              Saltar
            </button>
            
            <button onClick={handleNext} className="next-button">
              {currentStep === 3 ? 'Comenzar' : 'Siguiente'} 
              {currentStep < 3 && <i className="fas fa-arrow-right"></i>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;