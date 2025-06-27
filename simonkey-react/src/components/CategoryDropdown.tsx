import React, { useState, useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '../services/firebase';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';

interface Notebook {
  id: string;
  title: string;
  category?: string;
  color?: string;
}

interface CategoryDropdownProps {
  onCategorySelect?: (category: string | null) => void;
  selectedCategory?: string | null;
  onCreateCategory?: () => void;
  refreshTrigger?: number;
}

const CategoryDropdown: React.FC<CategoryDropdownProps> = ({ 
  onCategorySelect, 
  selectedCategory,
  onCreateCategory,
  refreshTrigger
}) => {
  const [user] = useAuthState(auth);
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Función para obtener todos los cuadernos del usuario
  const fetchNotebooks = async (userId: string): Promise<Notebook[]> => {
    try {
      const notebooksQuery = query(
        collection(db, 'notebooks'),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
      );
      
      const notebooksSnapshot = await getDocs(notebooksQuery);
      const notebooksData: Notebook[] = [];
      
      notebooksSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        notebooksData.push({
          id: doc.id,
          title: data.title,
          category: data.category || '',
          color: data.color || '#6147FF'
        });
      });
      
      return notebooksData;
    } catch (error) {
      console.error('Error fetching notebooks:', error);
      return [];
    }
  };

  // Función para obtener todas las categorías del usuario
  const fetchCategories = async (userId: string): Promise<string[]> => {
    try {
      const categoriesQuery = query(
        collection(db, 'categories'),
        where('userId', '==', userId)
      );
      
      const categoriesSnapshot = await getDocs(categoriesQuery);
      const categoriesData: string[] = [];
      
      categoriesSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        if (data.name) {
          categoriesData.push(data.name);
        }
      });
      
      return categoriesData;
    } catch (error) {
      console.error('Error fetching categories:', error);
      // En caso de error de permisos, retornar array vacío para continuar funcionando
      // Las categorías se seguirán mostrando desde los cuadernos
      return [];
    }
  };

  // Agrupar cuadernos por categoría
  const groupedByCategory = notebooks.reduce((acc, notebook) => {
    const category = notebook.category || 'Sin categoría';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(notebook);
    return acc;
  }, {} as Record<string, Notebook[]>);

  // Obtener todas las categorías únicas (incluyendo las vacías)
  const allCategories = new Set<string>();
  
  // Agregar todas las categorías de los cuadernos
  notebooks.forEach(notebook => {
    if (notebook.category && notebook.category.trim() !== '') {
      allCategories.add(notebook.category);
    }
  });

  // Agregar todas las categorías de la colección de categorías
  categories.forEach(categoryName => {
    if (categoryName && categoryName.trim() !== '') {
      allCategories.add(categoryName);
    }
  });

  // Crear la lista de categorías con sus conteos
  const categoriesList = Array.from(allCategories)
    .map(categoryName => {
      const categoryNotebooks = groupedByCategory[categoryName] || [];
      return {
        name: categoryName,
        count: categoryNotebooks.length
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  // Filtrar para mostrar solo categorías con cuadernos (excluir "Sin categoría" si no tiene cuadernos)
  const visibleCategories = categoriesList.filter(category => {
    if (category.name === 'Sin categoría') {
      return category.count > 0; // Solo mostrar "Sin categoría" si tiene cuadernos
    }
    return true; // Mostrar todas las demás categorías, incluso si tienen 0 cuadernos
  });

  useEffect(() => {
    const loadNotebooks = async () => {
      if (!user) return;

      try {
        setLoading(true);
        const notebooksData = await fetchNotebooks(user.uid);
        const categoriesData = await fetchCategories(user.uid);
        setNotebooks(notebooksData);
        setCategories(categoriesData);
      } catch (error) {
        console.error("Error loading notebooks:", error);
      } finally {
        setLoading(false);
      }
    };

    loadNotebooks();
  }, [user, refreshTrigger]);

  const handleCategoryClick = (category: string) => {
    if (onCategorySelect) {
      // Si se hace clic en la categoría ya seleccionada, deseleccionarla
      if (selectedCategory === category) {
        onCategorySelect(null);
      } else {
        onCategorySelect(category);
      }
    }
  };

  if (loading) {
    return (
      <div className="category-dropdown-loading">
        Cargando categorías...
      </div>
    );
  }

  return (
    <div className="category-dropdown-tracker">
      <div className="category-dropdown-header">
        <h2>Categorías</h2>
        {onCreateCategory && (
          <button 
            className="category-create-button"
            onClick={onCreateCategory}
            title="Crear nueva categoría"
          >
            <i className="fas fa-plus"></i>
          </button>
        )}
      </div>
      
      <div className="category-dropdown-content">
        {visibleCategories.length === 0 ? (
          <div className="no-categories-message">
            <p>Sin categorías creadas</p>
          </div>
        ) : (
          <>
            {visibleCategories.map((category) => (
              <div 
                key={category.name} 
                className={`category-dropdown-item ${selectedCategory === category.name ? 'selected' : ''}`}
                onClick={() => handleCategoryClick(category.name)}
              >
                <div className="category-dropdown-item-header">
                  <span className="category-dropdown-name">{category.name}</span>
                  <span className="category-dropdown-count">({category.count})</span>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
};

export default CategoryDropdown; 