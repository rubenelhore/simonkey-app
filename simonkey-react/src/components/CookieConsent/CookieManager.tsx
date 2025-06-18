import React, { useState } from 'react';
import CookieConsentBanner from './CookieConsentBanner';
import CookiePreferencesModal from './CookiePreferencesModal';

const CookieManager: React.FC = () => {
  const [isPreferencesModalOpen, setIsPreferencesModalOpen] = useState(false);

  const handleOpenPreferences = () => {
    setIsPreferencesModalOpen(true);
  };

  const handleClosePreferences = () => {
    setIsPreferencesModalOpen(false);
  };

  return (
    <>
      <CookieConsentBanner onOpenPreferences={handleOpenPreferences} />
      <CookiePreferencesModal 
        isOpen={isPreferencesModalOpen} 
        onClose={handleClosePreferences} 
      />
    </>
  );
};

export default CookieManager;