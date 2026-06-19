console.log('=' .repeat(60));
console.log('  Malbolge Compiler - Comprehensive Test Suite');
console.log('=' .repeat(60));
console.log();

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ✗ ${name}`);
    console.log(`    Error: ${e.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

const { interpret, validateProgram, crz, rotr, MEMORY_SIZE } = require('./src/malbolge/interpreter');
const { assemble, disassemble, opToChar, charToOp } = require('./src/malbolge/assembler');
const { generateForString } = require('./src/malbolge/generator');
const { transpile, parse, detectLanguage } = require('./src/compiler/transpiler');

console.log('1. Interpreter Tests');
console.log('-'.repeat(40));

test('crz operation basic', () => {
  const r = crz(0, 0);
  assert(typeof r === 'number' && r >= 0 && r < MEMORY_SIZE, 'crz should return valid trit value');
});

test('rotr operation basic', () => {
  const r = rotr(1);
  assert(r === 19683, `rotr(1) should be 19683, got ${r}`);
});

test('halt program (Q at position 0)', () => {
  const result = interpret('Q');
  assert(result.halted === true, 'Program should halt');
  assert(result.steps === 1, `Should halt in 1 step, got ${result.steps}`);
  assert(result.output === '', 'Output should be empty');
  assert(result.error === null, 'Should have no error');
});

test('validateProgram with valid chars', () => {
  const result = validateProgram('Hello World!');
  assert(result.valid === true, 'Should be valid');
  assert(result.length === 11, `Length should be 11, got ${result.length}`);
});

test('validateProgram with invalid chars', () => {
  const result = validateProgram('Hello\nWorld');
  assert(result.valid === true, 'Whitespace should be skipped but valid');
});

console.log();
console.log('2. Assembler Tests');
console.log('-'.repeat(40));

test('opToChar for position 0', () => {
  const charCode = opToChar(81, 0);
  assert(charCode === 81, `Halt op at position 0 should be char 81 ('Q'), got ${charCode}`);
});

test('charToOp roundtrip', () => {
  const charCode = opToChar(40, 5);
  const op = charToOp(charCode, 5);
  assert(op === 40, `Roundtrip should give op 40, got ${op}`);
});

test('assemble simple program', () => {
  const result = assemble('v');
  assert(result.length === 1, 'Should have 1 character');
  assert(result.charCodeAt(0) === 81, `Should be 'Q' (81), got ${result.charCodeAt(0)}`);
});

test('disassemble simple program', () => {
  const result = disassemble('Q');
  assert(result === 'v', `Should disassemble to 'v', got '${result}'`);
});

test('assemble-disassemble roundtrip', () => {
  const original = 'jpo*<v';
  const assembled = assemble(original);
  const disassembled = disassemble(assembled);
  assert(disassembled === original, `Roundtrip failed: '${original}' -> '${disassembled}'`);
});

test('cat program disassembles correctly', () => {
  const catProgram = `(=BA#9"=<;:3y7x54-21q/p-,+*)"!h%B0/.
~P<
<:(8&
66#"!~}|{zyxwvu
gJ%`;
  const normalized = disassemble(catProgram);
  assert(normalized.length === 62, `Cat program should have 62 instructions, got ${normalized.length}`);
  assert(normalized.startsWith('jpoo*pjoo'), `Should start with 'jpoo*pjoo', got '${normalized.substring(0, 8)}'`);
});

console.log();
console.log('3. Generator Tests');
console.log('-'.repeat(40));

test('generateForString returns valid Malbolge', () => {
  const result = generateForString('Hi');
  assert(typeof result === 'string', 'Should return a string');
  assert(result.length > 0, 'Should not be empty');
  
  const validation = validateProgram(result);
  assert(validation.valid, 'Generated code should be valid Malbolge');
});

test('generateForString empty string', () => {
  const result = generateForString('');
  assert(typeof result === 'string', 'Should return a string');
  const validation = validateProgram(result);
  assert(validation.valid, 'Should be valid');
});

console.log();
console.log('4. Transpiler Tests');
console.log('-'.repeat(40));

test('detectLanguage JavaScript', () => {
  const lang = detectLanguage('console.log("hello");\nlet x = 1;');
  assert(lang === 'javascript', `Should detect javascript, got ${lang}`);
});

test('detectLanguage Python', () => {
  const lang = detectLanguage('print("hello")\ndef foo():\n  pass');
  assert(lang === 'python', `Should detect python, got ${lang}`);
});

test('parse simple print statement (JS)', () => {
  const ast = parse('console.log("Hello World");', 'javascript');
  assert(ast.statements.length === 1, `Should have 1 statement, got ${ast.statements.length}`);
  assert(ast.statements[0].type === 'print', 'Should be print statement');
  assert(ast.statements[0].value === 'Hello World', 'Value should be Hello World');
});

test('parse simple print statement (Python)', () => {
  const ast = parse('print("Hello World")', 'python');
  assert(ast.statements.length === 1, `Should have 1 statement, got ${ast.statements.length}`);
  assert(ast.statements[0].type === 'print', 'Should be print statement');
});

test('parse variable assignment', () => {
  const ast = parse('let message = "hello";\nconsole.log(message);', 'javascript');
  assert(ast.statements.length === 2, `Should have 2 statements, got ${ast.statements.length}`);
  assert(ast.statements[0].type === 'assign', 'First should be assignment');
  assert(ast.statements[0].name === 'message', 'Variable name should be message');
});

test('transpile simple JS code', () => {
  const result = transpile('console.log("Hi!");', { language: 'javascript' });
  assert(result.malbolgeCode, 'Should have malbolgeCode');
  assert(result.normalizedCode, 'Should have normalizedCode');
  assert(result.language === 'javascript', 'Language should be javascript');
  assert(result.metadata, 'Should have metadata');
  assert(result.metadata.outputString === 'Hi!', `Output string should be 'Hi!', got '${result.metadata.outputString}'`);
});

test('transpile simple Python code', () => {
  const result = transpile('print("Hello")', { language: 'python' });
  assert(result.malbolgeCode, 'Should have malbolgeCode');
  assert(result.language === 'python', 'Language should be python');
});

console.log();
console.log('5. API Route Tests (direct module test)');
console.log('-'.repeat(40));

const app = require('./src/server');
const http = require('http');

test('server module exports express app', () => {
  assert(typeof app === 'function', 'Should export express app function');
});

console.log();
console.log('6. Integration Tests');
console.log('-'.repeat(40));

test('full compile and validate cycle', () => {
  const source = 'console.log("Test");';
  const compiled = transpile(source);
  const validation = validateProgram(compiled.malbolgeCode);
  assert(validation.valid, 'Compiled code should be valid Malbolge');
});

test('transpile with variable substitution', () => {
  const source = `
let name = "World";
console.log("Hello, ");
console.log(name);
console.log("!");
`;
  const result = transpile(source);
  assert(result.metadata.outputString === 'Hello, World!', 
    `Output should be 'Hello, World!', got '${result.metadata.outputString}'`);
});

console.log();
console.log('=' .repeat(60));
console.log(`  Results: ${passed} passed, ${failed} failed`);
console.log('=' .repeat(60));

if (failed > 0) {
  process.exit(1);
}
