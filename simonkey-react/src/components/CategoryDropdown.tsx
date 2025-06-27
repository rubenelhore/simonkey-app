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

const CategoryDropdown: React.FC = () => {
  const [user] = useAuthState(auth);
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);

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

  // Agrupar cuadernos por categoría
  const groupedByCategory = notebooks.reduce((acc, notebook) => {
    const category = notebook.category || 'Sin categoría';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(notebook);
    return acc;
  }, {} as Record<string, Notebook[]>);

  // Obtener categorías únicas (excluyendo "Sin categoría" si está vacía)
  const categories = Object.entries(groupedByCategory)
    .filter(([category, notebooks]) => {
      // Incluir "Sin categoría" solo si tiene cuadernos
      if (category === 'Sin categoría') {
        return notebooks.length > 0;
      }
      return true;
    })
    .map(([category, notebooks]) => ({
      name: category,
      count: notebooks.length,
      notebooks
    }))
    .sort((a, b) => {
      // "Sin categoría" al final
      if (a.name === 'Sin categoría') return 1;
      if (b.name === 'Sin categoría') return -1;
      return a.name.localeCompare(b.name);
    });

  useEffect(() => {
    const loadNotebooks = async () => {
      if (!user) return;

      try {
        setLoading(true);
        const notebooksData = await fetchNotebooks(user.uid);
        setNotebooks(notebooksData);
      } catch (error) {
        console.error("Error loading notebooks:", error);
      } finally {
        setLoading(false);
      }
    };

    loadNotebooks();
  }, [user]);

  if (loading) {
    return (
      <div className="category-dropdown-loading">
        Cargando categorías...
      </div>
    );
  }

  // Si no hay categorías, no mostrar el componente
  if (categories.length === 0) {
    return null;
  }

  return (
    <div className="category-dropdown-tracker">
      <div 
        className="category-dropdown-header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <h2>Categorías</h2>
        <div className={`category-dropdown-icon ${isExpanded ? 'expanded' : ''}`}>
          <i className="fas fa-chevron-down"></i>
        </div>
      </div>
      
      {isExpanded && (
        <div className="category-dropdown-content">
          {categories.map((category) => (
            <div key={category.name} className="category-dropdown-item">
              <div className="category-dropdown-item-header">
                <span className="category-dropdown-name">{category.name}</span>
                <span className="category-dropdown-count">({category.count})</span>
              </div>
              <div className="category-dropdown-notebooks">
                {category.notebooks.map((notebook) => (
                  <div 
                    key={notebook.id} 
                    className="category-dropdown-notebook"
                    style={{ borderLeftColor: notebook.color }}
                  >
                    <span className="category-dropdown-notebook-title">
                      {notebook.title}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CategoryDropdown; 