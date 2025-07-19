const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Cloud Function para establecer roles de usuario
exports.setUserRoles = functions.https.onCall(async (data, context) => {
  // Verificar que el usuario esté autenticado
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Usuario no autenticado');
  }

  const { userId, roles } = data;

  try {
    // Establecer custom claims
    await admin.auth().setCustomUserClaims(userId, {
      roles: roles || [],
      schoolRole: roles.includes('teacher') ? 'teacher' : 
                  roles.includes('admin') ? 'admin' : 
                  roles.includes('student') ? 'student' : null
    });

    return { message: 'Roles actualizados exitosamente' };
  } catch (error) {
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// Trigger cuando se crea un usuario profesor
exports.onTeacherCreate = functions.firestore
  .document('users/{userId}')
  .onWrite(async (change, context) => {
    const userId = context.params.userId;
    const userData = change.after.exists ? change.after.data() : null;

    if (userData && userData.schoolRole === 'teacher') {
      try {
        await admin.auth().setCustomUserClaims(userId, {
          roles: ['teacher'],
          schoolRole: 'teacher'
        });
        console.log(`Roles establecidos para profesor: ${userId}`);
      } catch (error) {
        console.error('Error estableciendo roles:', error);
      }
    }
  });