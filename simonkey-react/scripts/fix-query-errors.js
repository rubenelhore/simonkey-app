import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Function to recursively find all TypeScript files
function findTsFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
      findTsFiles(filePath, fileList);
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

// Function to fix query and function declaration errors
function fixQueryErrors(content) {
  let fixed = content;
  
  // Fix missing commas in query functions
  fixed = fixed.replace(/where\('([^']+)',\s*'==',\s*([^)]+)\)/g, "where('$1', '==', $2)");
  fixed = fixed.replace(/where\('([^']+)',\s*'!=',\s*([^)]+)\)/g, "where('$1', '!=', $2)");
  
  // Fix malformed function declarations
  fixed = fixed.replace(/export const (\w+) = \(,/g, 'export const $1 = (');
  
  // Fix missing commas in object literals
  fixed = fixed.replace(/(\w+):\s*([^,\n]+)\n\s*(\w+):/g, '$1: $2,\n  $3:');
  
  // Fix missing commas in array literals
  fixed = fixed.replace(/([^,\n]+)\n\s*([^,\n]+)/g, (match, item1, item2) => {
    if (match.includes('[') && match.includes(']')) {
      return `${item1},\n  ${item2}`;
    }
    return match;
  });
  
  // Fix missing commas in destructuring
  fixed = fixed.replace(/const\s*\{\s*([^}]+)\s*\}\s*=/g, (match, destructuring) => {
    const cleanedDestructuring = destructuring
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join(',\n  ');
    return `const {\n  ${cleanedDestructuring}\n} =`;
  });
  
  // Fix missing commas in function parameters
  fixed = fixed.replace(/\(\s*{\s*(\w+)\n\s*(\w+)/g, '({\n  $1,\n  $2');
  
  return fixed;
}

// Main function
function main() {
  const srcDir = path.join(__dirname, '..', 'src');
  const tsFiles = findTsFiles(srcDir);
  
  console.log(`Found ${tsFiles.length} TypeScript files to process...`);
  
  let fixedCount = 0;
  
  tsFiles.forEach(filePath => {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const fixedContent = fixQueryErrors(content);
      
      if (content !== fixedContent) {
        fs.writeFileSync(filePath, fixedContent, 'utf8');
        console.log(`Fixed: ${path.relative(process.cwd(), filePath)}`);
        fixedCount++;
      }
    } catch (error) {
      console.error(`Error processing ${filePath}:`, error.message);
    }
  });
  
  console.log(`\nFixed ${fixedCount} files.`);
}

main(); 