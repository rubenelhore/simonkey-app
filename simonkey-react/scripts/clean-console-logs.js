#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Script para limpiar console.logs de desarrollo de archivos TypeScript/JavaScript
 * Mantiene console.error y console.warn para logging crítico
 */

const srcDir = path.join(__dirname, '../src');
const extensions = ['.ts', '.tsx', '.js', '.jsx'];

// Patrones de console.log a remover (pero mantener error y warn)
const consolePatterns = [
  /console\.log\([^)]*\);?\s*\n?/g,
  /console\.info\([^)]*\);?\s*\n?/g,
  /console\.debug\([^)]*\);?\s*\n?/g,
  /console\.trace\([^)]*\);?\s*\n?/g,
];

function cleanConsoleLogsFromFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let originalContent = content;
    let removedCount = 0;

    // Aplicar cada patrón
    consolePatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        removedCount += matches.length;
        content = content.replace(pattern, '');
      }
    });

    // Limpiar líneas vacías múltiples
    content = content.replace(/\n\s*\n\s*\n/g, '\n\n');

    if (originalContent !== content) {
      fs.writeFileSync(filePath, content);
      console.log(`✅ ${path.relative(srcDir, filePath)}: ${removedCount} console.logs removidos`);
      return removedCount;
    } else {
      console.log(`⚪ ${path.relative(srcDir, filePath)}: Sin console.logs encontrados`);
      return 0;
    }
  } catch (error) {
    console.error(`❌ Error procesando ${filePath}:`, error.message);
    return 0;
  }
}

function walkDirectory(dir) {
  let totalRemoved = 0;
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      // Recursivo para subdirectorios
      totalRemoved += walkDirectory(filePath);
    } else if (extensions.includes(path.extname(file))) {
      // Procesar archivos con extensiones válidas
      totalRemoved += cleanConsoleLogsFromFile(filePath);
    }
  });

  return totalRemoved;
}

function main() {
  console.log('🧹 Iniciando limpieza de console.logs...\n');
  console.log(`📁 Directorio: ${srcDir}`);
  console.log(`📄 Extensiones: ${extensions.join(', ')}\n`);

  const startTime = Date.now();
  const totalRemoved = walkDirectory(srcDir);
  const endTime = Date.now();

  console.log('\n' + '='.repeat(50));
  console.log(`🎉 Limpieza completada!`);
  console.log(`⏱️  Tiempo: ${endTime - startTime}ms`);
  console.log(`🗑️  Total console.logs removidos: ${totalRemoved}`);
  console.log(`✅ Console.error y console.warn mantenidos`);
  console.log('='.repeat(50));

  if (totalRemoved > 0) {
    console.log('\n💡 Recuerda hacer git commit después de revisar los cambios');
  }
}

if (require.main === module) {
  main();
}

module.exports = { cleanConsoleLogsFromFile, walkDirectory };