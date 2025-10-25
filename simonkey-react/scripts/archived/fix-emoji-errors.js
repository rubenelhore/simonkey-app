#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Script para reemplazar emojis problemáticos en console.logs
 * que causan errores de parsing en esbuild
 */

const srcDir = path.join(__dirname, '../src');
const extensions = ['.ts', '.tsx'];

// Mapeo de emojis problemáticos a texto
const emojiReplacements = {
  '❌': '[ERROR]',
  '⚠️': '[WARNING]',
  '✅': '[SUCCESS]',
  '🎉': '[CELEBRATION]',
  '🚀': '[ROCKET]',
  '🔥': '[FIRE]'
};

function fixEmojisInFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let hasChanges = false;

    // Reemplazar emojis en console.logs
    Object.entries(emojiReplacements).forEach(([emoji, replacement]) => {
      const regex = new RegExp(`console\\.(log|error|warn)\\([^)]*${emoji.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^)]*\\)`, 'g');
      const newContent = content.replace(regex, (match) => {
        return match.replace(emoji, replacement);
      });
      
      if (newContent !== content) {
        content = newContent;
        hasChanges = true;
      }
    });

    if (hasChanges) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Fixed emojis in: ${path.relative(process.cwd(), filePath)}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
    return false;
  }
}

function processDirectory(dir) {
  let totalFixed = 0;
  
  try {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        totalFixed += processDirectory(fullPath);
      } else if (stat.isFile()) {
        const ext = path.extname(item);
        if (extensions.includes(ext)) {
          if (fixEmojisInFile(fullPath)) {
            totalFixed++;
          }
        }
      }
    }
  } catch (error) {
    console.error(`❌ Error reading directory ${dir}:`, error.message);
  }
  
  return totalFixed;
}

// Ejecutar el script
console.log('🔧 Fixing emoji errors in console.logs...');
const startTime = Date.now();

const filesFixed = processDirectory(srcDir);

const endTime = Date.now();
const duration = endTime - startTime;

console.log(`\n🎉 Emoji fix completed!`);
console.log(`📊 Files fixed: ${filesFixed}`);
console.log(`⏱️  Duration: ${duration}ms`);

if (filesFixed > 0) {
  console.log('\n✅ All emoji errors in console.logs have been fixed!');
} else {
  console.log('\nℹ️  No emoji errors found in console.logs.');
} 