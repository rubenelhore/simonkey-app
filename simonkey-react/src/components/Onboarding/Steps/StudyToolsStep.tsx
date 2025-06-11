import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLayerGroup, faBookOpen, faMusic, faImage, faBrain, faGraduationCap } from '@fortawesome/free-solid-svg-icons';

// Add interface for component props
interface StudyToolsStepProps {
  onFinish: (data?: any) => void; // Replace 'any' with a more specific type if needed
  onPrev: () => void;
}

// Use the interface with your component
const StudyToolsStep: React.FC<StudyToolsStepProps> = ({ onFinish, onPrev }) => {
  return (
    <div className="flex flex-col items-center justify-center gap-6 text-center px-4 py-8">
      <h2 className="text-2xl font-bold text-indigo-600">Herramientas de Aprendizaje</h2>
      
      <p className="text-lg text-gray-700 max-w-md">
        Simonkey te ofrece múltiples formas de estudiar y memorizar tus conceptos con técnicas diseñadas para un aprendizaje efectivo.
      </p>
      
      {/* Visualización de herramientas de aprendizaje */}
      <div className="w-full max-w-2xl grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200 hover:border-indigo-300 hover:shadow-md transition-all">
          <div className="flex flex-col items-center justify-center h-full">
            <FontAwesomeIcon icon={faLayerGroup} className="text-indigo-500 text-2xl mb-3" />
            <h3 className="font-medium text-lg mb-2">Tarjetas Didácticas</h3>
            <p className="text-sm text-gray-600">Estudia con tarjetas estilo Anki para memorizar conceptos de forma efectiva.</p>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200 hover:border-indigo-300 hover:shadow-md transition-all">
          <div className="flex flex-col items-center justify-center h-full">
            <FontAwesomeIcon icon={faBookOpen} className="text-indigo-500 text-2xl mb-3" />
            <h3 className="font-medium text-lg mb-2">Historias</h3>
            <p className="text-sm text-gray-600">Genera historias creativas que incluyan tus conceptos para recordarlos mejor.</p>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200 hover:border-indigo-300 hover:shadow-md transition-all">
          <div className="flex flex-col items-center justify-center h-full">
            <FontAwesomeIcon icon={faMusic} className="text-indigo-500 text-2xl mb-3" />
            <h3 className="font-medium text-lg mb-2">Canciones</h3>
            <p className="text-sm text-gray-600">Crea canciones pegadizas con tus conceptos para facilitar su memorización.</p>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200 hover:border-indigo-300 hover:shadow-md transition-all">
          <div className="flex flex-col items-center justify-center h-full">
            <FontAwesomeIcon icon={faImage} className="text-indigo-500 text-2xl mb-3" />
            <h3 className="font-medium text-lg mb-2">Imágenes</h3>
            <p className="text-sm text-gray-600">Visualiza tus conceptos con imágenes generadas que refuercen tu memoria visual.</p>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200 hover:border-indigo-300 hover:shadow-md transition-all">
          <div className="flex flex-col items-center justify-center h-full">
            <FontAwesomeIcon icon={faBrain} className="text-indigo-500 text-2xl mb-3" />
            <h3 className="font-medium text-lg mb-2">Mnemotecnia</h3>
            <p className="text-sm text-gray-600">Utiliza técnicas avanzadas de memoria para recordar conceptos complejos.</p>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200 hover:border-indigo-300 hover:shadow-md transition-all">
          <div className="flex flex-col items-center justify-center h-full">
            <FontAwesomeIcon icon={faGraduationCap} className="text-indigo-500 text-2xl mb-3" />
            <h3 className="font-medium text-lg mb-2">Examinar</h3>
            <p className="text-sm text-gray-600">Pon a prueba tu conocimiento con quizzes y exámenes personalizados.</p>
          </div>
        </div>
      </div>
      
      <div className="flex gap-4 mt-6">
        <button 
          onClick={onPrev}
          className="border border-indigo-600 text-indigo-600 hover:bg-indigo-50 font-medium py-2 px-6 rounded-full transition-colors"
        >
          Atrás
        </button>
        <button 
          onClick={onFinish}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-6 rounded-full transition-colors"
        >
          ¡Comenzar a Estudiar!
        </button>
      </div>
    </div>
  );
};

export default StudyToolsStep;