import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Card,
  CardContent,
  Typography,
  Button,
  CircularProgress,
  Alert,
  TextField,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Avatar,
  Chip,
  Divider,
  Paper
} from '@mui/material';
import {
  School,
  PersonAdd,
  CheckCircle,
  Error,
  Login,
  AppRegistration,
  Book,
  Person
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { validateInviteCode, useInviteCode } from '../services/invitationService';
import { InviteCode, UserProfile } from '../types/interfaces';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../services/firebase';

const JoinWithInvitePage: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [inviteCode, setInviteCode] = useState<InviteCode | null>(null);
  const [teacherInfo, setTeacherInfo] = useState<Partial<UserProfile> | null>(null);
  const [error, setError] = useState<string>('');
  const [activeStep, setActiveStep] = useState(0);
  const [enrolling, setEnrolling] = useState(false);
  
  // Estado para registro de nuevo usuario
  const [registrationData, setRegistrationData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    nombre: '',
    username: '',
    birthdate: ''
  });
  const [registrationErrors, setRegistrationErrors] = useState<any>({});

  useEffect(() => {
    if (code) {
      validateCode();
    }
  }, [code]);

  const validateCode = async () => {
    try {
      setLoading(true);
      const validation = await validateInviteCode(code!);
      
      if (!validation.isValid || !validation.inviteCode) {
        setError(validation.error || 'Código de invitación no válido');
        return;
      }
      
      setInviteCode(validation.inviteCode);
      
      // Cargar información del profesor
      const teacherDoc = await getDoc(doc(db, 'users', validation.inviteCode.teacherId));
      if (teacherDoc.exists()) {
        setTeacherInfo(teacherDoc.data() as UserProfile);
      }
      
      // Determinar el paso inicial
      if (user && userProfile) {
        setActiveStep(1); // Ya está autenticado, ir directo a la inscripción
      } else {
        setActiveStep(0); // Necesita autenticarse o registrarse
      }
    } catch (error) {
      console.error('Error validando código:', error);
      setError('Error al validar el código de invitación');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    // Validar campos
    const errors: any = {};
    
    if (!registrationData.email) errors.email = 'El email es requerido';
    if (!registrationData.password) errors.password = 'La contraseña es requerida';
    if (registrationData.password.length < 6) {
      errors.password = 'La contraseña debe tener al menos 6 caracteres';
    }
    if (registrationData.password !== registrationData.confirmPassword) {
      errors.confirmPassword = 'Las contraseñas no coinciden';
    }
    if (!registrationData.nombre) errors.nombre = 'El nombre es requerido';
    if (!registrationData.username) errors.username = 'El nombre de usuario es requerido';
    if (!registrationData.birthdate) errors.birthdate = 'La fecha de nacimiento es requerida';
    
    if (Object.keys(errors).length > 0) {
      setRegistrationErrors(errors);
      return;
    }
    
    try {
      setEnrolling(true);
      
      // Crear cuenta en Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        registrationData.email,
        registrationData.password
      );
      
      // Crear perfil de usuario en Firestore
      const userProfileData: Partial<UserProfile> = {
        id: userCredential.user.uid,
        email: registrationData.email,
        username: registrationData.username,
        nombre: registrationData.nombre,
        displayName: registrationData.nombre,
        birthdate: registrationData.birthdate,
        subscription: 'free' as any,
        notebookCount: 0,
        createdAt: new Date() as any
      };
      
      await setDoc(doc(db, 'users', userCredential.user.uid), userProfileData);
      
      // Proceder con la inscripción automáticamente después del registro
      console.log('Usuario registrado exitosamente, procediendo con inscripción automática...');
      await handleEnrollment(userCredential.user.uid);
      
      // La inscripción exitosa redirigirá automáticamente en handleEnrollment
    } catch (error: any) {
      console.error('Error en registro:', error);
      if (error.code === 'auth/email-already-in-use') {
        setRegistrationErrors({ email: 'Este email ya está registrado' });
      } else {
        setError('Error al crear la cuenta. Por favor intenta de nuevo.');
      }
    } finally {
      setEnrolling(false);
    }
  };

  const handleEnrollment = async (userId?: string) => {
    if (!inviteCode || !code) return;
    
    const studentId = userId || user?.uid;
    if (!studentId) {
      setError('No se pudo identificar al usuario');
      return;
    }
    
    try {
      setEnrolling(true);
      
      // Si el usuario fue recién creado, esperar un momento para asegurar que Firestore esté listo
      if (userId && !user) {
        console.log('Esperando sincronización de usuario recién creado...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      const result = await useInviteCode(
        code,
        studentId,
        userProfile?.email || registrationData.email,
        userProfile?.nombre || userProfile?.displayName || registrationData.nombre
      );
      
      if (result.success) {
        setActiveStep(2); // Mostrar éxito
        console.log('Inscripción exitosa, redirigiendo en 3 segundos...');
        setTimeout(() => {
          navigate('/inicio');
        }, 3000);
      } else {
        setError(result.error || 'Error al inscribirse en la materia');
      }
    } catch (error) {
      console.error('Error en inscripción:', error);
      setError('Error al procesar la inscripción');
    } finally {
      setEnrolling(false);
    }
  };

  if (loading) {
    return (
      <Container maxWidth="sm" sx={{ mt: 8 }}>
        <Box display="flex" flexDirection="column" alignItems="center" gap={2}>
          <CircularProgress size={60} />
          <Typography variant="h6">Validando código de invitación...</Typography>
        </Box>
      </Container>
    );
  }

  if (error && !inviteCode) {
    return (
      <Container maxWidth="sm" sx={{ mt: 8 }}>
        <Card>
          <CardContent>
            <Box display="flex" flexDirection="column" alignItems="center" gap={2}>
              <Avatar sx={{ bgcolor: 'error.main', width: 60, height: 60 }}>
                <Error fontSize="large" />
              </Avatar>
              <Typography variant="h5" color="error">
                Código Inválido
              </Typography>
              <Typography variant="body1" textAlign="center" color="text.secondary">
                {error}
              </Typography>
              <Button
                variant="contained"
                onClick={() => navigate('/inicio')}
                sx={{ mt: 2 }}
              >
                Ir al Inicio
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      {/* Header con información de la invitación */}
      {inviteCode && (
        <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
          <Box display="flex" alignItems="center" gap={2} mb={2}>
            <Avatar sx={{ bgcolor: 'primary.main', width: 56, height: 56 }}>
              <School fontSize="large" />
            </Avatar>
            <Box flex={1}>
              <Typography variant="h4" gutterBottom>
                Invitación a Clase
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Has sido invitado a unirte a una materia
              </Typography>
            </Box>
          </Box>
          
          <Divider sx={{ my: 2 }} />
          
          <Box display="flex" flexDirection="column" gap={2}>
            <Box display="flex" alignItems="center" gap={1}>
              <Book color="primary" />
              <Typography variant="h6">
                {inviteCode.materiaName}
              </Typography>
            </Box>
            
            {teacherInfo && (
              <Box display="flex" alignItems="center" gap={1}>
                <Person color="action" />
                <Typography variant="body1" color="text.secondary">
                  Profesor: {teacherInfo.displayName || teacherInfo.nombre}
                </Typography>
              </Box>
            )}
            
            {inviteCode.metadata?.welcomeMessage && (
              <Alert severity="info" icon={false}>
                <Typography variant="body2">
                  {inviteCode.metadata.welcomeMessage}
                </Typography>
              </Alert>
            )}
          </Box>
        </Paper>
      )}

      {/* Stepper para el proceso de inscripción */}
      <Card>
        <CardContent>
          <Stepper activeStep={activeStep} orientation="vertical">
            {/* Paso 1: Autenticación */}
            <Step>
              <StepLabel
                optional={
                  user ? (
                    <Typography variant="caption">Sesión iniciada como {userProfile?.email}</Typography>
                  ) : null
                }
              >
                {user ? 'Sesión Iniciada' : 'Iniciar Sesión o Registrarse'}
              </StepLabel>
              <StepContent>
                {!user ? (
                  <Box>
                    <Typography variant="body2" color="text.secondary" paragraph>
                      Para unirte a esta materia, necesitas una cuenta en Simonkey.
                    </Typography>
                    
                    <Box display="flex" gap={2} mb={3}>
                      <Button
                        variant="contained"
                        startIcon={<Login />}
                        onClick={() => navigate('/login', { state: { returnTo: `/join/${code}`, inviteCode: code } })}
                      >
                        Iniciar Sesión
                      </Button>
                      <Typography variant="body2" alignSelf="center">
                        o
                      </Typography>
                      <Button
                        variant="outlined"
                        startIcon={<AppRegistration />}
                        onClick={() => navigate('/signup', { state: { inviteCode: code } })}
                      >
                        Crear Cuenta
                      </Button>
                    </Box>
                    
                    <Divider sx={{ my: 3 }}>
                      <Chip label="Registro Rápido" size="small" />
                    </Divider>
                    
                    <Box component="form" onSubmit={(e) => { e.preventDefault(); handleRegister(); }}>
                      <TextField
                        fullWidth
                        margin="normal"
                        label="Email"
                        type="email"
                        value={registrationData.email}
                        onChange={(e) => setRegistrationData({ ...registrationData, email: e.target.value })}
                        error={!!registrationErrors.email}
                        helperText={registrationErrors.email}
                        required
                      />
                      
                      <TextField
                        fullWidth
                        margin="normal"
                        label="Nombre Completo"
                        value={registrationData.nombre}
                        onChange={(e) => setRegistrationData({ ...registrationData, nombre: e.target.value })}
                        error={!!registrationErrors.nombre}
                        helperText={registrationErrors.nombre}
                        required
                      />
                      
                      <TextField
                        fullWidth
                        margin="normal"
                        label="Nombre de Usuario"
                        value={registrationData.username}
                        onChange={(e) => setRegistrationData({ ...registrationData, username: e.target.value })}
                        error={!!registrationErrors.username}
                        helperText={registrationErrors.username}
                        required
                      />
                      
                      <TextField
                        fullWidth
                        margin="normal"
                        label="Fecha de Nacimiento"
                        type="date"
                        value={registrationData.birthdate}
                        onChange={(e) => setRegistrationData({ ...registrationData, birthdate: e.target.value })}
                        error={!!registrationErrors.birthdate}
                        helperText={registrationErrors.birthdate}
                        InputLabelProps={{ shrink: true }}
                        required
                      />
                      
                      <TextField
                        fullWidth
                        margin="normal"
                        label="Contraseña"
                        type="password"
                        value={registrationData.password}
                        onChange={(e) => setRegistrationData({ ...registrationData, password: e.target.value })}
                        error={!!registrationErrors.password}
                        helperText={registrationErrors.password}
                        required
                      />
                      
                      <TextField
                        fullWidth
                        margin="normal"
                        label="Confirmar Contraseña"
                        type="password"
                        value={registrationData.confirmPassword}
                        onChange={(e) => setRegistrationData({ ...registrationData, confirmPassword: e.target.value })}
                        error={!!registrationErrors.confirmPassword}
                        helperText={registrationErrors.confirmPassword}
                        required
                      />
                      
                      <Box display="flex" gap={2} mt={3}>
                        <Button
                          type="submit"
                          variant="contained"
                          startIcon={<AppRegistration />}
                          disabled={enrolling}
                        >
                          {enrolling ? 'Registrando...' : 'Registrarse y Unirse'}
                        </Button>
                      </Box>
                    </Box>
                  </Box>
                ) : (
                  <Box>
                    <Alert severity="success" sx={{ mb: 2 }}>
                      Ya tienes una sesión iniciada como {userProfile?.nombre || userProfile?.displayName}
                    </Alert>
                    <Button
                      variant="contained"
                      onClick={() => setActiveStep(1)}
                    >
                      Continuar
                    </Button>
                  </Box>
                )}
              </StepContent>
            </Step>

            {/* Paso 2: Inscripción */}
            <Step>
              <StepLabel>Inscripción en la Materia</StepLabel>
              <StepContent>
                <Typography variant="body2" color="text.secondary" paragraph>
                  Haz clic en el botón para inscribirte en {inviteCode?.materiaName}
                </Typography>
                
                {error && (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                  </Alert>
                )}
                
                <Box display="flex" gap={2}>
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={<PersonAdd />}
                    onClick={() => handleEnrollment()}
                    disabled={enrolling}
                  >
                    {enrolling ? 'Inscribiendo...' : 'Inscribirme'}
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={() => navigate('/inicio')}
                    disabled={enrolling}
                  >
                    Cancelar
                  </Button>
                </Box>
              </StepContent>
            </Step>

            {/* Paso 3: Confirmación */}
            <Step>
              <StepLabel>¡Inscripción Exitosa!</StepLabel>
              <StepContent>
                <Box display="flex" flexDirection="column" alignItems="center" gap={2}>
                  <Avatar sx={{ bgcolor: 'success.main', width: 60, height: 60 }}>
                    <CheckCircle fontSize="large" />
                  </Avatar>
                  <Typography variant="h6" color="success.main">
                    ¡Te has inscrito exitosamente!
                  </Typography>
                  <Typography variant="body2" color="text.secondary" textAlign="center">
                    Ya eres parte de {inviteCode?.materiaName}.
                    Serás redirigido al inicio en unos segundos...
                  </Typography>
                  <Button
                    variant="contained"
                    onClick={() => navigate('/inicio')}
                  >
                    Ir al Inicio Ahora
                  </Button>
                </Box>
              </StepContent>
            </Step>
          </Stepper>
        </CardContent>
      </Card>
    </Container>
  );
};

export default JoinWithInvitePage;