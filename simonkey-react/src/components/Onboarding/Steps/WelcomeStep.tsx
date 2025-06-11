import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBook, faLightbulb, faBrain } from '@fortawesome/free-solid-svg-icons';

// Add this interface to define the component props
interface WelcomeStepProps {
  onNext: () => void;
}

// Update the component to use the interface
const WelcomeStep: React.FC<WelcomeStepProps> = ({ onNext }) => {
  return (
    <div className="flex flex-col items-center justify-center gap-8 text-center px-4 py-8">
      {/* Logo y mascota */}
      <div className="w-32 h-32 overflow-hidden rounded-full bg-indigo-100 flex items-center justify-center">
        <img src="/img/favicon.svg" alt="Simón" className="w-24 h-24" />
      </div>
      
      <h1 className="text-3xl font-bold text-indigo-600">¡Bienvenido a Simonkey!</h1>
      
      <p className="text-lg text-gray-700 max-w-md">
        Tu asistente personal de estudio con IA para ayudarte a aprender de manera más efectiva.
      </p>
      
      {/* Características principales */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-3xl mt-4">
        <div className="bg-white p-4 rounded-lg shadow-md">
          <FontAwesomeIcon icon={faBook} className="text-indigo-500 text-3xl mb-3" />
          <h3 className="font-semibold text-lg mb-2">Cuadernos Digitales</h3>
          <p className="text-gray-600 text-sm">Organiza conceptos en cuadernos temáticos para un estudio más estructurado.</p>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow-md">
          <FontAwesomeIcon icon={faLightbulb} className="text-indigo-500 text-3xl mb-3" />
          <h3 className="font-semibold text-lg mb-2">Asistencia con IA</h3>
          <p className="text-gray-600 text-sm">Extrae conceptos y genera definiciones con ayuda de la inteligencia artificial.</p>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow-md">
          <FontAwesomeIcon icon={faBrain} className="text-indigo-500 text-3xl mb-3" />
          <h3 className="font-semibold text-lg mb-2">Técnicas de Estudio</h3>
          <p className="text-gray-600 text-sm">Aprende con tarjetas didácticas, historias, canciones y técnicas mnemotécnicas.</p>
        </div>
      </div>
      
      <button 
        onClick={onNext}
        className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-6 rounded-full transition-colors mt-6"
      >
        Comenzar
      </button>
    </div>
  );
};

export default WelcomeStep;