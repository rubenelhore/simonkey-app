import React, { useState } from 'react';
import './HelpWhatsAppButton.css';

const whatsappNumber = '+525580125707'; // Número actualizado de soporte
const whatsappLink = `https://wa.me/${whatsappNumber.replace('+', '')}?text=%C2%A1Hola!%20necesito%20apoyo%20con%20Simonkey`;

const HelpWhatsAppButton: React.FC = () => {
  const [hover, setHover] = useState(false);
  return (
    <a
      href={whatsappLink}
      className={`help-whatsapp-btn help-fab${hover ? ' expanded' : ''}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="¿Necesitas ayuda? Chatea por WhatsApp"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <span className="help-fab-icon">
        <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="32" cy="32" r="32" fill="#4F46E5" />
          <path d="M20 27C20 22.9848 23.5817 20 28 20H36C40.4183 20 44 22.9848 44 27V35C44 39.0152 40.4183 42 36 42H28C27.114 42 26.269 41.8738 25.5 41.65L20 48V27Z" fill="white"/>
        </svg>
      </span>
      <span className="help-fab-text">¿Necesitas ayuda?</span>
    </a>
  );
};

export default HelpWhatsAppButton; 