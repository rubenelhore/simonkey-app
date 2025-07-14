import { db } from './firebase';
import { 
  doc, 
  setDoc, 
  collection, 
  query, 
  where, 
  getDocs,
  getDoc,
  Timestamp
} from 'firebase/firestore';

interface TeacherMetrics {
  global: {
    porcentajeDominioConceptos: number;
    tiempoEfectivo: number;
    tiempoActivo: number;
    estudioPromedio: number;
    scorePromedio: number;
    totalAlumnos: number;
    totalMaterias: number;
    totalCuadernos: number;
    ultimaActualizacion: Timestamp;
  };
  materias: {
    [materiaId: string]: {
      nombreMateria: string;
      porcentajeDominioConceptos: number;
      tiempoEfectivo: number;
      tiempoActivo: number;
      estudioPromedio: number;
      scorePromedio: number;
      totalAlumnos: number;
      totalCuadernos: number;
    };
  };
  cuadernos: {
    [cuadernoId: string]: {
      nombreCuaderno: string;
      materiaId: string;
      scorePromedio: number;
      porcentajeDominioConceptos: number;
      tiempoEfectivo: number;
      tiempoActivo: number;
      estudioPromedio: number;
      totalAlumnos: number;
      conceptosDominados: number;
      conceptosTotales: number;
    };
  };
  tiempoEstudioSemanal: {
    lunes: number;
    martes: number;
    miercoles: number;
    jueves: number;
    viernes: number;
    sabado: number;
    domingo: number;
  };
}

export class TeacherKpiService {
  private static instance: TeacherKpiService;

  private constructor() {}

  static getInstance(): TeacherKpiService {
    if (!TeacherKpiService.instance) {
      TeacherKpiService.instance = new TeacherKpiService();
    }
    return TeacherKpiService.instance;
  }

