// src/pages/Materias.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../services/firebase';
import { collection, query, where, getDocs, addDoc, deleteDoc, doc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import '../styles/Materias.css';
import StreakTracker from '../components/StreakTracker';
import { useUserType } from '../hooks/useUserType';
import HeaderWithHamburger from '../components/HeaderWithHamburger';
import { useAuth } from '../contexts/AuthContext';
import CategoryDropdown from '../components/CategoryDropdown';
import MateriaList from '../components/MateriaList';
import { useAutoMigration } from '../hooks/useAutoMigration';

interface Materia {
  id: string;
  title: string;
  color: string;
  category?: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  notebookCount?: number;
}

const Materias: React.FC = () => {
  const { user, userProfile, loading: authLoading } = useAuth();
  const [materias, setMaterias] = useState<Materia[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const navigate = useNavigate();
  const { isSchoolUser, isSchoolStudent } = useUserType();
  const { migrationStatus, migrationMessage } = useAutoMigration();

  // Estados para el componente de personalización
  const [userData, setUserData] = useState({
    nombre: '',
    apellidos: '',
    tipoAprendizaje: 'Visual',
    intereses: ['tecnología']
  });

  // Cargar materias del usuario
  useEffect(() => {
    const loadMaterias = async () => {
      if (!user) return;
      
      setLoading(true);
      try {
        // Query para obtener las materias del usuario
        const materiasQuery = query(
          collection(db, 'materias'),
          where('userId', '==', user.uid)
        );
        
        const snapshot = await getDocs(materiasQuery);
        const materiasData: Materia[] = [];
        
        for (const docSnap of snapshot.docs) {
          const data = docSnap.data();
          
          // Contar notebooks de cada materia
          const notebooksQuery = query(
            collection(db, 'notebooks'),
            where('materiaId', '==', docSnap.id)
          );
          const notebooksSnapshot = await getDocs(notebooksQuery);
          
          materiasData.push({
            id: docSnap.id,
            title: data.title,
            color: data.color || '#6147FF',
            category: data.category,
            userId: data.userId,
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date(),
            notebookCount: notebooksSnapshot.size
          });
        }
        
        setMaterias(materiasData);
        setError(null);
      } catch (err) {
        console.error('Error loading materias:', err);
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };
    
    loadMaterias();
  }, [user, refreshTrigger]);

  // Cargar datos del usuario
  useEffect(() => {
    if (userProfile) {
      setUserData({
        nombre: userProfile.nombre || userProfile.displayName || '',
        apellidos: userProfile.apellidos || '',
        tipoAprendizaje: userProfile.tipoAprendizaje || 'Visual',
        intereses: userProfile.intereses || ['']
      });
    }
  }, [userProfile]);

  const handleCreate = async (title: string, color: string, category?: string) => {
    if (!user) return;
    
    try {
      await addDoc(collection(db, 'materias'), {
        title,
        color,
        category: category || '', // Asegurar que no sea undefined
        userId: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error('Error creating materia:', error);
      throw error;
    }
  };

  const handleDelete = async (id: string) => {
    try {
      // Verificar si hay notebooks en esta materia
      const notebooksQuery = query(
        collection(db, 'notebooks'),
        where('materiaId', '==', id)
      );
      const notebooksSnapshot = await getDocs(notebooksQuery);
      
      if (notebooksSnapshot.size > 0) {
        const message = `Esta materia contiene ${notebooksSnapshot.size} cuaderno(s).\n\n` +
                       `¿Qué deseas hacer?\n\n` +
                       `ACEPTAR: Eliminar la materia Y todos sus cuadernos\n` +
                       `CANCELAR: No eliminar nada`;
        
        if (!window.confirm(message)) {
          return;
        }
        
        // Si el usuario acepta, eliminar todos los cuadernos de esta materia
        console.log(`Eliminando ${notebooksSnapshot.size} cuadernos de la materia...`);
        for (const notebookDoc of notebooksSnapshot.docs) {
          await deleteDoc(doc(db, 'notebooks', notebookDoc.id));
          console.log(`Cuaderno ${notebookDoc.id} eliminado`);
        }
      }
      
      // Eliminar la materia
      await deleteDoc(doc(db, 'materias', id));
      console.log(`Materia ${id} eliminada`);
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error('Error deleting materia:', error);
      alert('Error al eliminar la materia. Por favor, intenta de nuevo.');
    }
  };

  const handleEdit = async (id: string, newTitle: string) => {
    try {
      // Verificar si ya existe una materia con ese nombre
      const materiasQuery = query(
        collection(db, 'materias'),
        where('userId', '==', user?.uid),
        where('title', '==', newTitle)
      );
      const snapshot = await getDocs(materiasQuery);
      
      if (!snapshot.empty && snapshot.docs[0].id !== id) {
        throw new Error('Ya existe una materia con ese nombre');
      }
      
      await updateDoc(doc(db, 'materias', id), {
        title: newTitle,
        updatedAt: serverTimestamp()
      });
      
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error('Error updating materia:', error);
      throw error;
    }
  };

  const handleColorChange = async (id: string, newColor: string) => {
    try {
      await updateDoc(doc(db, 'materias', id), {
        color: newColor,
        updatedAt: serverTimestamp()
      });
      
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error('Error updating materia color:', error);
    }
  };

  const handleView = (materiaId: string) => {
    navigate(`/materias/${materiaId}/notebooks`);
  };

  const handleCategorySelect = (category: string | null) => {
    setSelectedCategory(category);
  };

  const handleCreateCategory = () => {
    setShowCategoryModal(true);
  };

  const handleClearSelectedCategory = () => {
    setSelectedCategory(null);
  };

  if (loading || authLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Cargando materias...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <h2>Error al cargar las materias</h2>
        <p>{error.message}</p>
      </div>
    );
  }

  return (
    <>
      <HeaderWithHamburger
        title=""
        subtitle={`Espacio Personal de ${userData.nombre || 'Simón'}`}
      />
      {/* Notificación de migración */}
      {migrationStatus && migrationMessage && (
        <div className={`migration-notification ${migrationStatus}`}>
          <div className="migration-notification-content">
            {migrationStatus === 'checking' && <span className="spinner">⏳</span>}
            {migrationStatus === 'migrating' && <span className="spinner">🔄</span>}
            {migrationStatus === 'completed' && <span className="icon">✅</span>}
            {migrationStatus === 'error' && <span className="icon">❌</span>}
            <span className="message">{migrationMessage}</span>
          </div>
        </div>
      )}
      <main className="materias-main">
        <div className="left-column">
          <StreakTracker />
          <CategoryDropdown 
            onCategorySelect={handleCategorySelect}
            selectedCategory={selectedCategory}
            onCreateCategory={handleCreateCategory}
            refreshTrigger={refreshTrigger}
          />
        </div>
        <div className="materias-list-section">
          <h2>{isSchoolStudent ? 'Mis materias escolares' : 'Mis materias'}</h2>
          <MateriaList 
            materias={materias}
            onDeleteMateria={isSchoolStudent ? undefined : handleDelete}
            onEditMateria={isSchoolStudent ? undefined : handleEdit}
            onColorChange={isSchoolStudent ? undefined : handleColorChange}
            onCreateMateria={isSchoolStudent ? undefined : handleCreate}
            onViewMateria={handleView}
            showCreateButton={!isSchoolStudent}
            selectedCategory={selectedCategory}
            showCategoryModal={showCategoryModal}
            onCloseCategoryModal={() => setShowCategoryModal(false)}
            onClearSelectedCategory={handleClearSelectedCategory}
            onRefreshCategories={() => setRefreshTrigger(prev => prev + 1)}
          />
        </div>
      </main>
      <footer className="materias-footer">
        <p>&copy; {new Date().getFullYear()} Simonkey - Todos los derechos reservados</p>
      </footer>
    </>
  );
};

export default Materias;