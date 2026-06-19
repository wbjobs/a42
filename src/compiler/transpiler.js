const { generateForString } = require('../malbolge/generator');
const { assemble, disassemble } = require('../malbolge/assembler');
const { interpret } = require('../malbolge/interpreter');

function transpile(sourceCode, options = {}) {
  const { language = 'auto' } = options;
  
  const lang = detectLanguage(sourceCode, language);
  
  const ast = parse(sourceCode, lang);
  const { malbolgeCode, metadata } = generate(ast, options);
  
  return {
    malbolgeCode,
    normalizedCode: disassemble(malbolgeCode),
    language: lang,
    metadata
  };
}

function detectLanguage(code, hint) {
  if (hint && hint !== 'auto') return hint;
  
  if (code.includes('console.log') || code.includes('function') || code.includes('let ') || code.includes('const ')) {
    return 'javascript';
  }
  if (code.includes('print(') || code.includes('def ') || code.includes('import ')) {
    return 'python';
  }
  
  return 'javascript';
}

function parse(code, language) {
  const statements = [];
  const lines = code.split('\n');
  
  for (let line of lines) {
    line = line.trim();
    if (!line || line.startsWith('//') || line.startsWith('#')) continue;
    
    const printMatch = line.match(/^(?:console\.log|print)\s*\(\s*(["'`])(.*?)\1\s*\)/);
    if (printMatch) {
      statements.push({
        type: 'print',
        value: printMatch[2],
        kind: 'string'
      });
      continue;
    }
    
    const printExprMatch = line.match(/^(?:console\.log|print)\s*\(\s*(.+?)\s*\)/);
    if (printExprMatch) {
      statements.push({
        type: 'print',
        value: printExprMatch[1],
        kind: 'expression'
      });
      continue;
    }
    
    const varMatch = line.match(/^(?:let|const|var)\s+(\w+)\s*=\s*(["'`])(.*?)\2/);
    if (varMatch) {
      statements.push({
        type: 'assign',
        name: varMatch[1],
        value: varMatch[3],
        kind: 'string'
      });
      continue;
    }
    
    const varNumMatch = line.match(/^(?:let|const|var)\s+(\w+)\s*=\s*(\d+)/);
    if (varNumMatch) {
      statements.push({
        type: 'assign',
        name: varNumMatch[1],
        value: parseInt(varNumMatch[2]),
        kind: 'number'
      });
      continue;
    }
    
    const pyVarMatch = line.match(/^(\w+)\s*=\s*(["'`])(.*?)\2/);
    if (pyVarMatch) {
      statements.push({
        type: 'assign',
        name: pyVarMatch[1],
        value: pyVarMatch[3],
        kind: 'string'
      });
      continue;
    }
    
    if (line === 'input()' || line === 'input') {
      statements.push({ type: 'input' });
      continue;
    }
    
    statements.push({
      type: 'comment',
      value: line
    });
  }
  
  return { statements };
}

function generate(ast, options) {
  const variables = {};
  let outputString = '';
  const metadata = {
    statements: ast.statements.length,
    printStatements: 0,
    variables: []
  };

  for (const stmt of ast.statements) {
    if (stmt.type === 'assign') {
      variables[stmt.name] = stmt.value;
      if (!metadata.variables.includes(stmt.name)) {
        metadata.variables.push(stmt.name);
      }
    } else if (stmt.type === 'print') {
      metadata.printStatements++;
      if (stmt.kind === 'string') {
        outputString += stmt.value;
      } else if (stmt.kind === 'expression') {
        const expr = stmt.value.trim();
        if (variables[expr] !== undefined) {
          outputString += String(variables[expr]);
        } else {
          const num = Number(expr);
          if (!isNaN(num)) {
            outputString += String.fromCharCode(num);
          } else {
            outputString += `[${expr}]`;
          }
        }
      }
    }
  }

  const malbolgeCode = generateForString(outputString, options);
  
  metadata.outputString = outputString;
  metadata.outputLength = outputString.length;
  metadata.programLength = malbolgeCode.replace(/\s/g, '').length;

  return { malbolgeCode, metadata };
}

module.exports = {
  transpile,
  parse,
  detectLanguage
};
