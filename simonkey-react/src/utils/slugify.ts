/**
 * Convierte un texto en un slug URL-friendly
 * @param text - El texto a convertir
 * @returns El slug generado
 */
export const slugify = (text: string): string => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .normalize('NFD') // Normalizar caracteres Unicode
    .replace(/[\u0300-\u036f]/g, '') // Remover acentos
    .replace(/[^a-z0-9\s-]/g, '') // Remover caracteres especiales
    .replace(/\s+/g, '-') // Reemplazar espacios con guiones
    .replace(/-+/g, '-') // Reemplazar múltiples guiones con uno solo
    .replace(/^-+/, '') // Remover guiones al inicio
    .replace(/-+$/, ''); // Remover guiones al final
};

/**
 * Genera una URL de notebook con ID y slug
 * @param id - El ID del notebook
 * @param title - El título del notebook
 * @returns La URL completa
 */
export const generateNotebookUrl = (id: string, title: string): string => {
  const slug = slugify(title);
  return `${id}/${slug}`;
};

/**
 * Extrae el ID de una URL de notebook
 * @param urlPath - La parte de la URL después de /notebooks/
 * @returns El ID del notebook
 */
export const extractNotebookId = (urlPath: string): string => {
  // El ID es la primera parte antes del primer slash
  const parts = urlPath.split('/');
  return parts[0];
};