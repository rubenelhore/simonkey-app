import React from 'react';
import { UserSubscriptionType, SchoolRole } from '../types/interfaces';

interface UserTypeBadgeProps {
  subscription: UserSubscriptionType;
  schoolRole?: SchoolRole;
  className?: string;
}

export const UserTypeBadge: React.FC<UserTypeBadgeProps> = ({ 
  subscription, 
  schoolRole, 
  className = '' 
}) => {
  const getBadgeInfo = () => {
    switch (subscription) {
      case UserSubscriptionType.SUPER_ADMIN:
        return {
          text: 'Súper Admin',
          color: 'bg-red-500 text-white',
          icon: '👑'
        };
      case UserSubscriptionType.FREE:
        return {
          text: 'Gratis',
          color: 'bg-gray-500 text-white',
          icon: '🆓'
        };
      case UserSubscriptionType.PRO:
        return {
          text: 'Pro',
          color: 'bg-purple-500 text-white',
          icon: '⭐'
        };
      case UserSubscriptionType.SCHOOL:
        const roleText = schoolRole === SchoolRole.ADMIN ? 'Administrador' :
                        schoolRole === SchoolRole.TEACHER ? 'Profesor' :
                        schoolRole === SchoolRole.STUDENT ? 'Alumno' :
                        schoolRole === SchoolRole.TUTOR ? 'Tutor' : 'Escolar';
        return {
          text: `Escolar - ${roleText}`,
          color: 'bg-blue-500 text-white',
          icon: '🏫'
        };
      default:
        return {
          text: 'Desconocido',
          color: 'bg-gray-300 text-gray-700',
          icon: '❓'
        };
    }
  };

  const badgeInfo = getBadgeInfo();

  return (
    <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${badgeInfo.color} ${className}`}>
      <span className="mr-1">{badgeInfo.icon}</span>
      {badgeInfo.text}
    </div>
  );
};

export default UserTypeBadge; 