import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthState } from 'react-firebase-hooks/auth';
import { db, auth } from '../services/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import '../styles/NotebookDetail.css';
import '../styles/SharedNotebook.css';

const SharedNotebook = () => {
  const { shareId } = useParams<{ shareId: string }>();
  const [user, loading] = useAuthState(auth);
  const navigate = useNavigate();
  
  const [notebook, setNotebook] = useState<any>(null);
  const [conceptDocs, setConceptDocs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);
  
  // Función para cargar el cuaderno compartido
  useEffect(() => {
    const fetchSharedNotebook = async () => {
      if (!shareId) {
        setError("El enlace es inválido");
        setIsLoading(false);
        return;
      }
      
      try {
        // Buscar el cuaderno por shareId
        const notebooksQuery = query(
          collection(db, 'notebooks'),
          where('shareId', '==', shareId)
        );
        
        const querySnapshot = await getDocs(notebooksQuery);
        
        if (querySnapshot.empty) {
          setError("El cuaderno no existe o ha sido eliminado");
          setIsLoading(false);
          return;
        }
        
        const notebookData = querySnapshot.docs[0].data();
        const notebookId = querySnapshot.docs[0].id;
        setNotebook({
          id: notebookId,
          ...notebookData
        });
        
        // Cargar conceptos relacionados
        const conceptsQuery = query(
          collection(db, 'conceptos'),
          where('cuadernoId', '==', notebookId)
        );
        
        const conceptsSnapshot = await getDocs(conceptsQuery);
        const conceptsData = conceptsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        setConceptDocs(conceptsData);
        setIsLoading(false);
      } catch (error) {
        console.error("Error al cargar cuaderno compartido:", error);
        setError("Error al cargar el cuaderno. Por favor, intenta nuevamente.");
        setIsLoading(false);
      }
    };
    
    fetchSharedNotebook();
  }, [shareId]);
  
  // Función para guardar el cuaderno en la cuenta del usuario
  const handleSaveNotebook = async () => {
    if (!user || !notebook) return;
    
    setIsSaving(true);
    
    try {
      // Comprobar si el usuario ya tiene este cuaderno
      const userNotebooksQuery = query(
        collection(db, 'notebooks'),
        where('userId', '==', user.uid),
        where('originalNotebookId', '==', notebook.id)
      );
      
      const userNotebooksSnapshot = await getDocs(userNotebooksQuery);
      
      if (!userNotebooksSnapshot.empty) {
        alert("Ya tienes este cuaderno guardado en tu biblioteca");
        setIsSaving(false);
        return;
      }
      
      // Crear una copia del cuaderno para el usuario
      const newNotebookRef = await addDoc(collection(db, 'notebooks'), {
        title: notebook.title,
        userId: user.uid,
        createdAt: serverTimestamp(),
        color: notebook.color || '#6147FF',
        originalNotebookId: notebook.id,
        originalUserId: notebook.userId,
        savedFromShare: true
      });
      
      // Copiar todos los conceptos
      for (const conceptDoc of conceptDocs) {
        await addDoc(collection(db, 'conceptos'), {
          cuadernoId: newNotebookRef.id,
          usuarioId: user.uid,
          conceptos: conceptDoc.conceptos,
          creadoEn: serverTimestamp()
        });
      }
      
      setSavedSuccess(true);
      
      // Redirigir después de un tiempo
      setTimeout(() => {
        navigate(`/notebooks/${newNotebookRef.id}`);
      }, 2000);
    } catch (error) {
      console.error("Error al guardar cuaderno:", error);
      alert("Error al guardar el cuaderno. Por favor, intenta nuevamente.");
    } finally {
      setIsSaving(false);
    }
  };
  
  if (loading || isLoading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Cargando cuaderno compartido...</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="shared-notebook-container">
        <div className="error-container">
          <i className="fas fa-exclamation-circle error-icon"></i>
          <h2>Error</h2>
          <p>{error}</p>
          <button 
            className="primary-button" 
            onClick={() => navigate('/')}
          >
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }
  
  if (!notebook) return null;
  
  return (
    <div className="shared-notebook-container" style={{'--shared-notebook-color': notebook.color || '#6147FF'} as React.CSSProperties}>
      <header className="shared-notebook-header">
        <div className="header-content">
          <button onClick={() => navigate('/')} className="back-button">
            <i className="fas fa-arrow-left"></i> Inicio
          </button>
          
          <div className="title-container">
            <h1>{notebook.title}</h1>
          </div>
          
          <div className="spacer"></div>
        </div>
      </header>
      
      <main className="shared-notebook-main">
        <div className="shared-info-card">
          <div className="shared-header">
            <h2>Cuaderno compartido</h2>
            {notebook.userId && (
              <p className="shared-by">Compartido por: {notebook.userDisplayName || "Usuario de Simonkey"}</p>
            )}
          </div>
          
          <div className="concepts-preview">
            <h3>Vista previa de conceptos:</h3>
            <div className="concept-preview-list">
              {conceptDocs.length > 0 ? (
                <ul>
                  {conceptDocs[0].conceptos?.slice(0, 5).map((concept: any, idx: number) => (
                    <li key={idx} className="concept-preview-item">
                      <span className="concept-term">{concept.término}</span>
                    </li>
                  ))}
                  {conceptDocs[0].conceptos?.length > 5 && (
                    <li className="and-more">Y {conceptDocs[0].conceptos.length - 5} más...</li>
                  )}
                </ul>
              ) : (
                <p>Este cuaderno no tiene conceptos todavía.</p>
              )}
            </div>
          </div>
          
          {!user ? (
            <div className="auth-prompt">
              <p>Para guardar este cuaderno, inicia sesión o regístrate:</p>
              <div className="auth-buttons">
                <button 
                  onClick={() => navigate('/login', { state: { returnUrl: `/shared/${shareId}` } })} 
                  className="login-button"
                >
                  <i className="fas fa-sign-in-alt"></i> Iniciar Sesión
                </button>
                <button 
                  onClick={() => navigate('/signup', { state: { returnUrl: `/shared/${shareId}` } })} 
                  className="register-button"
                >
                  <i className="fas fa-user-plus"></i> Registrarse
                </button>
              </div>
            </div>
          ) : savedSuccess ? (
            <div className="save-success">
              <i className="fas fa-check-circle"></i>
              <p>¡Cuaderno guardado con éxito!</p>
              <p>Redirigiendo a tu cuaderno...</p>
            </div>
          ) : (
            <button 
              onClick={handleSaveNotebook} 
              className="save-notebook-button" 
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <div className="spinner-small"></div> Guardando...
                </>
              ) : (
                <>
                  <i className="fas fa-save"></i> Guardar en mi biblioteca
                </>
              )}
            </button>
          )}
        </div>
      </main>
    </div>
  );
};

export default SharedNotebook;