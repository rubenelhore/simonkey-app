import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useUserType } from '../hooks/useUserType';
import { auth } from '../services/firebase';

// Import components
import HomePage from './HomePage';
import LoginPage from '../pages/LoginPage';
import SignupPage from '../pages/SignupPage';
import EmailVerificationPage from '../pages/EmailVerificationPage';
import Notebooks from '../pages/Notebooks';
import NotebookDetail from '../pages/NotebookDetail';
import ConceptDetail from '../pages/ConceptDetail';
import ExplainConceptPage from '../pages/ExplainConceptPage';
import SharedNotebook from '../pages/SharedNotebook';
import VoiceSettingsPage from '../pages/VoiceSettingsPage';
import SuperAdminPage from '../pages/SuperAdminPage';
import StudyModePage from '../pages/StudyModePage';
import QuizModePage from '../pages/QuizModePage';
import ProgressPage from '../pages/ProgressPage';
import ProfilePage from '../pages/ProfilePage';
import Pricing from '../pages/Pricing';
import SchoolTeacherNotebooksPage from '../pages/SchoolTeacherNotebooksPage';
import SchoolStudentStudyPage from '../pages/SchoolStudentStudyPage';
import PrivacyPolicyPage from '../pages/PrivacyPolicyPage';
import TermsPage from '../pages/TermsPage';

// Import guards
import EmailVerificationGuard from './EmailVerificationGuard';
import SchoolUserGuard from './SchoolUserGuard';

interface AppRoutesProps {
  hasCompletedOnboarding: boolean;
  setHasCompletedOnboarding: (value: boolean) => void;
}

const AppRoutes: React.FC<AppRoutesProps> = ({ 
  hasCompletedOnboarding, 
  setHasCompletedOnboarding 
}) => {
  const { isAuthenticated, isEmailVerified } = useAuth();
  const { isSchoolTeacher, isSchoolStudent, isSuperAdmin } = useUserType();

  // Helper function to wrap protected routes
  const protectedRoute = (component: React.ReactNode, requiresSchoolGuard = true) => {
    if (!isAuthenticated) {
      return <Navigate to="/login" replace />;
    }

    return (
      <EmailVerificationGuard>
        {isSuperAdmin ? (
          component
        ) : requiresSchoolGuard ? (
          <SchoolUserGuard>{component}</SchoolUserGuard>
        ) : (
          component
        )}
      </EmailVerificationGuard>
    );
  };

  // Helper function to handle onboarding
  const withOnboarding = (component: React.ReactNode) => {
    if (!hasCompletedOnboarding) {
      const OnboardingComponent = React.lazy(() => import('./Onboarding/OnboardingComponent'));
      return (
        <React.Suspense fallback={<div>Cargando...</div>}>
          <OnboardingComponent 
            onComplete={() => {
              setHasCompletedOnboarding(true);
              localStorage.setItem('hasCompletedOnboarding', 'true');
            }} 
          />
        </React.Suspense>
      );
    }
    return component;
  };

  return (
    <Routes>
      {/* Public routes */}
      <Route 
        path="/" 
        element={(() => {
          if (isAuthenticated && isEmailVerified) {
            if (isSchoolTeacher) return <Navigate to="/school/teacher" replace />;
            if (isSchoolStudent) return <Navigate to="/school/student" replace />;
            return <Navigate to="/notebooks" replace />;
          }
          return <HomePage />;
        })()} 
      />
      
      <Route path="/pricing" element={<Pricing />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/verify-email" element={<EmailVerificationPage />} />
      <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
      <Route path="/terms" element={<TermsPage />} />
      
      {/* Shared routes */}
      <Route path="/shared/:shareId" element={<SharedNotebook />} />
      
      {/* Protected routes */}
      <Route
        path="/notebooks"
        element={protectedRoute(withOnboarding(<Notebooks />))}
      />
      
      <Route
        path="/notebooks/:id"
        element={protectedRoute(<NotebookDetail />)}
      />
      
      <Route
        path="/notebooks/:notebookId/concepto/:conceptoId/:index"
        element={protectedRoute(<ConceptDetail />)}
      />
      
      <Route
        path="/tools/explain/:type/:notebookId"
        element={protectedRoute(<ExplainConceptPage />)}
      />
      
      <Route
        path="/settings/voice"
        element={protectedRoute(<VoiceSettingsPage />)}
      />
      
      <Route
        path="/study"
        element={protectedRoute(<StudyModePage />)}
      />
      
      <Route
        path="/progress"
        element={protectedRoute(<ProgressPage />)}
      />
      
      <Route
        path="/profile"
        element={protectedRoute(<ProfilePage />)}
      />
      
      <Route
        path="/quiz"
        element={protectedRoute(<QuizModePage />)}
      />
      
      {/* School system routes */}
      <Route
        path="/school/teacher"
        element={protectedRoute(<SchoolTeacherNotebooksPage />)}
      />
      
      <Route
        path="/school/student"
        element={protectedRoute(<SchoolStudentStudyPage />)}
      />
      
      {/* Super admin route */}
      <Route
        path="/super-admin"
        element={(() => {
          if (isAuthenticated) {
            const userEmail = auth.currentUser?.email;
            const isSuperAdmin = userEmail === 'ruben.elhore@gmail.com';
            
            if (isSuperAdmin) {
              return <SuperAdminPage />;
            } else {
              if (userEmail?.includes('@school.simonkey.com') || userEmail?.includes('@up.edu.mx')) {
                return <Navigate to="/school/teacher" replace />;
              } else {
                return <Navigate to="/notebooks" replace />;
              }
            }
          } else {
            return <Navigate to="/login" replace />;
          }
        })()}
      />
    </Routes>
  );
};

export default AppRoutes;