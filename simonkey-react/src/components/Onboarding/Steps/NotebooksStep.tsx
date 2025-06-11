import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBook, faFolderPlus, faFileImport, faSearch } from '@fortawesome/free-solid-svg-icons';

// Define the interface for component props
interface NotebooksStepProps {
  onNext: () => void;
  onPrev: () => void;
}

// Add the type definition to your component
const NotebooksStep: React.FC<NotebooksStepProps> = ({ onNext, onPrev }) => {
  return (
    <div className="flex flex-col items-center justify-center gap-6 text-center px-4 py-8">
      <h2 className="text-2xl font-bold text-indigo-600">Tus Cuadernos de Estudio</h2>
      
      <p className="text-lg text-gray-700 max-w-md">
        En Simonkey, todo comienza con un cuaderno. Los cuadernos te ayudan a organizar conceptos relacionados en un solo lugar.
      </p>
      
      {/* Visualización ilustrativa de cuadernos */}
      <div className="relative w-full max-w-2xl h-60 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 my-4 overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="grid grid-cols-3 gap-4 p-4">
            {/* Ejemplos de cuadernos */}
            <div className="bg-white rounded-md shadow-sm p-3 border border-gray-200 transform hover:-translate-y-1 transition-transform cursor-pointer">
              <FontAwesomeIcon icon={faBook} className="text-indigo-500 mb-2" />
              <p className="text-sm font-medium">Biología</p>
            </div>
            <div className="bg-white rounded-md shadow-sm p-3 border border-gray-200 transform hover:-translate-y-1 transition-transform cursor-pointer">
              <FontAwesomeIcon icon={faBook} className="text-indigo-500 mb-2" />
              <p className="text-sm font-medium">Historia</p>
            </div>
            <div className="bg-white rounded-md shadow-sm p-3 border border-gray-200 transform hover:-translate-y-1 transition-transform cursor-pointer">
              <FontAwesomeIcon icon={faBook} className="text-indigo-500 mb-2" />
              <p className="text-sm font-medium">Matemáticas</p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Funciones principales de los cuadernos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-3xl">
        <div className="bg-white p-4 rounded-lg shadow-sm">
          <FontAwesomeIcon icon={faFolderPlus} className="text-indigo-500 text-xl mb-2" />
          <h3 className="font-medium text-md mb-1">Crea Cuadernos</h3>
          <p className="text-gray-600 text-sm">Organiza tu estudio por materias o temas específicos.</p>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow-sm">
          <FontAwesomeIcon icon={faFileImport} className="text-indigo-500 text-xl mb-2" />
          <h3 className="font-medium text-md mb-1">Importa Recursos</h3>
          <p className="text-gray-600 text-sm">Añade documentos, links o usa nuestra IA para investigar.</p>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow-sm">
          <FontAwesomeIcon icon={faSearch} className="text-indigo-500 text-xl mb-2" />
          <h3 className="font-medium text-md mb-1">Acceso Rápido</h3>
          <p className="text-gray-600 text-sm">Encuentra tus materiales de estudio al instante.</p>
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
          onClick={onNext}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-6 rounded-full transition-colors"
        >
          Siguiente
        </button>
      </div>
    </div>
  );
};

export default NotebooksStep;