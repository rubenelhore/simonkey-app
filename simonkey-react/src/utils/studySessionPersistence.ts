// Utilidades para persistir la selección del cuaderno de estudio
import { Notebook } from '../types/interfaces';

const STUDY_SELECTION_KEY = 'study-selected-notebook';
const STUDY_MATERIA_KEY = 'study-selected-materia';

export interface PersistedStudySelection {
  notebook: Notebook | null;
  materia: any | null;
  timestamp: number;
}

export const studySessionPersistence = {
  // Guardar la selección actual
  saveSelection: (notebook: Notebook | null, materia: any | null) => {
    try {
      const selection: PersistedStudySelection = {
        notebook,
        materia,
        timestamp: Date.now()
      };
      localStorage.setItem(STUDY_SELECTION_KEY, JSON.stringify(selection));
    } catch (error) {
      console.error('Error guardando selección de estudio:', error);
    }
  },

  // Recuperar la selección guardada
  getSelection: (): PersistedStudySelection | null => {
    try {
      const stored = localStorage.getItem(STUDY_SELECTION_KEY);
      if (!stored) return null;

      const selection: PersistedStudySelection = JSON.parse(stored);
      
      // Validar que no sea muy antigua (más de 4 horas)
      const FOUR_HOURS = 4 * 60 * 60 * 1000;
      if (Date.now() - selection.timestamp > FOUR_HOURS) {
        studySessionPersistence.clearSelection();
        return null;
      }

      return selection;
    } catch (error) {
      console.error('Error recuperando selección de estudio:', error);
      studySessionPersistence.clearSelection();
      return null;
    }
  },

  // Limpiar la selección
  clearSelection: () => {
    try {
      localStorage.removeItem(STUDY_SELECTION_KEY);
    } catch (error) {
      console.error('Error limpiando selección de estudio:', error);
    }
  },

  // Verificar si hay una selección válida
  hasValidSelection: (): boolean => {
    const selection = studySessionPersistence.getSelection();
    return selection !== null && selection.notebook !== null;
  }
};