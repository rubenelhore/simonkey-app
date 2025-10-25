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

// Function to fix common syntax errors
function fixSyntaxErrors(content) {
  let fixed = content;
  
  // Remove trailing commas before semicolons (interfaces/types)
  fixed = fixed.replace(/,\s*;/g, ';');
  
  // Remove trailing commas before closing braces (interfaces/types/objects)
  fixed = fixed.replace(/,\s*([}\]])/g, '$1');
  
  // Remove misplaced commas after opening braces
  fixed = fixed.replace(/\{,\s*/g, '{ ');
  
  // Remove commas after property declarations in TS types/interfaces (e.g., id: string;, or id: string,})
  fixed = fixed.replace(/(:\s*[^;\n]+),\s*;/g, '$1;');
  fixed = fixed.replace(/(:\s*[^;\n]+),\s*}/g, '$1}');
  
  // Remove commas after property declarations in inline object types (e.g., { email: string;, ... })
  fixed = fixed.replace(/(\w+:\s*[^;\n]+),\s*([};])/g, '$1$2');
  
  // Fix missing commas in import statements
  fixed = fixed.replace(/import\s*\{\s*([^}]+)\s*\}\s*from/g, (match, imports) => {
    const cleanedImports = imports
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join(',\n  ');
    return `import {\n  ${cleanedImports}\n} from`;
  });
  
  // Fix missing commas in destructuring assignments
  fixed = fixed.replace(/const\s*\{\s*([^}]+)\s*\}\s*=/g, (match, destructuring) => {
    const cleanedDestructuring = destructuring
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join(',\n  ');
    return `const {\n  ${cleanedDestructuring}\n} =`;
  });
  
  // Fix missing commas in object literals
  fixed = fixed.replace(/(\w+):\s*([^,\n]+)\n\s*(\w+):/g, '$1: $2,\n  $3:');
  
  // Fix missing commas in array literals
  fixed = fixed.replace(/([^,\n]+)\n\s*([^,\n]+)/g, (match, item1, item2) => {
    if (match.includes('[') && match.includes(']')) {
      return `${item1},\n  ${item2}`;
    }
    return match;
  });
  
  // Fix missing commas in function parameters
  fixed = fixed.replace(/\(\s*{\s*(\w+)\n\s*(\w+)/g, '({\n  $1,\n  $2');
  
  // Fix malformed template literals
  fixed = fixed.replace(/`([^`]*?)\$\{([^}]*?)\$\{([^}]*?)\}`/g, '`$1\${$2}\${$3}`');
  
  // Fix unterminated string literals in console.log statements
  fixed = fixed.replace(/console\.(log|error|warn)\('([^']*?)console\.log\('([^']*?)'\);/g, 
    (match, method, message1, message2) => {
      return `console.${method}('${message1}: ${message2}');`;
    }
  );
  
  // Fix missing commas in return statements
  fixed = fixed.replace(/return\s*\{\s*([^}]+)\s*\}/g, (match, returnObj) => {
    const cleanedReturn = returnObj
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join(',\n  ');
    return `return {\n  ${cleanedReturn}\n}`;
  });
  
  // Remove double commas
  fixed = fixed.replace(/,{2,}/g, ',');

  // Remove trailing commas after variable declarations (e.g., const x = 1;,)
  fixed = fixed.replace(/;\s*,+/g, ';');

  // Remove trailing commas before closing parentheses or braces
  fixed = fixed.replace(/,\s*([)\]}])/g, '$1');
  
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
      const fixedContent = fixSyntaxErrors(content);
      
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