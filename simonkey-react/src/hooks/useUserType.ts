import { useState, useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../services/firebase';
import { 
  getUserProfile, 
  getSubscriptionLimits, 
  canCreateNotebook, 
  canAddConcepts
} from '../services/userService';
import { UserProfile, SubscriptionLimits, UserSubscriptionType, SchoolRole } from '../types/interfaces';

export const useUserType = () => {
  const [user, loading, error] = useAuthState(auth);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [subscriptionLimits, setSubscriptionLimits] = useState<SubscriptionLimits | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (user) {
        try {
          setLoadingProfile(true);
          const profile = await getUserProfile(user.uid);
          setUserProfile(profile);
          
          if (profile) {
            const limits = getSubscriptionLimits(profile.subscription);
            setSubscriptionLimits(limits);
          }
        } catch (error) {
          console.error('Error fetching user profile:', error);
        } finally {
          setLoadingProfile(false);
        }
      } else {
        setUserProfile(null);
        setSubscriptionLimits(null);
        setLoadingProfile(false);
      }
    };

    fetchUserProfile();
  }, [user]);

  const checkCanCreateNotebook = async () => {
    if (!user) return { canCreate: false, reason: 'Usuario no autenticado' };
    return await canCreateNotebook(user.uid);
  };

  const checkCanAddConcepts = async (notebookId: string, currentConceptCount: number) => {
    if (!user) return { canAdd: false, reason: 'Usuario no autenticado' };
    return await canAddConcepts(user.uid, notebookId, currentConceptCount);
  };

  const isSuperAdmin = userProfile?.subscription === UserSubscriptionType.SUPER_ADMIN;
  const isFreeUser = userProfile?.subscription === UserSubscriptionType.FREE;
  const isProUser = userProfile?.subscription === UserSubscriptionType.PRO;
  const isSchoolUser = userProfile?.subscription === UserSubscriptionType.SCHOOL;

  // Debug logs
  console.log('useUserType - user:', user?.email);
  console.log('useUserType - userProfile:', userProfile);
  console.log('useUserType - isSuperAdmin:', isSuperAdmin);
  console.log('useUserType - subscription:', userProfile?.subscription);

  const isSchoolAdmin = isSchoolUser && userProfile?.schoolRole === SchoolRole.ADMIN;
  const isSchoolTeacher = isSchoolUser && userProfile?.schoolRole === SchoolRole.TEACHER;
  const isSchoolStudent = isSchoolUser && userProfile?.schoolRole === SchoolRole.STUDENT;

  return {
    user,
    userProfile,
    subscriptionLimits,
    loading: loading || loadingProfile,
    error,
    checkCanCreateNotebook,
    checkCanAddConcepts,
    isSuperAdmin,
    isFreeUser,
    isProUser,
    isSchoolUser,
    isSchoolAdmin,
    isSchoolTeacher,
    isSchoolStudent,
    // Información de límites
    maxNotebooks: subscriptionLimits?.maxNotebooks,
    maxConceptsPerNotebook: subscriptionLimits?.maxConceptsPerNotebook,
    maxNotebooksPerWeek: subscriptionLimits?.maxNotebooksPerWeek,
    maxConceptsPerWeek: subscriptionLimits?.maxConceptsPerWeek,
    canDeleteAndRecreate: subscriptionLimits?.canDeleteAndRecreate,
    // Permisos
    canViewAllData: subscriptionLimits?.permissions.canViewAllData,
    canEditAllData: subscriptionLimits?.permissions.canEditAllData,
    canUseStudySection: subscriptionLimits?.permissions.canUseStudySection,
    canManageUsers: subscriptionLimits?.permissions.canManageUsers,
  };
}; 