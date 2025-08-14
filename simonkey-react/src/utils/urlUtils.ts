// src/utils/urlUtils.ts

/**
 * Encode a materia name for use in URLs
 * Replaces spaces and special characters with URL-safe equivalents
 */
export const encodeMateriaName = (name: string): string => {
  return encodeURIComponent(name.trim());
};

/**
 * Decode a materia name from a URL
 * Converts URL-encoded string back to original name
 */
export const decodeMateriaName = (encodedName: string): string => {
  return decodeURIComponent(encodedName);
};

/**
 * Parse materia name and ID from URL format "nombre-id"
 * Returns an object with name and id properties
 */
export const parseMateriaNameWithId = (encodedNameWithId: string): { name: string; id: string | null } => {
  const decoded = decodeURIComponent(encodedNameWithId);
  
  // Buscar el último guión para separar el nombre del ID
  // El ID siempre será la última parte después del último guión
  const lastDashIndex = decoded.lastIndexOf('-');
  
  if (lastDashIndex === -1) {
    // No hay guión, solo es el nombre (formato antiguo)
    return { name: decoded, id: null };
  }
  
  const name = decoded.substring(0, lastDashIndex);
  const id = decoded.substring(lastDashIndex + 1);
  
  // Verificar que el ID parece válido (tiene al menos 10 caracteres alfanuméricos)
  if (id.length >= 10 && /^[a-zA-Z0-9]+$/.test(id)) {
    return { name, id };
  }
  
  // Si el ID no parece válido, tratar todo como nombre
  return { name: decoded, id: null };
};

/**
 * Create a URL-friendly slug from materia name
 * Alternative approach: converts to lowercase, replaces spaces with hyphens
 * Removes special characters for cleaner URLs
 */
export const createMateriaSlug = (name: string): string => {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
};

/**
 * Convert slug back to approximate original name (for display purposes)
 * Note: This won't perfectly restore the original due to information loss
 */
export const slugToDisplayName = (slug: string): string => {
  return slug
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

/**
 * Encode a notebook name for use in URLs
 * Replaces spaces and special characters with URL-safe equivalents
 */
export const encodeNotebookName = (name: string): string => {
  return encodeURIComponent(name.trim());
};

/**
 * Decode a notebook name from a URL
 * Converts URL-encoded string back to original name
 */
export const decodeNotebookName = (encodedName: string): string => {
  return decodeURIComponent(encodedName);
};