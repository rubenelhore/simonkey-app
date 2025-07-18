import { UnifiedConceptService } from '../services/unifiedConceptService';

export async function getDomainProgressForNotebook(notebookId: string) {
  const concepts = await UnifiedConceptService.getConcepts(notebookId);
  const total = concepts.length;
  const dominated = concepts.filter(c => c.dominado === true).length;
  // Si tienes un campo para 'aprendiendo', agrégalo aquí. Si no, todo lo que no es dominado es no iniciado.
  const learning = 0;
  const notStarted = total - dominated;
  return { total, dominated, learning, notStarted };
} 