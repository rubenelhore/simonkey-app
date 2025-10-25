const fs = require('fs');
const path = require('path');

console.log('=== Actualización a Base de Datos (default) ===\n');

// Archivos a actualizar
const updates = [
  {
    file: 'src/services/firebase.ts',
    changes: [
      {
        from: "export const db = getFirestore(app, 'simonkey-general');",
        to: "export const db = getFirestore(app);",
        description: 'Cambiar getFirestore para usar (default)'
      }
    ]
  },
  {
    file: 'functions/src/index.ts',
    changes: [
      {
        from: "getFirestore('simonkey-general')",
        to: "getFirestore()",
        description: 'Actualizar todas las instancias de getFirestore en functions'
      }
    ]
  }
];

let totalChanges = 0;
let errors = [];

// Función para actualizar un archivo
function updateFile(fileInfo) {
  const filePath = path.join(__dirname, '../..', fileInfo.file);
  
  console.log(`\n📄 Procesando: ${fileInfo.file}`);
  
  if (!fs.existsSync(filePath)) {
    console.log('   ❌ Archivo no encontrado');
    errors.push(`${fileInfo.file} no encontrado`);
    return;
  }
  
  // Hacer backup del archivo original
  const backupPath = filePath + '.backup-' + Date.now();
  fs.copyFileSync(filePath, backupPath);
  console.log(`   ✅ Backup creado: ${path.basename(backupPath)}`);
  
  // Leer contenido
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Aplicar cambios
  fileInfo.changes.forEach(change => {
    if (content.includes(change.from)) {
      content = content.replace(new RegExp(change.from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), change.to);
      console.log(`   ✅ ${change.description}`);
      totalChanges++;
      modified = true;
    } else {
      console.log(`   ⚠️  No se encontró: "${change.from}"`);
    }
  });
  
  // Guardar si hubo cambios
  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log('   ✅ Archivo actualizado');
  } else {
    console.log('   ℹ️  No se requirieron cambios');
    // Eliminar backup si no hubo cambios
    fs.unlinkSync(backupPath);
  }
}

// Función principal
console.log('🚀 Iniciando actualización de configuración...\n');
console.log('⚠️  Este script actualizará tu código para usar la base de datos (default)');
console.log('   en lugar de simonkey-general\n');

// Aplicar actualizaciones
updates.forEach(updateFile);

// Buscar otras posibles referencias
console.log('\n🔍 Buscando otras referencias a simonkey-general...');

const searchDirs = ['src', 'functions/src'];
const foundReferences = [];

function searchInDirectory(dir) {
  const files = fs.readdirSync(dir, { withFileTypes: true });
  
  files.forEach(file => {
    const fullPath = path.join(dir, file.name);
    
    if (file.isDirectory() && !file.name.includes('node_modules')) {
      searchInDirectory(fullPath);
    } else if (file.isFile() && (file.name.endsWith('.ts') || file.name.endsWith('.js'))) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('simonkey-general')) {
        foundReferences.push(fullPath);
      }
    }
  });
}

searchDirs.forEach(dir => {
  const fullDir = path.join(__dirname, '../..', dir);
  if (fs.existsSync(fullDir)) {
    searchInDirectory(fullDir);
  }
});

if (foundReferences.length > 0) {
  console.log(`\n⚠️  Se encontraron ${foundReferences.length} archivos con referencias a simonkey-general:`);
  foundReferences.forEach(file => {
    console.log(`   - ${file.replace(path.join(__dirname, '../..'), '')}`);
  });
  console.log('\n   Revisa estos archivos manualmente si es necesario.');
}

// Resumen
console.log('\n' + '='.repeat(50));
console.log('📊 RESUMEN');
console.log('='.repeat(50));
console.log(`✅ Cambios aplicados: ${totalChanges}`);
console.log(`❌ Errores: ${errors.length}`);

if (errors.length > 0) {
  console.log('\nErrores encontrados:');
  errors.forEach(err => console.log(`   - ${err}`));
}

console.log('\n📌 Próximos pasos:');
console.log('1. Revisa los cambios en tu editor de código');
console.log('2. Ejecuta la aplicación localmente para probar');
console.log('3. Si todo funciona, despliega los cambios');
console.log('4. Si hay problemas, los archivos .backup contienen la versión original');

console.log('\n✅ Actualización completada');