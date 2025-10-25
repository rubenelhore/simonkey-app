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

// Function to fix final syntax errors
function fixFinalErrors(content) {
  let fixed = content;
  
  // Fix trailing commas in interface property declarations
  fixed = fixed.replace(/(\w+:\s*[^;\n]+),\s*;/g, '$1;');
  
  // Fix malformed function declarations
  fixed = fixed.replace(/export const (\w+) = \(,/g, 'export const $1 = (');
  
  // Fix missing commas in query functions
  fixed = fixed.replace(/where\('([^']+)',\s*'==',\s*([^)]+)\)/g, "where('$1', '==', $2)");
  
  // Fix malformed catch blocks
  fixed = fixed.replace(/} catch \(error\) {,/g, '} catch (error) {');
  
  // Fix malformed variable declarations
  fixed = fixed.replace(/(\w+)\s*=\s*([^;]+),;/g, '$1 = $2;');
  
  // Fix malformed object property assignments
  fixed = fixed.replace(/(\w+):\s*([^,\n]+),,/g, '$1: $2,');
  
  // Fix malformed array elements
  fixed = fixed.replace(/([^,\n]+),,/g, '$1,');
  
  // Fix malformed destructuring
  fixed = fixed.replace(/const\s*\{\s*([^}]+)\s*\}\s*=\s*([^;]+),;/g, 'const { $1 } = $2;');
  
  // Fix malformed return type declarations
  fixed = fixed.replace(/\):\s*\{/g, '): {');
  
  // Fix malformed interface property declarations
  fixed = fixed.replace(/(\w+:\s*[^;\n]+),\s*([};])/g, '$1$2');
  
  // Fix malformed object literals
  fixed = fixed.replace(/(\w+):\s*([^,\n]+)\n\s*(\w+):/g, '$1: $2,\n  $3:');
  
  // Fix malformed import statements
  fixed = fixed.replace(/import\s*\{\s*([^}]+)\s*\}\s*from/g, (match, imports) => {
    const cleanedImports = imports
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join(',\n  ');
    return `import {\n  ${cleanedImports}\n} from`;
  });
  
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
      const fixedContent = fixFinalErrors(content);
      
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