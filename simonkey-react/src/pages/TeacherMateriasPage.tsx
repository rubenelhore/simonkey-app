import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import HeaderWithHamburger from '../components/HeaderWithHamburger';
import MateriaItem from '../components/MateriaItem';
import '../styles/Materias.css';

interface Materia {
  id: string;
  title: string;
  color: string;
  notebookCount: number;
}

const TeacherMateriasPage: React.FC = () => {
  console.log('🎯 TeacherMateriasPage MOUNTED');
  const navigate = useNavigate();
  const { user } = useAuth();
  const [materias, setMaterias] = useState<Materia[]>([]);
  const [loading, setLoading] = useState(true);
  
  console.log('👨‍🏫 TeacherMateriasPage - user:', user?.uid);

  useEffect(() => {
    const loadMaterias = async () => {
      if (!user) return;
      
      try {
        // Cargar materias del profesor
        const materiasQuery = query(
          collection(db, 'schoolSubjects'),
          where('idProfesor', '==', user.uid)
        );
        
        const materiasSnapshot = await getDocs(materiasQuery);
        
        // Cargar notebooks para contar
        const notebooksQuery = query(
          collection(db, 'schoolNotebooks'),
          where('idProfesor', '==', user.uid)
        );
        
        const notebooksSnapshot = await getDocs(notebooksQuery);
        
        // Crear mapa de conteo
        const notebookCountMap: Record<string, number> = {};
        notebooksSnapshot.docs.forEach(doc => {
          const idMateria = doc.data().idMateria;
          if (idMateria) {
            notebookCountMap[idMateria] = (notebookCountMap[idMateria] || 0) + 1;
          }
        });
        
        // Construir materias
        const teacherMaterias: Materia[] = materiasSnapshot.docs.map(docSnap => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            title: data.nombre,
            color: data.color || '#6147FF',
            notebookCount: notebookCountMap[docSnap.id] || 0
          };
        });
        
        setMaterias(teacherMaterias);
      } catch (error) {
        console.error('Error loading teacher materias:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadMaterias();
  }, [user]);

  const handleViewMateria = (materiaId: string) => {
    const materia = materias.find(m => m.id === materiaId);
    if (materia) {
      const encodedName = encodeURIComponent(materia.title);
      navigate(`/materias/${encodedName}/notebooks`);
    }
  };

  if (loading) {
    return (
      <>
        <HeaderWithHamburger title="Mis Materias" />
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Cargando materias...</p>
        </div>
      </>
    );
  }

  return (
    <>
      <HeaderWithHamburger title="Mis Materias" />
      <main className="materias-main">
        <div className="materias-list-section">
          {materias.length === 0 ? (
            <div className="empty-state">
              <h3>No tienes materias asignadas</h3>
              <p>Contacta al administrador de tu institución.</p>
            </div>
          ) : (
            <div className="materia-grid">
              {materias.map(materia => (
                <MateriaItem
                  key={materia.id}
                  id={materia.id}
                  title={materia.title}
                  color={materia.color}
                  notebookCount={materia.notebookCount}
                  onView={handleViewMateria}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
};

export default TeacherMateriasPage;