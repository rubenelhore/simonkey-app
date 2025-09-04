import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  getDocs,
  doc,
  getDoc,
  orderBy,
  limit,
  Timestamp,
  addDoc,
  updateDoc,
  deleteDoc
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db } from './firebase';

export interface NotificationData {
  id: string;
  type: 'new_notebook' | 'new_document';
  title: string;
  message: string;
  materiaId: string;
  materiaName: string;
  teacherName: string;
  createdAt: Timestamp;
  isRead: boolean;
  userId: string;
  contentId: string; // ID del cuaderno o documento
}

export class NotificationService {
  private static instance: NotificationService;
  private listeners: (() => void)[] = [];
  
  static getInstance(): NotificationService {
    if (!this.instance) {
      this.instance = new NotificationService();
    }
    return this.instance;
  }

  // Guardar notificación en la base de datos
  async saveNotification(notificationData: Omit<NotificationData, 'id'>): Promise<string | null> {
    try {
      const docRef = await addDoc(collection(db, 'notifications'), {
        ...notificationData,
        createdAt: Timestamp.now()
      });
      console.log('✅ Notificación guardada:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('❌ Error guardando notificación:', error);
      return null;
    }
  }

  // Obtener notificaciones no leídas de un usuario
  async getUnreadNotifications(userId: string): Promise<NotificationData[]> {
    try {
      const notificationsQuery = query(
        collection(db, 'notifications'),
        where('userId', '==', userId),
        where('isRead', '==', false),
        orderBy('createdAt', 'desc'),
        limit(20)
      );
      
      const snapshot = await getDocs(notificationsQuery);
      const notifications: NotificationData[] = [];
      
      snapshot.forEach(doc => {
        notifications.push({ id: doc.id, ...doc.data() } as NotificationData);
      });
      
      return notifications;
    } catch (error) {
      console.error('❌ Error obteniendo notificaciones:', error);
      return [];
    }
  }

  // Marcar notificación como leída
  async markAsRead(notificationId: string): Promise<boolean> {
    try {
      await updateDoc(doc(db, 'notifications', notificationId), {
        isRead: true,
        readAt: Timestamp.now()
      });
      return true;
    } catch (error) {
      console.error('❌ Error marcando notificación como leída:', error);
      return false;
    }
  }

  // Marcar todas las notificaciones como leídas
  async markAllAsRead(userId: string): Promise<boolean> {
    try {
      const unreadQuery = query(
        collection(db, 'notifications'),
        where('userId', '==', userId),
        where('isRead', '==', false)
      );
      
      const snapshot = await getDocs(unreadQuery);
      const updatePromises = snapshot.docs.map(doc => 
        updateDoc(doc.ref, {
          isRead: true,
          readAt: Timestamp.now()
        })
      );
      
      await Promise.all(updatePromises);
      console.log('✅ Todas las notificaciones marcadas como leídas');
      return true;
    } catch (error) {
      console.error('❌ Error marcando todas como leídas:', error);
      return false;
    }
  }

  // Verificar si ya existe una notificación para evitar duplicados
  async notificationExists(userId: string, contentId: string, type: string): Promise<boolean> {
    try {
      const existingQuery = query(
        collection(db, 'notifications'),
        where('userId', '==', userId),
        where('contentId', '==', contentId),
        where('type', '==', type)
      );
      
      const snapshot = await getDocs(existingQuery);
      return !snapshot.empty;
    } catch (error) {
      console.error('❌ Error verificando notificación existente:', error);
      return false;
    }
  }

  // Obtener materias donde el usuario está enrolado
  async getEnrolledMaterias(userId: string): Promise<{ id: string; nombre: string; idProfesor: string }[]> {
    try {
      // Buscar enrollments del usuario
      const enrollmentsQuery = query(
        collection(db, 'enrollments'),
        where('studentId', '==', userId)
      );
      
      const enrollmentsSnapshot = await getDocs(enrollmentsQuery);
      const materiaIds: string[] = [];
      
      enrollmentsSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.subjectId) {
          materiaIds.push(data.subjectId);
        }
      });

      if (materiaIds.length === 0) {
        return [];
      }

