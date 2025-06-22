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

// Function to fix remaining syntax errors
function fixRemainingErrors(content) {
  let fixed = content;
  
  // Fix double commas in import statements
  fixed = fixed.replace(/,\s*,/g, ',');
  
  // Fix trailing commas after property declarations in interfaces
  fixed = fixed.replace(/(\w+:\s*[^;\n]+),\s*;/g, '$1;');
  
  // Fix trailing commas before closing braces
  fixed = fixed.replace(/,\s*([}\]])/g, '$1');
  
  // Fix double commas in object literals
  fixed = fixed.replace(/,\s*,/g, ',');
  
  // Fix malformed function declarations
  fixed = fixed.replace(/export const (\w+) = \(,/g, 'export const $1 = (');
  
  // Fix malformed interface property declarations
  fixed = fixed.replace(/(\w+:\s*[^;\n]+),\s*([};])/g, '$1$2');
  
  // Fix malformed return type declarations
  fixed = fixed.replace(/\):\s*\{/g, '): {');
  
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
      const fixedContent = fixRemainingErrors(content);
      
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