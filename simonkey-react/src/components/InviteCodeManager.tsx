import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  TextField,
  Grid,
  IconButton,
  Tooltip,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Snackbar,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  List,
  ListItem,
  ListItemText,
  // ListItemSecondary, // Not exported from MUI
  ListItemSecondaryAction,
  Divider,
  CircularProgress
} from '@mui/material';
import {
  ContentCopy,
  Delete,
  Share,
  QrCode,
  Add,
  Link,
  People,
  Timer,
  Block,
  CheckCircle
} from '@mui/icons-material';
import { InviteCode, SchoolSubject } from '../types/interfaces';
import {
  createInviteCode,
  getTeacherInviteCodes,
  getMateriaInviteCodes,
  deactivateInviteCode,
  deleteInviteCode,
  generateInviteLink,
  copyInviteLink
} from '../services/invitationService';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import QRCode from 'qrcode';

interface InviteCodeManagerProps {
  materiaId?: string;
  materiaName?: string;
  showTitle?: boolean;
}

const InviteCodeManager: React.FC<InviteCodeManagerProps> = ({
  materiaId,
  materiaName,
  showTitle = true
}) => {
  const { user } = useAuth();
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [selectedCode, setSelectedCode] = useState<InviteCode | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' | 'info' });
  
  // Estado para el formulario de creación
  const [formData, setFormData] = useState({
    selectedMateria: materiaId || '',
    materiaName: materiaName || '',
    expiresInDays: 0,
    maxUses: 0,
    hasExpiration: false,
    hasMaxUses: false
  });
  
  const [materias, setMaterias] = useState<SchoolSubject[]>([]);

  useEffect(() => {
    loadInviteCodes();
    if (!materiaId) {
      loadTeacherMaterias();
    }
  }, [materiaId]);

  const loadInviteCodes = async () => {
    try {
      setLoading(true);
      let codes: InviteCode[];
      
      if (materiaId) {
        codes = await getMateriaInviteCodes(materiaId);
      } else if (user) {
        codes = await getTeacherInviteCodes(user.uid);
      } else {
        codes = [];
      }
      
      setInviteCodes(codes);
    } catch (error) {
      console.error('Error cargando códigos:', error);
      setSnackbar({
        open: true,
        message: 'Error al cargar los códigos de invitación',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const loadTeacherMaterias = async () => {
    if (!user) return;
    
    try {
      const q = query(
        collection(db, 'schoolSubjects'),
        where('idProfesor', '==', user.uid)
      );
      const snapshot = await getDocs(q);
      const materiasData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as SchoolSubject));
      setMaterias(materiasData);
    } catch (error) {
      console.error('Error cargando materias:', error);
    }
  };

  const handleCreateCode = async () => {
    console.log('handleCreateCode called');
    if (!user) return;
    
    const selectedMateriaId = formData.selectedMateria || materiaId;
    const selectedMateriaName = formData.materiaName || 
      materias.find(m => m.id === selectedMateriaId)?.nombre || 
      materiaName || '';
    
    if (!selectedMateriaId || !selectedMateriaName) {
      setSnackbar({
        open: true,
        message: 'Por favor selecciona una materia',
        severity: 'error'
      });
      return;
    }
    
    try {
      const options: any = {};
      
      if (formData.hasExpiration && formData.expiresInDays > 0) {
        options.expiresInDays = formData.expiresInDays;
      }
      
      if (formData.hasMaxUses && formData.maxUses > 0) {
        options.maxUses = formData.maxUses;
      }
      
      const newCode = await createInviteCode(
        user.uid,
        selectedMateriaId,
        selectedMateriaName,
        options
      );
      
      setInviteCodes([newCode, ...inviteCodes]);
      setCreateDialogOpen(false);
      resetForm();
      
      setSnackbar({
        open: true,
        message: 'Código de invitación creado exitosamente',
        severity: 'success'
      });
    } catch (error) {
      console.error('Error creando código:', error);
      setSnackbar({
        open: true,
        message: 'Error al crear el código de invitación',
        severity: 'error'
      });
    }
  };

  const resetForm = () => {
    setFormData({
      selectedMateria: materiaId || '',
      materiaName: materiaName || '',
      expiresInDays: 0,
      maxUses: 0,
      hasExpiration: false,
      hasMaxUses: false
    });
  };

  const handleCopyLink = async (code: string) => {
    const success = await copyInviteLink(code);
    setSnackbar({
      open: true,
      message: success ? 'Enlace copiado al portapapeles' : 'Error al copiar el enlace',
      severity: success ? 'success' : 'error'
    });
  };

  const handleShowQR = async (inviteCode: InviteCode) => {
    try {
      const link = generateInviteLink(inviteCode.code);
      const qrDataUrl = await QRCode.toDataURL(link, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      setQrCodeUrl(qrDataUrl);
      setSelectedCode(inviteCode);
      setQrDialogOpen(true);
    } catch (error) {
      console.error('Error generando QR:', error);
      setSnackbar({
        open: true,
        message: 'Error al generar el código QR',
        severity: 'error'
      });
    }
  };

  const handleDeactivateCode = async (codeId: string) => {
    try {
      await deactivateInviteCode(codeId);
      setInviteCodes(inviteCodes.map(code => 
        code.id === codeId ? { ...code, isActive: false } : code
      ));
      setSnackbar({
        open: true,
        message: 'Código desactivado exitosamente',
        severity: 'success'
      });
    } catch (error) {
      console.error('Error desactivando código:', error);
      setSnackbar({
        open: true,
        message: 'Error al desactivar el código',
        severity: 'error'
      });
    }
  };

  const handleDeleteCode = async (codeId: string) => {
    if (!window.confirm('¿Estás seguro de eliminar este código permanentemente?')) {
      return;
    }
    
    try {
      await deleteInviteCode(codeId);
      setInviteCodes(inviteCodes.filter(code => code.id !== codeId));
      setSnackbar({
        open: true,
        message: 'Código eliminado exitosamente',
        severity: 'success'
      });
    } catch (error) {
      console.error('Error eliminando código:', error);
      setSnackbar({
        open: true,
        message: 'Error al eliminar el código',
        severity: 'error'
      });
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const isCodeExpired = (inviteCode: InviteCode) => {
    if (!inviteCode.expiresAt) return false;
    const now = new Date();
    const expirationDate = inviteCode.expiresAt.toDate();
    return now > expirationDate;
  };

  const hasReachedMaxUses = (inviteCode: InviteCode) => {
    if (!inviteCode.maxUses) return false;
    return inviteCode.currentUses >= inviteCode.maxUses;
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
          Códigos de Invitación
        </Typography>
      )}

      <Box mb={2}>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => {
            console.log('Opening create dialog');
            console.log('Current modal z-index:', (document.querySelector('.modal-overlay') as HTMLElement)?.style.zIndex);
            console.log('Current modal content z-index:', (document.querySelector('.modal-content') as HTMLElement)?.style.zIndex);
            setCreateDialogOpen(true);
            setTimeout(() => {
              const muiDialog = document.querySelector('.MuiDialog-root');
              const muiBackdrop = document.querySelector('.MuiBackdrop-root');
              const muiPaper = document.querySelector('.MuiPaper-root');
              const portalDiv = document.querySelector('div[style*="zIndex: 100000"]');
              console.log('MUI Dialog z-index:', muiDialog ? window.getComputedStyle(muiDialog).zIndex : 'not found');
              console.log('MUI Backdrop z-index:', muiBackdrop ? window.getComputedStyle(muiBackdrop).zIndex : 'not found');
              console.log('MUI Paper z-index:', muiPaper ? window.getComputedStyle(muiPaper).zIndex : 'not found');
              console.log('Portal Div z-index:', portalDiv ? window.getComputedStyle(portalDiv).zIndex : 'not found');
              console.log('Dialog element:', muiDialog);
            }, 100);
          }}
        >
          Crear Código de Invitación
        </Button>
      </Box>

      {inviteCodes.length === 0 ? (
        <Alert severity="info">
          No hay códigos de invitación creados. Crea uno para invitar estudiantes a tu materia.
        </Alert>
      ) : (
        <Grid container spacing={2}>
          {inviteCodes.map((inviteCode) => {
            const expired = isCodeExpired(inviteCode);
            const maxUsesReached = hasReachedMaxUses(inviteCode);
            const isInactive = !inviteCode.isActive || expired || maxUsesReached;
            
            return (
              <Grid size={{ xs: 12, md: 6 }} key={inviteCode.id}>
                <Card sx={{ opacity: isInactive ? 0.6 : 1 }}>
                  <CardContent>
                    <Box display="flex" justifyContent="space-between" alignItems="start" mb={2}>
                      <Box>
                        <Typography variant="h6" component="div">
                          {inviteCode.code}
                        </Typography>
                        <Typography color="text.secondary" variant="body2">
                          {inviteCode.materiaName}
                        </Typography>
                      </Box>
                      <Box>
                        {isInactive && (
                          <Chip
                            label={
                              !inviteCode.isActive ? 'Inactivo' :
                              expired ? 'Expirado' :
                              maxUsesReached ? 'Límite alcanzado' : ''
                            }
                            color="error"
                            size="small"
                          />
                        )}
                        {inviteCode.isActive && !expired && !maxUsesReached && (
                          <Chip
                            label="Activo"
                            color="success"
                            size="small"
                          />
                        )}
                      </Box>
                    </Box>

                    {inviteCode.metadata?.description && (
                      <Typography variant="body2" color="text.secondary" paragraph>
                        {inviteCode.metadata.description}
                      </Typography>
                    )}

                    <Box display="flex" gap={2} mb={2}>
                      <Chip
                        icon={<People />}
                        label={`${inviteCode.currentUses} usos`}
                        size="small"
                        variant="outlined"
                      />
                      
                      {inviteCode.maxUses && (
                        <Chip
                          icon={<People />}
                          label={`Máx: ${inviteCode.maxUses}`}
                          size="small"
                          variant="outlined"
                        />
                      )}
                      
                      {inviteCode.expiresAt && (
                        <Chip
                          icon={<Timer />}
                          label={`Expira: ${formatDate(inviteCode.expiresAt)}`}
                          size="small"
                          variant="outlined"
                          color={expired ? 'error' : 'default'}
                        />
                      )}
                    </Box>

                    <Box display="flex" gap={1}>
                      <Tooltip title="Copiar enlace">
                        <IconButton
                          size="small"
                          onClick={() => handleCopyLink(inviteCode.code)}
                          disabled={isInactive}
                        >
                          <Link />
                        </IconButton>
                      </Tooltip>
                      
                      <Tooltip title="Mostrar código QR">
                        <IconButton
                          size="small"
                          onClick={() => handleShowQR(inviteCode)}
                          disabled={isInactive}
                        >
                          <QrCode />
                        </IconButton>
                      </Tooltip>
                      
                      <Tooltip title="Compartir">
                        <IconButton
                          size="small"
                          onClick={() => {
                            if (navigator.share) {
                              navigator.share({
                                title: 'Invitación a ' + inviteCode.materiaName,
                                text: inviteCode.metadata?.welcomeMessage || 
                                      `Únete a mi clase de ${inviteCode.materiaName}`,
                                url: generateInviteLink(inviteCode.code)
                              });
                            } else {
                              handleCopyLink(inviteCode.code);
                            }
                          }}
                          disabled={isInactive}
                        >
                          <Share />
                        </IconButton>
                      </Tooltip>
                      
                      {inviteCode.isActive && !expired && !maxUsesReached && (
                        <Tooltip title="Desactivar código">
                          <IconButton
                            size="small"
                            onClick={() => handleDeactivateCode(inviteCode.id)}
                            color="warning"
                          >
                            <Block />
                          </IconButton>
                        </Tooltip>
                      )}
                      
                      <Tooltip title="Eliminar código">
                        <IconButton
                          size="small"
                          onClick={() => handleDeleteCode(inviteCode.id)}
                          color="error"
                        >
                          <Delete />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      {/* Dialog para crear nuevo código */}
      {createDialogOpen && ReactDOM.createPortal(
        <div style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          zIndex: 100000,
          pointerEvents: 'auto'
        }}>
          <Dialog
            open={createDialogOpen}
            onClose={() => setCreateDialogOpen(false)}
            maxWidth="sm"
            fullWidth
            sx={{ 
              zIndex: '100004 !important',
              '& .MuiBackdrop-root': {
                zIndex: '100001 !important'
              },
              '& .MuiDialog-container': {
                zIndex: '100002 !important'
              },
              '& .MuiPaper-root': {
                zIndex: '100003 !important'
              }
            }}
            slotProps={{
              backdrop: {
                sx: { zIndex: '100001 !important' }
              }
            }}
          >
          <DialogTitle sx={{ 
            textAlign: 'center', 
            fontFamily: 'Poppins, sans-serif',
            color: '#6147FF',
            fontWeight: 600
          }}>
            Crear Código de Invitación
          </DialogTitle>
        <DialogContent>
          <Box sx={{ 
            pt: 2,
            '& .MuiInputBase-root': {
              fontFamily: 'Poppins, sans-serif'
            },
            '& .MuiInputLabel-root': {
              fontFamily: 'Poppins, sans-serif'
            },
            '& .MuiFormHelperText-root': {
              fontFamily: 'Poppins, sans-serif'
            }
          }}>
            {!materiaId && (
              <FormControl fullWidth margin="normal">
                <InputLabel>Materia</InputLabel>
                <Select
                  value={formData.selectedMateria}
                  onChange={(e) => setFormData({ ...formData, selectedMateria: e.target.value })}
                  label="Materia"
                  required
                >
                  {materias.map((materia) => (
                    <MenuItem key={materia.id} value={materia.id}>
                      {materia.nombre}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
            
            <FormControlLabel
              control={
                <Switch
                  checked={formData.hasExpiration}
                  onChange={(e) => setFormData({ ...formData, hasExpiration: e.target.checked })}
                />
              }
              label="Establecer fecha de expiración"
              sx={{ 
                '& .MuiFormControlLabel-label': {
                  fontFamily: 'Poppins, sans-serif'
                }
              }}
            />
            
            {formData.hasExpiration && (
              <TextField
                fullWidth
                margin="normal"
                label="Días hasta expiración"
                type="number"
                value={formData.expiresInDays}
                onChange={(e) => setFormData({ ...formData, expiresInDays: parseInt(e.target.value) || 0 })}
                InputProps={{ inputProps: { min: 1 } }}
              />
            )}
            
            <FormControlLabel
              control={
                <Switch
                  checked={formData.hasMaxUses}
                  onChange={(e) => setFormData({ ...formData, hasMaxUses: e.target.checked })}
                />
              }
              label="Establecer límite de usos"
              sx={{ 
                '& .MuiFormControlLabel-label': {
                  fontFamily: 'Poppins, sans-serif'
                }
              }}
            />
            
            {formData.hasMaxUses && (
              <TextField
                fullWidth
                margin="normal"
                label="Número máximo de usos"
                type="number"
                value={formData.maxUses}
                onChange={(e) => setFormData({ ...formData, maxUses: parseInt(e.target.value) || 0 })}
                InputProps={{ inputProps: { min: 1 } }}
              />
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => {
              setCreateDialogOpen(false);
              resetForm();
            }}
            sx={{ fontFamily: 'Poppins, sans-serif' }}
          >
            Cancelar
          </Button>
          <Button 
            onClick={handleCreateCode} 
            variant="contained"
            sx={{ fontFamily: 'Poppins, sans-serif' }}
          >
            Crear Código
          </Button>
        </DialogActions>
        </Dialog>
        </div>,
        document.body
      )}

      {/* Dialog para mostrar código QR */}
      {qrDialogOpen && ReactDOM.createPortal(
        <div style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          zIndex: 100000,
          pointerEvents: 'auto'
        }}>
          <Dialog
            open={qrDialogOpen}
            onClose={() => setQrDialogOpen(false)}
            maxWidth="sm"
            fullWidth
            sx={{ 
              zIndex: '100004 !important',
              '& .MuiBackdrop-root': {
                zIndex: '100001 !important'
              },
              '& .MuiDialog-container': {
                zIndex: '100002 !important'
              },
              '& .MuiPaper-root': {
                zIndex: '100003 !important'
              }
            }}
            slotProps={{
              backdrop: {
                sx: { zIndex: '100001 !important' }
              }
            }}
          >
          <DialogTitle sx={{ 
            textAlign: 'center', 
            fontFamily: 'Poppins, sans-serif',
            color: '#6147FF',
            fontWeight: 600
          }}>
            Código QR de Invitación
          </DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" alignItems="center" p={2}>
            {qrCodeUrl && (
              <>
                <img src={qrCodeUrl} alt="Código QR" style={{ maxWidth: '100%' }} />
                <Typography variant="h6" sx={{ mt: 2 }}>
                  {selectedCode?.code}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  {selectedCode?.materiaName}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
                  Los estudiantes pueden escanear este código QR para unirse a la materia
                </Typography>
              </>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setQrDialogOpen(false)}
            sx={{ fontFamily: 'Poppins, sans-serif' }}
          >
            Cerrar
          </Button>
        </DialogActions>
        </Dialog>
        </div>,
        document.body
      )}

      {/* Snackbar para notificaciones */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default InviteCodeManager;