      // Obtener información de las materias
      const materiasPromises = materiaIds.map(async (materiaId) => {
        const materiaDoc = await getDoc(doc(db, 'schoolSubjects', materiaId));
        if (materiaDoc.exists()) {
          const data = materiaDoc.data();
          return {
            id: materiaDoc.id,
            nombre: data.nombre || 'Materia sin nombre',
            idProfesor: data.idProfesor || ''
          };
        }
        return null;
      });

      const materias = await Promise.all(materiasPromises);
      return materias.filter(materia => materia !== null) as { id: string; nombre: string; idProfesor: string }[];
    } catch (error) {
      console.error('Error obteniendo materias enroladas:', error);
      return [];
    }
  }

  // Listener para nuevos cuadernos - crea notificaciones para TODOS los estudiantes enrolados
  listenForNewNotebooks(): () => void {
    const setupListener = async () => {
      try {
        // Crear listener para schoolNotebooks (todos los cuadernos)
        const notebooksQuery = query(
          collection(db, 'schoolNotebooks'),
          orderBy('createdAt', 'desc'),
          limit(10) // Limitar para mejor rendimiento
        );

        const unsubscribe = onSnapshot(notebooksQuery, async (snapshot) => {
          snapshot.docChanges().forEach(async (change) => {
            if (change.type === 'added') {
              const notebookData = change.doc.data();
              const notebook = { id: change.doc.id, ...notebookData } as any;
              
              // Solo procesar cuadernos recién creados (últimos 30 segundos)
              const thirtySecondsAgo = new Date(Date.now() - 30 * 1000);
              const notebookCreatedAt = notebook.createdAt?.toDate() || new Date();
              
              if (notebookCreatedAt <= thirtySecondsAgo) {
                return; // No procesar cuadernos antiguos
              }

              console.log('🔔 Nuevo cuaderno detectado:', notebook.title);

              // Buscar todos los estudiantes enrolados en esta materia
              const enrollmentsQuery = query(
                collection(db, 'enrollments'),
                where('subjectId', '==', notebook.materiaId)
              );
              
              const enrollmentsSnapshot = await getDocs(enrollmentsQuery);
              
              // Obtener información de la materia
              let materiaInfo = { nombre: 'Materia desconocida', idProfesor: '' };
              try {
                const materiaDoc = await getDoc(doc(db, 'schoolSubjects', notebook.materiaId));
                if (materiaDoc.exists()) {
                  const materiaData = materiaDoc.data();
                  materiaInfo = {
                    nombre: materiaData.nombre || 'Materia desconocida',
                    idProfesor: materiaData.idProfesor || ''
                  };
                }
              } catch (error) {
                console.error('Error obteniendo información de materia:', error);
              }

              // Obtener nombre del profesor
              let teacherName = 'Profesor desconocido';
              if (materiaInfo.idProfesor) {
                try {
                  const teacherDoc = await getDoc(doc(db, 'users', materiaInfo.idProfesor));
                  if (teacherDoc.exists()) {
                    const teacherData = teacherDoc.data();
                    teacherName = teacherData.displayName || teacherData.nombre || materiaInfo.idProfesor;
                  }
                } catch (error) {
                  console.error('Error obteniendo datos del profesor:', error);
                }
              }

              // Crear notificaciones para cada estudiante enrolado
              const notificationPromises = enrollmentsSnapshot.docs.map(async (enrollmentDoc) => {
                const enrollmentData = enrollmentDoc.data();
                const studentId = enrollmentData.studentId;
                
                // No crear notificación para el creador del cuaderno
                if (studentId === notebook.userId) {
                  return;
                }

                // Verificar si ya existe esta notificación
                const exists = await this.notificationExists(studentId, notebook.id, 'new_notebook');
                if (exists) {
                  console.log('Notificación ya existe para estudiante:', studentId);
                  return;
                }

                // Crear notificación
                const notificationData = {
                  type: 'new_notebook' as const,
                  title: `📚 Nuevo cuaderno: ${notebook.title}`,
                  message: `${teacherName} creó un nuevo cuaderno en ${materiaInfo.nombre}`,
                  materiaId: notebook.materiaId,
                  materiaName: materiaInfo.nombre,
                  teacherName,
                  createdAt: notebook.createdAt || Timestamp.now(),
                  isRead: false,
                  userId: studentId,
                  contentId: notebook.id
                };

                return this.saveNotification(notificationData);
              });

              await Promise.all(notificationPromises);
              console.log('✅ Notificaciones de cuaderno creadas para estudiantes enrolados');
            }
          });
        });

        this.listeners.push(unsubscribe);
        return unsubscribe;
      } catch (error) {
        console.error('Error configurando listener de cuadernos:', error);
      }
    };

    setupListener();
    
    // Retornar función de limpieza
    return () => {
      this.cleanup();
    };
  }

  // Listener para nuevos documentos - crea notificaciones para TODOS los estudiantes enrolados
  listenForNewDocuments(): () => void {
    const setupListener = async () => {
      try {
        // Obtener todas las materias para crear listeners
        const materiasSnapshot = await getDocs(collection(db, 'schoolSubjects'));
        
        materiasSnapshot.forEach(materiaDoc => {
          const materiaId = materiaDoc.id;
          const materiaData = materiaDoc.data();
          
          // Crear listener para documentos de esta materia
          const documentsQuery = query(
            collection(db, 'schoolSubjects', materiaId, 'documents'),
            orderBy('createdAt', 'desc'),
            limit(5) // Limitar para mejor rendimiento
          );

          const unsubscribe = onSnapshot(documentsQuery, async (snapshot) => {
            snapshot.docChanges().forEach(async (change) => {
              if (change.type === 'added') {
                const documentData = change.doc.data();
                const document = { id: change.doc.id, ...documentData } as any;
                
                // Solo procesar documentos recién creados (últimos 30 segundos)
                const thirtySecondsAgo = new Date(Date.now() - 30 * 1000);
                const documentCreatedAt = document.createdAt?.toDate() || new Date();
                
                if (documentCreatedAt <= thirtySecondsAgo) {
                  return; // No procesar documentos antiguos
                }

                console.log('🔔 Nuevo documento detectado:', document.title || document.name);

                // Buscar todos los estudiantes enrolados en esta materia
                const enrollmentsQuery = query(
                  collection(db, 'enrollments'),
                  where('subjectId', '==', materiaId)
                );
                
                const enrollmentsSnapshot = await getDocs(enrollmentsQuery);

                // Obtener nombre del profesor
                let teacherName = 'Profesor desconocido';
                if (materiaData.idProfesor) {
                  try {
                    const teacherDoc = await getDoc(doc(db, 'users', materiaData.idProfesor));
                    if (teacherDoc.exists()) {
                      const teacherData = teacherDoc.data();
                      teacherName = teacherData.displayName || teacherData.nombre || materiaData.idProfesor;
                    }
                  } catch (error) {
                    console.error('Error obteniendo datos del profesor:', error);
                  }
                }

                // Crear notificaciones para cada estudiante enrolado
                const notificationPromises = enrollmentsSnapshot.docs.map(async (enrollmentDoc) => {
                  const enrollmentData = enrollmentDoc.data();
                  const studentId = enrollmentData.studentId;
                  
                  // No crear notificación para quien subió el documento
                  if (studentId === document.uploadedBy) {
                    return;
                  }

                  // Verificar si ya existe esta notificación
                  const exists = await this.notificationExists(studentId, document.id, 'new_document');
                  if (exists) {
                    console.log('Notificación de documento ya existe para estudiante:', studentId);
                    return;
                  }

                  // Crear notificación
                  const notificationData = {
                    type: 'new_document' as const,
                    title: `📄 Nuevo documento: ${document.title || document.name}`,
                    message: `${teacherName} subió un nuevo documento en ${materiaData.nombre || 'la materia'}`,
                    materiaId: materiaId,
                    materiaName: materiaData.nombre || 'Materia desconocida',
                    teacherName,
                    createdAt: document.createdAt || Timestamp.now(),
                    isRead: false,
                    userId: studentId,
                    contentId: document.id
                  };

                  return this.saveNotification(notificationData);
                });

                await Promise.all(notificationPromises);
                console.log('✅ Notificaciones de documento creadas para estudiantes enrolados');
              }
            });
          });

          this.listeners.push(unsubscribe);
        });
      } catch (error) {
        console.error('Error configurando listener de documentos:', error);
      }
    };

    setupListener();
    
    // Retornar función de limpieza
    return () => {
      this.cleanup();
    };
  }

  // Método de prueba para crear notificación manualmente
  async testCreateConceptNotification(studentId: string, conceptId: string): Promise<void> {
    try {
      console.log('🧪 Creando notificación de prueba para estudiante:', studentId);
      
      const notificationData = {
        type: 'new_concept' as const,
        title: `📝 Nuevo concepto de prueba`,
        message: `Se ha agregado un nuevo concepto de prueba`,
        materiaId: 'test',
        materiaName: 'Materia de prueba',
        teacherName: 'Profesor de prueba',
        createdAt: Timestamp.now(),
        isRead: false,
        userId: studentId,
        contentId: conceptId
      };

      await this.saveNotification(notificationData);
      console.log('✅ Notificación de prueba creada exitosamente');
    } catch (error) {
      console.error('❌ Error creando notificación de prueba:', error);
    }
  }

  // Listener para nuevos conceptos - SOLO para profesores
  listenForNewConceptsAsTeacher(): () => void {
    const setupListener = async () => {
      try {
        // Verificar si el usuario actual es profesor
        const auth = getAuth();
        const user = auth.currentUser;
        
        if (!user) {
          console.log('⚠️ Usuario no autenticado, saltando listener de conceptos');
          return;
        }

        // Verificar si es profesor
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const isTeacher = userDoc.exists() && userDoc.data()?.isTeacher === true;
        
        if (!isTeacher) {
          console.log('👤 Usuario no es profesor, saltando listener de conceptos');
          return;
        }

        console.log('👩‍🏫 Usuario es profesor, configurando listener de conceptos...');
        
        // Crear listeners para ambas colecciones de conceptos
        const collections = ['conceptos', 'schoolConcepts'];
        
        collections.forEach(collectionName => {
          // Solo escuchar conceptos creados por este profesor
          const conceptsQuery = query(
            collection(db, collectionName),
            where('usuarioId', '==', user.uid), // Solo conceptos del profesor actual
            orderBy('createdAt', 'desc'),
            limit(5) // Limitar para mejor rendimiento
          );

          const unsubscribe = onSnapshot(conceptsQuery, async (snapshot) => {
            snapshot.docChanges().forEach(async (change) => {
              if (change.type === 'added') {
                const conceptData = change.doc.data();
                const concept = { id: change.doc.id, ...conceptData } as any;
                
                // Solo procesar conceptos recién creados (últimos 2 minutos)
                const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
                const conceptCreatedAt = concept.createdAt?.toDate() || new Date();
                
                if (conceptCreatedAt <= twoMinutesAgo) {
                  return; // No procesar conceptos antiguos
                }

                console.log('🔔 Nuevo concepto del profesor detectado:', {
                  concepto: concept.concepto || concept.title,
                  cuadernoId: concept.cuadernoId,
                  createdAt: conceptCreatedAt,
                  creatorId: concept.usuarioId || concept.userId
                });

                // Procesar notificaciones para estudiantes
                await this.processConceptNotifications(concept);
              }
            });
          });

          this.listeners.push(unsubscribe);
        });
      } catch (error) {
        console.error('Error configurando listener de conceptos del profesor:', error);
      }
    };

    setupListener();
    
    // Retornar función de limpieza
    return () => {
      this.cleanup();
    };
  }

  // Procesamiento de notificaciones para estudiantes (movido a método separado)
  private async processConceptNotifications(concept: any): Promise<void> {
    try {
      // Obtener información del cuaderno
      let notebookInfo = { materiaId: null, title: 'Cuaderno desconocido' };
      if (concept.cuadernoId) {
        try {
          // Buscar primero en notebooks
          let notebookDoc = await getDoc(doc(db, 'notebooks', concept.cuadernoId));
          if (!notebookDoc.exists()) {
            // Si no existe, buscar en schoolNotebooks
            notebookDoc = await getDoc(doc(db, 'schoolNotebooks', concept.cuadernoId));
          }
          
          if (notebookDoc.exists()) {
            const notebookData = notebookDoc.data();
            notebookInfo = {
              materiaId: notebookData.materiaId || notebookData.idMateria,
              title: notebookData.title || 'Cuaderno desconocido'
            };
          }
        } catch (error) {
          console.error('Error obteniendo información del cuaderno:', error);
        }
      }

      if (!notebookInfo.materiaId) {
        console.log('No se pudo obtener materiaId para el concepto, saltando notificación');
        return;
      }

      // Buscar todos los estudiantes enrolados en esta materia
      console.log('🔍 Buscando estudiantes enrolados en materia:', notebookInfo.materiaId);
      const enrollmentsQuery = query(
        collection(db, 'enrollments'),
        where('materiaId', '==', notebookInfo.materiaId)
      );
      
      const enrollmentsSnapshot = await getDocs(enrollmentsQuery);
      console.log(`📚 Encontrados ${enrollmentsSnapshot.size} estudiantes enrolados`);
      
      // Obtener información de la materia
      let materiaInfo = { nombre: 'Materia desconocida', idProfesor: '' };
      try {
        const materiaDoc = await getDoc(doc(db, 'materias', notebookInfo.materiaId));
        if (materiaDoc.exists()) {
          const materiaData = materiaDoc.data();
          materiaInfo = {
            nombre: materiaData.title || materiaData.nombre || 'Materia desconocida',
            idProfesor: materiaData.userId || ''
          };
        }
      } catch (error) {
        console.error('Error obteniendo información de materia:', error);
      }
      
      // Solo notificar si el creador del concepto es el profesor de la materia
      const conceptCreatorId = concept.usuarioId || concept.userId;
      if (conceptCreatorId !== materiaInfo.idProfesor) {
        console.log('⏭️ No se notifica - el creador no es el profesor de la materia');
        console.log('   Creador del concepto:', conceptCreatorId);
        console.log('   Profesor de la materia:', materiaInfo.idProfesor);
        return;
      }

      // Obtener nombre del profesor
      let teacherName = 'Profesor desconocido';
      if (materiaInfo.idProfesor) {
        try {
          const teacherDoc = await getDoc(doc(db, 'users', materiaInfo.idProfesor));
          if (teacherDoc.exists()) {
            const teacherData = teacherDoc.data();
            teacherName = teacherData.displayName || teacherData.nombre || materiaInfo.idProfesor;
          }
        } catch (error) {
          console.error('Error obteniendo datos del profesor:', error);
        }
      }

      // Crear notificaciones para cada estudiante enrolado
      const notificationPromises = enrollmentsSnapshot.docs.map(async (enrollmentDoc) => {
        const enrollmentData = enrollmentDoc.data();
        const studentId = enrollmentData.studentId;
        
        console.log('📨 Procesando notificación para estudiante:', studentId);
        
        // No crear notificación para el creador del concepto
        if (studentId === concept.usuarioId || studentId === concept.userId) {
          console.log('⏭️ Saltando notificación - el estudiante es el creador del concepto');
          return;
        }

        // Verificar si ya existe esta notificación
        const exists = await this.notificationExists(studentId, concept.id, 'new_concept');
        if (exists) {
          console.log('Notificación de concepto ya existe para estudiante:', studentId);
          return;
        }

        // Crear notificación
        const notificationData = {
          type: 'new_concept' as const,
          title: `📝 Nuevo concepto: ${concept.concepto || concept.title || 'Concepto'}`,
          message: `${teacherName} agregó un nuevo concepto en el cuaderno "${notebookInfo.title}" de ${materiaInfo.nombre}`,
          materiaId: notebookInfo.materiaId,
          materiaName: materiaInfo.nombre,
          teacherName,
          createdAt: concept.createdAt || Timestamp.now(),
          isRead: false,
          userId: studentId,
          contentId: concept.id
        };

        console.log('💾 Creando notificación para estudiante:', studentId);
        return this.saveNotification(notificationData);
      });

      await Promise.all(notificationPromises);
      console.log('✅ Notificaciones de concepto creadas para estudiantes enrolados');
    } catch (error) {
      console.error('Error procesando notificaciones de concepto:', error);
    }
  }

  // Listener para nuevos materiales - crea notificaciones para estudiantes enrolados
  listenForNewMaterials(): () => void {
    const setupListener = async () => {
      try {
        console.log('📎 Configurando listener para nuevos materiales...');
        
        // Crear listener para la colección materials
        const materialsQuery = query(
          collection(db, 'materials'),
          orderBy('createdAt', 'desc'),
          limit(10) // Limitar para mejor rendimiento
        );

        const unsubscribe = onSnapshot(materialsQuery, async (snapshot) => {
          snapshot.docChanges().forEach(async (change) => {
            if (change.type === 'added') {
              const materialData = change.doc.data();
              const material = { id: change.doc.id, ...materialData } as any;
              
              // Solo procesar materiales recién creados (últimos 30 segundos)
              const thirtySecondsAgo = new Date(Date.now() - 30 * 1000);
              const materialCreatedAt = material.createdAt?.toDate() || new Date();
              
              if (materialCreatedAt <= thirtySecondsAgo) {
                return; // No procesar materiales antiguos
              }

              console.log('🔔 Nuevo material detectado:', material.name || material.title);
              await this.processMaterialNotifications(material);
            }
          });
        });

        this.listeners.push(unsubscribe);
      } catch (error) {
        console.error('Error configurando listener de materiales:', error);
      }
    };

    setupListener();
    
    // Retornar función de limpieza
    return () => {
      this.cleanup();
    };
  }

  // Procesar notificaciones para un material específico
  private async processMaterialNotifications(material: any): Promise<void> {
    try {
      console.log('🔍 Procesando notificaciones para material:', material.name);

      // Obtener información del notebook del material
      if (!material.notebookId) {
        console.log('⚠️ Material sin notebookId, saltando notificaciones');
        return;
      }

      const notebookDoc = await getDoc(doc(db, 'notebooks', material.notebookId));
      if (!notebookDoc.exists()) {
        console.log('⚠️ Notebook no encontrado para el material:', material.notebookId);
        return;
      }

      const notebookInfo = notebookDoc.data();
      if (!notebookInfo.materiaId) {
        console.log('⚠️ Notebook sin materiaId, saltando notificaciones');
        return;
      }

      // Obtener información de la materia
      const materiaDoc = await getDoc(doc(db, 'schoolSubjects', notebookInfo.materiaId));
      if (!materiaDoc.exists()) {
        console.log('⚠️ Materia no encontrada:', notebookInfo.materiaId);
        return;
      }

      const materiaInfo = materiaDoc.data();

      // Buscar todos los estudiantes enrolados en esta materia
      const enrollmentsQuery = query(
        collection(db, 'enrollments'),
        where('subjectId', '==', notebookInfo.materiaId)
      );
      
      const enrollmentsSnapshot = await getDocs(enrollmentsQuery);

      // Obtener nombre del profesor
      let teacherName = 'Profesor desconocido';
      if (material.userId) {
        try {
          const teacherDoc = await getDoc(doc(db, 'users', material.userId));
          if (teacherDoc.exists()) {
            const teacherData = teacherDoc.data();
            teacherName = teacherData.displayName || teacherData.nombre || material.userId;
          }
        } catch (error) {
          console.error('Error obteniendo datos del profesor:', error);
        }
      }

      // Crear notificaciones para cada estudiante enrolado
      const notificationPromises = enrollmentsSnapshot.docs.map(async (enrollmentDoc) => {
        const enrollmentData = enrollmentDoc.data();
        const studentId = enrollmentData.studentId;
        
        // No crear notificación para quien subió el material
        if (studentId === material.userId) {
          return;
        }

        // Verificar si ya existe esta notificación
        const exists = await this.notificationExists(studentId, material.id, 'new_document');
        if (exists) {
          console.log('Notificación de material ya existe para estudiante:', studentId);
          return;
        }

        // Crear notificación
        const notificationData = {
          type: 'new_document' as const,
          title: `📎 Nuevo material: ${material.name || 'Material'}`,
          message: `${teacherName} subió un nuevo material en el cuaderno "${notebookInfo.title}" de ${materiaInfo.nombre}`,
          materiaId: notebookInfo.materiaId,
          materiaName: materiaInfo.nombre || 'Materia desconocida',
          teacherName,
          createdAt: material.createdAt || Timestamp.now(),
          isRead: false,
          userId: studentId,
          contentId: material.id
        };

        return this.saveNotification(notificationData);
      });

      await Promise.all(notificationPromises);
      console.log('✅ Notificaciones de material creadas para estudiantes enrolados');
    } catch (error) {
      console.error('Error procesando notificaciones de material:', error);
    }
  }


  // Limpiar todos los listeners
  cleanup(): void {
    this.listeners.forEach(unsubscribe => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    });
    this.listeners = [];
  }
}

export const notificationService = NotificationService.getInstance();