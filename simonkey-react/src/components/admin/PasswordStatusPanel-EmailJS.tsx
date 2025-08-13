// Función para enviar email con EmailJS
// Reemplaza la función sendCredentialEmail con esta:

const sendCredentialEmailWithEmailJS = async (user: UserCredential) => {
  setSendingEmails(prev => new Set(prev).add(user.userId));
  
  try {
    // Enviar email usando EmailJS
    const templateParams = {
      to_email: user.email,
      to_name: user.userName,
      user_email: user.email,
      temp_password: user.temporaryPassword,
      school_name: 'Simonkey School',
      login_url: window.location.origin + '/login',
      user_role: getRoleLabel(user.userRole)
    };
    
    const response = await emailjs.send(
      EMAILJS_CONFIG.SERVICE_ID,
      EMAILJS_CONFIG.TEMPLATE_ID,
      templateParams
    );
    
    console.log('📧 Email enviado con EmailJS:', response);
    
    // Actualizar estado en Firebase
    await updateDoc(doc(db, 'temporaryCredentials', user.userId), {
      emailSent: true,
      emailSentAt: new Date(),
      emailMethod: 'EmailJS'
    });
    
    // Actualizar estado local
    setUsers(prev => prev.map(u => 
      u.userId === user.userId 
        ? { ...u, emailSent: true }
        : u
    ));
    
    // Mostrar modal de confirmación
    alert('✅ Email enviado exitosamente');
    
    // También mostrar el modal para referencia
    setCredentialsToShow({
      userName: user.userName,
      email: user.email,
      password: user.temporaryPassword,
      userRole: user.userRole,
      loginUrl: window.location.origin + '/login'
    });
    setShowCredentialsModal(true);
    
  } catch (error) {
    console.error('❌ Error enviando email:', error);
    
    // Fallback: mostrar modal
    setCredentialsToShow({
      userName: user.userName,
      email: user.email,
      password: user.temporaryPassword,
      userRole: user.userRole,
      loginUrl: window.location.origin + '/login'
    });
    setShowCredentialsModal(true);
    
    alert('Error al enviar email. Las credenciales se muestran en pantalla.');
  } finally {
    setSendingEmails(prev => {
      const newSet = new Set(prev);
      newSet.delete(user.userId);
      return newSet;
    });
  }
};