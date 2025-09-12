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
  Block,
  CheckCircle
} from '@mui/icons-material';
import { InviteCode } from '../types/interfaces';
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
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [selectedCode, setSelectedCode] = useState<InviteCode | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' | 'info' });

  useEffect(() => {
    loadInviteCodes();
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

  const handleCreateCode = async () => {
    if (!user) {
      console.error('❌ No hay usuario autenticado');
      return;
    }
    
    const selectedMateriaId = materiaId;
    const selectedMateriaName = materiaName || 'Materia sin nombre';
    
    if (!selectedMateriaId) {
      console.error('❌ Falta ID de la materia');
      setSnackbar({
        open: true,
        message: 'No se pudo identificar la materia',
        severity: 'error'
      });
      return;
    }
    
    try {
      const newCode = await createInviteCode(
        user.uid,
        selectedMateriaId,
        selectedMateriaName,
        {} // Sin opciones adicionales
      );
      
      setInviteCodes([newCode, ...inviteCodes]);
      
      setSnackbar({
        open: true,
        message: 'Código de invitación creado exitosamente',
        severity: 'success'
      });
    } catch (error: any) {
      console.error('❌ Error creando código:', error);
      
      let errorMessage = 'Error al crear el código de invitación';
      
      if (error?.code === 'permission-denied') {
        errorMessage = 'No tienes permisos para crear códigos de invitación.';
      } else if (error?.message) {
        errorMessage = `Error: ${error.message}`;
      }
      
      setSnackbar({
        open: true,
        message: errorMessage,
        severity: 'error'
      });
    }
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
          onClick={handleCreateCode}
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
                    
                    {/* Botón inferior para copiar link */}
                    <Box mt={2}>
                      <Button
                        fullWidth
                        variant="outlined"
                        startIcon={<ContentCopy />}
                        onClick={() => handleCopyLink(inviteCode.code)}
                        disabled={isInactive}
                        sx={{
                          borderColor: '#6147FF',
                          color: '#6147FF',
                          '&:hover': {
                            borderColor: '#4030D0',
                            backgroundColor: 'rgba(97, 71, 255, 0.04)'
                          },
                          '&:disabled': {
                            borderColor: 'rgba(0, 0, 0, 0.12)',
                            color: 'rgba(0, 0, 0, 0.26)'
                          }
                        }}
                      >
                        Copiar link
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
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