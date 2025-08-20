import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Chip,
  Avatar,
  Tooltip,
  Dialog,
  Divider,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Alert,
  CircularProgress,
  TablePagination,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid
} from '@mui/material';
import {
  Delete,
  Visibility,
  Search,
  PersonAdd,
  AccessTime,
  CheckCircle,
  Cancel,
  School,
  Email,
  CalendarToday,
  FilterList
} from '@mui/icons-material';
import { Enrollment, EnrollmentStatus, UserProfile, SchoolSubject } from '../types/interfaces';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  getDoc, 
  updateDoc, 
  deleteDoc,
  orderBy,
  Timestamp,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface EnrolledStudentsManagerProps {
  materiaId?: string;
  showTitle?: boolean;
}

const EnrolledStudentsManager: React.FC<EnrolledStudentsManagerProps> = ({
  materiaId,
  showTitle = true
}) => {
  const { user } = useAuth();
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [students, setStudents] = useState<Map<string, UserProfile>>(new Map());
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState<Enrollment | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<EnrollmentStatus | 'all'>('all');
  const [materias, setMaterias] = useState<SchoolSubject[]>([]);
  const [selectedMateria, setSelectedMateria] = useState(materiaId || '');
  
  // Paginación
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  useEffect(() => {
    loadData();
  }, [selectedMateria]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Si no hay materia específica, cargar todas las materias del profesor
      if (!materiaId && user) {
        const materiasQuery = query(
          collection(db, 'schoolSubjects'),
          where('idProfesor', '==', user.uid)
        );
        const materiasSnapshot = await getDocs(materiasQuery);
        const materiasData = materiasSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as SchoolSubject));
        setMaterias(materiasData);
        
        // Si no hay materia seleccionada y hay materias disponibles, seleccionar la primera
        if (!selectedMateria && materiasData.length > 0) {
          setSelectedMateria(materiasData[0].id);
        }
      }
      
      // Cargar inscripciones
      if (selectedMateria || materiaId) {
        await loadEnrollments(selectedMateria || materiaId!);
      }
    } catch (error) {
      console.error('Error cargando datos:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadEnrollments = async (materiaIdToLoad: string) => {
    try {
      const enrollmentsQuery = query(
        collection(db, 'enrollments'),
        where('materiaId', '==', materiaIdToLoad),
        where('teacherId', '==', user?.uid),
        orderBy('enrolledAt', 'desc')
      );
      
      const enrollmentsSnapshot = await getDocs(enrollmentsQuery);
      const enrollmentsData = enrollmentsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Enrollment));
      
      setEnrollments(enrollmentsData);
      
      // Cargar información de los estudiantes
      const studentIds = [...new Set(enrollmentsData.map(e => e.studentId))];
      const studentsMap = new Map<string, UserProfile>();
      
      for (const studentId of studentIds) {
        try {
          const studentDoc = await getDoc(doc(db, 'users', studentId));
          if (studentDoc.exists()) {
            studentsMap.set(studentId, {
              id: studentDoc.id,
              ...studentDoc.data()
            } as UserProfile);
          }
        } catch (error) {
          console.error(`Error cargando estudiante ${studentId}:`, error);
        }
      }
      
      setStudents(studentsMap);
    } catch (error) {
      console.error('Error cargando inscripciones:', error);
    }
  };

  const handleUpdateLastAccess = async (enrollmentId: string) => {
    try {
      await updateDoc(doc(db, 'enrollments', enrollmentId), {
        lastAccessedAt: serverTimestamp()
      });
      
      // Actualizar localmente
      setEnrollments(enrollments.map(e => 
        e.id === enrollmentId 
          ? { ...e, lastAccessedAt: Timestamp.now() }
          : e
      ));
    } catch (error) {
      console.error('Error actualizando último acceso:', error);
    }
  };

  const handleUpdateStatus = async (enrollmentId: string, newStatus: EnrollmentStatus) => {
    try {
      const updates: any = {
        status: newStatus
      };
      
      if (newStatus === EnrollmentStatus.COMPLETED) {
        updates.completedAt = serverTimestamp();
      }
      
      await updateDoc(doc(db, 'enrollments', enrollmentId), updates);
      
      // Actualizar localmente
      setEnrollments(enrollments.map(e => 
        e.id === enrollmentId 
          ? { 
              ...e, 
              status: newStatus,
              ...(newStatus === EnrollmentStatus.COMPLETED && { completedAt: Timestamp.now() })
            }
          : e
      ));
    } catch (error) {
      console.error('Error actualizando estado:', error);
    }
  };

  const handleRemoveStudent = async (enrollmentId: string) => {
    if (!window.confirm('¿Estás seguro de remover este estudiante de la materia?')) {
      return;
    }
    
    try {
      await deleteDoc(doc(db, 'enrollments', enrollmentId));
      setEnrollments(enrollments.filter(e => e.id !== enrollmentId));
    } catch (error) {
      console.error('Error removiendo estudiante:', error);
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Nunca';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return format(date, 'dd MMM yyyy HH:mm', { locale: es });
  };

  const formatRelativeTime = (timestamp: any) => {
    if (!timestamp) return 'Nunca';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInHours / 24);
    
    if (diffInDays > 30) return `Hace ${Math.floor(diffInDays / 30)} meses`;
    if (diffInDays > 0) return `Hace ${diffInDays} días`;
    if (diffInHours > 0) return `Hace ${diffInHours} horas`;
    return 'Hace menos de 1 hora';
  };

  const getStatusColor = (status: EnrollmentStatus) => {
    switch (status) {
      case EnrollmentStatus.ACTIVE:
        return 'success';
      case EnrollmentStatus.INACTIVE:
        return 'error';
      case EnrollmentStatus.PENDING:
        return 'warning';
      case EnrollmentStatus.COMPLETED:
        return 'info';
      default:
        return 'default';
    }
  };

  const getStatusLabel = (status: EnrollmentStatus) => {
    switch (status) {
      case EnrollmentStatus.ACTIVE:
        return 'Activo';
      case EnrollmentStatus.INACTIVE:
        return 'Inactivo';
      case EnrollmentStatus.PENDING:
        return 'Pendiente';
      case EnrollmentStatus.COMPLETED:
        return 'Completado';
      default:
        return status;
    }
  };

  // Filtrar inscripciones
  const filteredEnrollments = enrollments.filter(enrollment => {
    const student = students.get(enrollment.studentId);
    const matchesSearch = searchTerm === '' || 
      student?.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      enrollment.studentEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      enrollment.studentName?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || enrollment.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Calcular estadísticas
  const stats = {
    total: enrollments.length,
    active: enrollments.filter(e => e.status === EnrollmentStatus.ACTIVE).length,
    inactive: enrollments.filter(e => e.status === EnrollmentStatus.INACTIVE).length,
    pending: enrollments.filter(e => e.status === EnrollmentStatus.PENDING).length,
    completed: enrollments.filter(e => e.status === EnrollmentStatus.COMPLETED).length
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={3}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {showTitle && (
        <Typography variant="h5" gutterBottom>
          Estudiantes Inscritos
        </Typography>
      )}

      {/* Selector de materia si no se especificó una */}
      {!materiaId && materias.length > 0 && (
        <FormControl fullWidth margin="normal">
          <InputLabel>Materia</InputLabel>
          <Select
            value={selectedMateria}
            onChange={(e) => setSelectedMateria(e.target.value)}
            label="Materia"
          >
            {materias.map((materia) => (
              <MenuItem key={materia.id} value={materia.id}>
                {materia.nombre}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      )}

      {/* Estadísticas */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <Typography variant="h4">{stats.total}</Typography>
              <Typography variant="body2" color="text.secondary">
                Total Estudiantes
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 4 }}>
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <Typography variant="h4" color="success.main">{stats.active}</Typography>
              <Typography variant="body2" color="text.secondary">
                Activos
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 4 }}>
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <Typography variant="h4" color="warning.main">{stats.pending}</Typography>
              <Typography variant="body2" color="text.secondary">
                Pendientes
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filtros */}
      <Box display="flex" gap={2} mb={2}>
        <TextField
          placeholder="Buscar estudiante..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search />
              </InputAdornment>
            )
          }}
          sx={{ flexGrow: 1 }}
        />
        
        <FormControl sx={{ minWidth: 150 }}>
          <InputLabel>Estado</InputLabel>
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as EnrollmentStatus | 'all')}
            label="Estado"
            startAdornment={<FilterList sx={{ mr: 1, ml: 1 }} />}
          >
            <MenuItem value="all">Todos</MenuItem>
            <MenuItem value={EnrollmentStatus.ACTIVE}>Activos</MenuItem>
            <MenuItem value={EnrollmentStatus.INACTIVE}>Inactivos</MenuItem>
            <MenuItem value={EnrollmentStatus.PENDING}>Pendientes</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {/* Tabla de estudiantes */}
      {filteredEnrollments.length === 0 ? (
        <Alert severity="info">
          {searchTerm || statusFilter !== 'all' 
            ? 'No se encontraron estudiantes con los filtros aplicados'
            : 'No hay estudiantes inscritos en esta materia. Comparte el código de invitación para que se unan.'}
        </Alert>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Estudiante</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell>Inscrito</TableCell>
                <TableCell>Último Acceso</TableCell>
                <TableCell align="center">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredEnrollments
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((enrollment) => {
                  const student = students.get(enrollment.studentId);
                  return (
                    <TableRow key={enrollment.id}>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={1}>
                          <Avatar sx={{ width: 32, height: 32 }}>
                            {(student?.displayName || enrollment.studentName || 'S')[0].toUpperCase()}
                          </Avatar>
                          <Typography variant="body2">
                            {student?.displayName || enrollment.studentName || 'Sin nombre'}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {student?.email || enrollment.studentEmail || 'Sin email'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={getStatusLabel(enrollment.status)}
                          color={getStatusColor(enrollment.status) as any}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {formatDate(enrollment.enrolledAt)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box>
                          <Typography variant="body2">
                            {formatRelativeTime(enrollment.lastAccessedAt)}
                          </Typography>
                          {enrollment.lastAccessedAt && (
                            <Typography variant="caption" color="text.secondary">
                              {formatDate(enrollment.lastAccessedAt)}
                            </Typography>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell align="center">
                        <Box display="flex" justifyContent="center" gap={1}>
                          <Tooltip title="Ver detalles">
                            <IconButton
                              size="small"
                              onClick={() => {
                                setSelectedStudent(enrollment);
                                setDetailsDialogOpen(true);
                              }}
                            >
                              <Visibility />
                            </IconButton>
                          </Tooltip>
                          
                          {enrollment.status === EnrollmentStatus.ACTIVE && (
                            <Tooltip title="Marcar como inactivo">
                              <IconButton
                                size="small"
                                color="warning"
                                onClick={() => handleUpdateStatus(enrollment.id, EnrollmentStatus.INACTIVE)}
                              >
                                <Cancel />
                              </IconButton>
                            </Tooltip>
                          )}
                          
                          {enrollment.status === EnrollmentStatus.INACTIVE && (
                            <Tooltip title="Marcar como activo">
                              <IconButton
                                size="small"
                                color="success"
                                onClick={() => handleUpdateStatus(enrollment.id, EnrollmentStatus.ACTIVE)}
                              >
                                <CheckCircle />
                              </IconButton>
                            </Tooltip>
                          )}
                          
                          <Tooltip title="Remover estudiante">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleRemoveStudent(enrollment.id)}
                            >
                              <Delete />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
          
          <TablePagination
            rowsPerPageOptions={[5, 10, 25]}
            component="div"
            count={filteredEnrollments.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={(e, newPage) => setPage(newPage)}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
            labelRowsPerPage="Filas por página"
          />
        </TableContainer>
      )}

      {/* Dialog de detalles del estudiante */}
      <Dialog
        open={detailsDialogOpen}
        onClose={() => setDetailsDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Detalles del Estudiante
        </DialogTitle>
        <DialogContent>
          {selectedStudent && (
            <Box sx={{ pt: 2 }}>
              <Box display="flex" alignItems="center" gap={2} mb={3}>
                <Avatar sx={{ width: 60, height: 60 }}>
                  {(students.get(selectedStudent.studentId)?.displayName || 
                    selectedStudent.studentName || 'S')[0].toUpperCase()}
                </Avatar>
                <Box>
                  <Typography variant="h6">
                    {students.get(selectedStudent.studentId)?.displayName || 
                     selectedStudent.studentName || 'Sin nombre'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {students.get(selectedStudent.studentId)?.email || 
                     selectedStudent.studentEmail || 'Sin email'}
                  </Typography>
                </Box>
              </Box>
              
              <Divider sx={{ my: 2 }} />
              
              <Grid container spacing={2}>
                <Grid size={12}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <School color="action" />
                    <Typography variant="body2" color="text.secondary">
                      Materia:
                    </Typography>
                    <Typography variant="body2">
                      {selectedStudent.materiaName}
                    </Typography>
                  </Box>
                </Grid>
                
                <Grid size={12}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <CalendarToday color="action" />
                    <Typography variant="body2" color="text.secondary">
                      Inscrito:
                    </Typography>
                    <Typography variant="body2">
                      {formatDate(selectedStudent.enrolledAt)}
                    </Typography>
                  </Box>
                </Grid>
                
                <Grid size={12}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <AccessTime color="action" />
                    <Typography variant="body2" color="text.secondary">
                      Último acceso:
                    </Typography>
                    <Typography variant="body2">
                      {selectedStudent.lastAccessedAt 
                        ? formatDate(selectedStudent.lastAccessedAt)
                        : 'Nunca'}
                    </Typography>
                  </Box>
                </Grid>
                
                {selectedStudent.inviteCode && (
                  <Grid size={12}>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography variant="body2" color="text.secondary">
                        Código usado:
                      </Typography>
                      <Chip label={selectedStudent.inviteCode} size="small" />
                    </Box>
                  </Grid>
                )}
                
                {selectedStudent.completedAt && (
                  <Grid size={12}>
                    <Box display="flex" alignItems="center" gap={1}>
                      <CheckCircle color="success" />
                      <Typography variant="body2" color="text.secondary">
                        Completado:
                      </Typography>
                      <Typography variant="body2">
                        {formatDate(selectedStudent.completedAt)}
                      </Typography>
                    </Box>
                  </Grid>
                )}
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsDialogOpen(false)}>
            Cerrar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default EnrolledStudentsManager;