import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRobot, faMagic, faEdit, faCheckCircle } from '@fortawesome/free-solid-svg-icons';

// Define the interface for component props
interface ConceptsStepProps {
    onNext: (data?: any) => void; // Replace 'any' with a more specific type if needed
    onPrev: () => void;
  }

// Add the type definition to your component
const ConceptsStep: React.FC<ConceptsStepProps> = ({ onNext, onPrev }) => {
  // Ejemplos de conceptos para mostrar
  const sampleConcepts = [
    { term: 'Fotosíntesis', definition: 'Proceso biológico donde las plantas convierten luz solar en energía química.' },
    { term: 'Mitosis', definition: 'División celular que resulta en dos células hijas con el mismo número de cromosomas.' },
    { term: 'Célula', definition: 'Unidad estructural y funcional básica de todos los organismos vivos.' }
  ];

  return (
    <div className="flex flex-col items-center justify-center gap-6 text-center px-4 py-8">
      <h2 className="text-2xl font-bold text-indigo-600">Conceptos y Definiciones</h2>
      
      <p className="text-lg text-gray-700 max-w-md">
        Los conceptos son el corazón de tu aprendizaje. Añade términos y definiciones para estudiarlos eficazmente.
      </p>
      
      {/* Visualización ilustrativa de conceptos */}
      <div className="w-full max-w-2xl bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 bg-indigo-50 border-b">
          <h3 className="font-medium text-indigo-600">Cuaderno: Biología</h3>
        </div>
        
        <div className="divide-y">
          {sampleConcepts.map((concept, index) => (
            <div key={index} className="p-4 hover:bg-gray-50 transition-colors flex items-start">
              <div className="flex-1 text-left">
                <h4 className="font-medium text-gray-800">{concept.term}</h4>
                <p className="text-sm text-gray-600 mt-1">{concept.definition}</p>
              </div>
              <FontAwesomeIcon 
                icon={faCheckCircle} 
                className={`text-lg ${index === 0 ? 'text-green-500' : 'text-gray-300'}`} 
              />
            </div>
          ))}
        </div>
      </div>
      
      {/* Funciones principales para los conceptos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-3xl mt-2">
        <div className="bg-white p-4 rounded-lg shadow-sm">
          <FontAwesomeIcon icon={faRobot} className="text-indigo-500 text-xl mb-2" />
          <h3 className="font-medium text-md mb-1">Extracción con IA</h3>
          <p className="text-gray-600 text-sm">Nuestra IA puede identificar conceptos clave de tus documentos.</p>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow-sm">
          <FontAwesomeIcon icon={faMagic} className="text-indigo-500 text-xl mb-2" />
          <h3 className="font-medium text-md mb-1">Definiciones Precisas</h3>
          <p className="text-gray-600 text-sm">Genera definiciones concisas basadas en tus fuentes.</p>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow-sm">
          <FontAwesomeIcon icon={faEdit} className="text-indigo-500 text-xl mb-2" />
          <h3 className="font-medium text-md mb-1">Personalización</h3>
          <p className="text-gray-600 text-sm">Edita los conceptos y definiciones a tu gusto.</p>
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

export default ConceptsStep;