  /**
   * Calcula y actualiza las métricas de un profesor
   */
  async updateTeacherMetrics(teacherUid: string, userProfile?: any): Promise<void> {
    try {
      console.log(`[TeacherKpiService] Actualizando métricas para profesor UID: ${teacherUid}`);

      let teacherData: any;
      let teacherId: string;
      
      // Si se proporciona userProfile, usarlo en lugar de buscar en la BD
      if (userProfile) {
        teacherData = userProfile;
        teacherId = userProfile.id || teacherUid;
        console.log('[TeacherKpiService] Usando userProfile desde contexto:', teacherData);
      } else {
        // 1. Obtener datos del profesor
        const teacherDoc = await getDoc(doc(db, 'users', teacherUid));
        if (!teacherDoc.exists()) {
          console.error('[TeacherKpiService] Profesor no encontrado');
          return;
        }
        teacherData = teacherDoc.data();
        teacherId = teacherData.id || teacherUid;
      }
      
      console.log('[TeacherKpiService] Datos del profesor:', teacherData);
      console.log('[TeacherKpiService] ID del documento del profesor:', teacherId);
      
      // Buscar el ID de la institución en múltiples campos posibles
      let institutionId = teacherData.idEscuela || teacherData.idInstitucion || teacherData.schoolData?.idEscuela;
      console.log('[TeacherKpiService] ID Institución encontrado:', institutionId);
      console.log('[TeacherKpiService] Fuente del ID:', 
        teacherData.idEscuela ? 'idEscuela' : 
        teacherData.idInstitucion ? 'idInstitucion' : 
        teacherData.schoolData?.idEscuela ? 'schoolData.idEscuela' : 'ninguno');

      // Si el profesor no tiene idInstitucion directamente, obtenerlo del admin
      if (!institutionId && teacherData.idAdmin) {
        console.log('[TeacherKpiService] Obteniendo institución del admin:', teacherData.idAdmin);
        
        // Intentar buscar en varias colecciones posibles
        let adminDoc = await getDoc(doc(db, 'users', teacherData.idAdmin));
        
        if (!adminDoc.exists()) {
          console.log('[TeacherKpiService] Admin no encontrado en users, buscando en schoolAdmins...');
          adminDoc = await getDoc(doc(db, 'schoolAdmins', teacherData.idAdmin));
        }
        
        if (!adminDoc.exists()) {
          console.log('[TeacherKpiService] Admin no encontrado en schoolAdmins, buscando en schoolUsers...');
          adminDoc = await getDoc(doc(db, 'schoolUsers', teacherData.idAdmin));
        }
        
        console.log('[TeacherKpiService] Admin doc exists:', adminDoc.exists());
        if (adminDoc.exists()) {
          const adminData = adminDoc.data();
          console.log('[TeacherKpiService] Admin data:', adminData);
          institutionId = adminData.idEscuela || adminData.idInstitucion;
          console.log('[TeacherKpiService] Institución obtenida del admin:', institutionId);
        } else {
          console.error('[TeacherKpiService] Admin document not found:', teacherData.idAdmin);
        }
      }

      if (!institutionId) {
        console.warn('[TeacherKpiService] Profesor sin institución (ni directa ni a través del admin), continuando con búsqueda por cuadernos');
      }

      // 2. Obtener todas las materias del profesor
      const subjectsQuery = query(
        collection(db, 'schoolSubjects'),
        where('idProfesor', '==', teacherId)
      );
      const subjectsSnap = await getDocs(subjectsQuery);
      console.log(`[TeacherKpiService] Materias del profesor: ${subjectsSnap.size}`);
      console.log(`[TeacherKpiService] Query: schoolSubjects where idProfesor == ${teacherId}`);
      console.log(`[TeacherKpiService] Institución ID usado para filtrar estudiantes: ${institutionId}`);

      const subjectIds = subjectsSnap.docs.map(doc => doc.id);
      const subjectsMap = new Map<string, any>();
      subjectsSnap.forEach(doc => {
        const data = doc.data();
        console.log(`[TeacherKpiService] Materia ${doc.id}:`, data);
        subjectsMap.set(doc.id, { id: doc.id, ...data });
      });

      // 3. Obtener todos los cuadernos de las materias del profesor
      const allNotebooks: any[] = [];
      const notebooksBySubject = new Map<string, string[]>();

      for (const subjectId of subjectIds) {
        const notebooksQuery = query(
          collection(db, 'schoolNotebooks'),
          where('idMateria', '==', subjectId)
        );
        const notebooksSnap = await getDocs(notebooksQuery);
        
        const notebookIds: string[] = [];
        notebooksSnap.forEach(doc => {
          allNotebooks.push({ id: doc.id, ...doc.data() });
          notebookIds.push(doc.id);
        });
        
        notebooksBySubject.set(subjectId, notebookIds);
      }

      console.log(`[TeacherKpiService] Total de cuadernos: ${allNotebooks.length}`);

      // 4. Obtener todos los estudiantes que tienen estos cuadernos
      const studentIds = new Set<string>();
      let studentsSnap;
      const studentsByNotebook = new Map<string, string[]>();
      
      if (institutionId) {
        // Si tenemos ID de institución, buscar por institución
        const studentsQuery = query(
          collection(db, 'users'),
          where('subscription', '==', 'school'),
          where('schoolRole', '==', 'student'),
          where('idEscuela', '==', institutionId)
        );
        studentsSnap = await getDocs(studentsQuery);
        console.log(`[TeacherKpiService] Estudiantes encontrados por idEscuela: ${studentsSnap.size}`);
      } else {
        // Si no tenemos ID de institución, buscar todos los estudiantes escolares
        const studentsQuery = query(
          collection(db, 'users'),
          where('subscription', '==', 'school'),
          where('schoolRole', '==', 'student')
        );
        studentsSnap = await getDocs(studentsQuery);
        console.log(`[TeacherKpiService] Estudiantes escolares totales encontrados: ${studentsSnap.size}`);
      }

      // Filtrar estudiantes que tienen cuadernos del profesor
      for (const studentDoc of studentsSnap.docs) {
        const studentData = studentDoc.data();
        const studentNotebooks = studentData.idCuadernos || [];
        
        // Verificar si el estudiante tiene algún cuaderno del profesor
        let hasTeacherNotebook = false;
        for (const notebook of allNotebooks) {
          if (studentNotebooks.includes(notebook.id)) {
            hasTeacherNotebook = true;
            
            // Agregar estudiante a la lista del cuaderno
            if (!studentsByNotebook.has(notebook.id)) {
              studentsByNotebook.set(notebook.id, []);
            }
            studentsByNotebook.get(notebook.id)!.push(studentDoc.id);
          }
        }
        
        if (hasTeacherNotebook) {
          studentIds.add(studentDoc.id);
        }
      }

      console.log(`[TeacherKpiService] Estudiantes con cuadernos del profesor: ${studentIds.size}`);

      // 5. Inicializar estructura de métricas
      const metrics: TeacherMetrics = {
        global: {
          porcentajeDominioConceptos: 0,
          tiempoEfectivo: 0,
          tiempoActivo: 0,
          estudioPromedio: 0,
          scorePromedio: 0,
          totalAlumnos: studentIds.size,
          totalMaterias: subjectIds.length,
          totalCuadernos: allNotebooks.length,
          ultimaActualizacion: Timestamp.now()
        },
        materias: {},
        cuadernos: {},
        tiempoEstudioSemanal: {
          lunes: 0,
          martes: 0,
          miercoles: 0,
          jueves: 0,
          viernes: 0,
          sabado: 0,
          domingo: 0
        }
      };

      // 6. Calcular métricas por cuaderno
      let globalConceptsDominated = 0;
      let globalConceptsTotal = 0;
      let globalTotalScore = 0;
      let globalActiveTime = 0;
      let globalStudySessions = 0;
      let studentsWithData = 0;

      for (const notebook of allNotebooks) {
        const notebookStudents = studentsByNotebook.get(notebook.id) || [];
        
        let notebookScore = 0;
        let notebookConceptsDominated = 0;
        let notebookConceptsTotal = 0;
        let notebookActiveTime = 0;
        let notebookStudySessions = 0;
        let studentsWithNotebookData = 0;

        // Obtener número total de conceptos del cuaderno
        const conceptsQuery = query(
          collection(db, 'schoolConcepts'),
          where('cuadernoId', '==', notebook.id)
        );
        const conceptsSnap = await getDocs(conceptsQuery);
        let totalConcepts = 0;
        conceptsSnap.forEach(doc => {
          const data = doc.data();
          if (data.conceptos && Array.isArray(data.conceptos)) {
            totalConcepts += data.conceptos.length;
          }
        });

        // Calcular métricas de cada estudiante para este cuaderno
        for (const studentId of notebookStudents) {
          // Obtener KPIs del estudiante
          const studentKpisDoc = await getDoc(doc(db, 'users', studentId, 'kpis', 'dashboard'));
          
          if (studentKpisDoc.exists()) {
            const kpisData = studentKpisDoc.data();
            const notebookKpis = kpisData.cuadernos?.[notebook.id];
            
            if (notebookKpis) {
              studentsWithNotebookData++;
              notebookScore += notebookKpis.scoreCuaderno || 0;
              notebookConceptsDominated += notebookKpis.conceptosDominados || 0;
              notebookConceptsTotal += totalConcepts;
              notebookActiveTime += notebookKpis.tiempoEstudioLocal || 0;
              notebookStudySessions += notebookKpis.estudiosInteligentesLocal || 0;
            }
          }

          // Obtener sesiones de estudio para tiempo semanal
          const oneWeekAgo = new Date();
          oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
          
          const sessionsQuery = query(
            collection(db, 'studySessions'),
            where('userId', '==', studentId),
            where('notebookId', '==', notebook.id),
            where('startTime', '>=', oneWeekAgo)
          );
          
          const sessionsSnap = await getDocs(sessionsQuery);
          sessionsSnap.forEach(sessionDoc => {
            const session = sessionDoc.data();
            if (session.startTime) {
              const date = session.startTime.toDate();
              const dayName = date.toLocaleDateString('es-ES', { weekday: 'long' })
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remover acentos
                .toLowerCase(); // Asegurar minúsculas
              
              const duration = session.metrics?.sessionDuration || 0;
              const durationInMinutes = Math.round(duration / 60);
              
              if (metrics.tiempoEstudioSemanal.hasOwnProperty(dayName)) {
                metrics.tiempoEstudioSemanal[dayName as keyof typeof metrics.tiempoEstudioSemanal] += durationInMinutes;
              }
            }
          });
        }

        // Calcular promedios del cuaderno
        const avgScore = studentsWithNotebookData > 0 
          ? Math.round(notebookScore / studentsWithNotebookData) 
          : 0;
        
        const dominioPercentage = notebookConceptsTotal > 0
          ? Math.round((notebookConceptsDominated / notebookConceptsTotal) * 100)
          : 0;

        const avgActiveTime = studentsWithNotebookData > 0
          ? Math.round(notebookActiveTime / studentsWithNotebookData)
          : 0;

        const avgStudySessions = studentsWithNotebookData > 0
          ? Math.round(notebookStudySessions / studentsWithNotebookData)
          : 0;

        // Tiempo efectivo: tiempo promedio por concepto
        const effectiveTime = totalConcepts > 0 && notebookActiveTime > 0
          ? Math.round(notebookActiveTime / totalConcepts)
          : 0;

        metrics.cuadernos[notebook.id] = {
          nombreCuaderno: notebook.title,
          materiaId: notebook.idMateria,
          scorePromedio: avgScore,
          porcentajeDominioConceptos: dominioPercentage,
          tiempoEfectivo: effectiveTime,
          tiempoActivo: avgActiveTime,
          estudioPromedio: avgStudySessions,
          totalAlumnos: notebookStudents.length,
          conceptosDominados: notebookConceptsDominated,
          conceptosTotales: notebookConceptsTotal
        };

        // Sumar a totales globales
        if (studentsWithNotebookData > 0) {
          globalConceptsDominated += notebookConceptsDominated;
          globalConceptsTotal += notebookConceptsTotal;
          globalTotalScore += notebookScore;
          globalActiveTime += notebookActiveTime;
          globalStudySessions += notebookStudySessions;
          studentsWithData = Math.max(studentsWithData, studentsWithNotebookData);
        }
      }

      // 7. Calcular métricas por materia
      for (const [subjectId, subject] of subjectsMap) {
        const subjectNotebooks = notebooksBySubject.get(subjectId) || [];
        
        let subjectScore = 0;
        let subjectConceptsDominated = 0;
        let subjectConceptsTotal = 0;
        let subjectActiveTime = 0;
        let subjectStudySessions = 0;
        let subjectStudents = new Set<string>();

        for (const notebookId of subjectNotebooks) {
          const notebookMetrics = metrics.cuadernos[notebookId];
          if (notebookMetrics) {
            subjectScore += notebookMetrics.scorePromedio * notebookMetrics.totalAlumnos;
            subjectConceptsDominated += notebookMetrics.conceptosDominados;
            subjectConceptsTotal += notebookMetrics.conceptosTotales;
            subjectActiveTime += notebookMetrics.tiempoActivo * notebookMetrics.totalAlumnos;
            subjectStudySessions += notebookMetrics.estudioPromedio * notebookMetrics.totalAlumnos;
            
            // Contar estudiantes únicos
            const notebookStudentList = studentsByNotebook.get(notebookId) || [];
            notebookStudentList.forEach(s => subjectStudents.add(s));
          }
        }

        const totalSubjectStudents = subjectStudents.size;
        
        metrics.materias[subjectId] = {
          nombreMateria: subject.nombre || subject.name || subject.title || 'Sin nombre',
          porcentajeDominioConceptos: subjectConceptsTotal > 0 
            ? Math.round((subjectConceptsDominated / subjectConceptsTotal) * 100) 
            : 0,
          tiempoEfectivo: subjectConceptsTotal > 0 
            ? Math.round(subjectActiveTime / subjectConceptsTotal) 
            : 0,
          tiempoActivo: totalSubjectStudents > 0 
            ? Math.round(subjectActiveTime / totalSubjectStudents) 
            : 0,
          estudioPromedio: totalSubjectStudents > 0 
            ? Math.round(subjectStudySessions / totalSubjectStudents) 
            : 0,
          scorePromedio: totalSubjectStudents > 0 
            ? Math.round(subjectScore / totalSubjectStudents) 
            : 0,
          totalAlumnos: totalSubjectStudents,
          totalCuadernos: subjectNotebooks.length
        };
      }

      // 8. Calcular métricas globales
      metrics.global.porcentajeDominioConceptos = globalConceptsTotal > 0
        ? Math.round((globalConceptsDominated / globalConceptsTotal) * 100)
        : 0;

      metrics.global.tiempoEfectivo = globalConceptsTotal > 0
        ? Math.round(globalActiveTime / globalConceptsTotal)
        : 0;

      metrics.global.tiempoActivo = studentIds.size > 0
        ? Math.round(globalActiveTime / studentIds.size)
        : 0;

      metrics.global.estudioPromedio = studentIds.size > 0
        ? Math.round(globalStudySessions / studentIds.size)
        : 0;

      metrics.global.scorePromedio = studentsWithData > 0
        ? Math.round(globalTotalScore / studentsWithData)
        : 0;

      // 9. Guardar métricas en Firestore (usar el UID para el documento)
      await setDoc(doc(db, 'teacherKpis', teacherUid), metrics);

      console.log(`[TeacherKpiService] Métricas actualizadas exitosamente para profesor UID: ${teacherUid}`);
      console.log(`[TeacherKpiService] Resumen:`, {
        materias: Object.keys(metrics.materias).length,
        cuadernos: Object.keys(metrics.cuadernos).length,
        alumnos: metrics.global.totalAlumnos,
        dominioGlobal: metrics.global.porcentajeDominioConceptos + '%'
      });

    } catch (error) {
      console.error('[TeacherKpiService] Error actualizando métricas del profesor:', error);
      throw error;
    }
  }

  /**
   * Obtiene las métricas de un profesor
   */
  async getTeacherMetrics(teacherId: string): Promise<TeacherMetrics | null> {
    try {
      const metricsDoc = await getDoc(doc(db, 'teacherKpis', teacherId));
      
      if (metricsDoc.exists()) {
        return metricsDoc.data() as TeacherMetrics;
      }
      
      return null;
    } catch (error) {
      console.error('[TeacherKpiService] Error obteniendo métricas:', error);
      throw error;
    }
  }
}

// Exportar instancia única
export const teacherKpiService = TeacherKpiService.getInstance();