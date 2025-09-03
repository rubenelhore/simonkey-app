import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../services/firebase';
import { globalNotificationListener } from '../services/globalNotificationListener';

// Debug del sistema de notificaciones
(window as any).debugNotifications = async () => {
  console.log('🔍 === DEBUG SISTEMA DE NOTIFICACIONES ===');
  
  try {
    // 1. Verificar si los listeners globales están inicializados
    const isInitialized = globalNotificationListener.getInitializationStatus();
    console.log('📡 Listeners globales inicializados:', isInitialized);
    
    // 2. Verificar cuántas materias existen
    const materiasSnapshot = await getDocs(collection(db, 'schoolSubjects'));
    console.log('📚 Total de materias (schoolSubjects):', materiasSnapshot.size);
    
    // 3. Listar todas las materias con documentos
    let totalDocuments = 0;
    for (const materiaDoc of materiasSnapshot.docs) {
      const materiaId = materiaDoc.id;
      const materiaData = materiaDoc.data();
      
      try {
        const documentsSnapshot = await getDocs(
          collection(db, 'schoolSubjects', materiaId, 'documents')
        );
        
        if (documentsSnapshot.size > 0) {
          console.log(`📄 Materia "${materiaData.nombre || materiaId}" tiene ${documentsSnapshot.size} documentos`);
          totalDocuments += documentsSnapshot.size;
          
          // Mostrar los últimos 3 documentos
          const recentDocs = await getDocs(
            query(
              collection(db, 'schoolSubjects', materiaId, 'documents'),
              orderBy('createdAt', 'desc'),
              limit(3)
            )
          );
          
          recentDocs.forEach((docSnap, index) => {
            const docData = docSnap.data();
            const createdAt = docData.createdAt?.toDate();
            console.log(`  ${index + 1}. ${docData.title || docData.name} - ${createdAt?.toLocaleString()}`);
          });
        }
      } catch (error) {
        console.log(`❌ Error obteniendo documentos de materia ${materiaId}:`, error);
      }
    }
    
    console.log('📄 Total documentos encontrados:', totalDocuments);
    
    // 4. Verificar enrollments del usuario actual
    const user = (window as any).firebase?.auth?.currentUser;
    if (user) {
      const enrollmentsSnapshot = await getDocs(
        query(collection(db, 'enrollments'), where('studentId', '==', user.uid))
      );
      
      console.log(`👨‍🎓 Usuario ${user.email} está enrolado en ${enrollmentsSnapshot.size} materias:`);
      
      enrollmentsSnapshot.forEach(enrollDoc => {
        const enrollData = enrollDoc.data();
        console.log(`  - Materia: ${enrollData.subjectId} (${enrollData.status})`);
      });
    }
    
    // 5. Verificar notificaciones existentes
    if (user) {
      const notificationsSnapshot = await getDocs(
        query(
          collection(db, 'notifications'),
          where('userId', '==', user.uid),
          orderBy('createdAt', 'desc'),
          limit(5)
        )
      );
      
      console.log(`🔔 Usuario tiene ${notificationsSnapshot.size} notificaciones:`);
      
      notificationsSnapshot.forEach((notifDoc, index) => {
        const notifData = notifDoc.data();
        const createdAt = notifData.createdAt?.toDate();
        console.log(`  ${index + 1}. [${notifData.type}] ${notifData.title} - ${createdAt?.toLocaleString()} - Leída: ${notifData.isRead}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error en debug de notificaciones:', error);
  }
  
  console.log('🔍 === FIN DEBUG ===');
};

// Auto-ejecutar en desarrollo
if (process.env.NODE_ENV === 'development') {
  console.log('🔧 Debug de notificaciones disponible: debugNotifications()');
}