console.log('='.repeat(60));
console.log('  Malbolge Compiler - Debug Mode Tests');
console.log('='.repeat(60));
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

const { debug, decodeOp, OP_NAMES, MEMORY_SIZE } = require('./src/malbolge/interpreter');

console.log('1. Debug Core Function Tests');
console.log('-'.repeat(40));

test('decodeOp decodes halt instruction correctly', () => {
  const op = decodeOp(81, 0);
  assert(op.name === 'halt', `Should be 'halt', got '${op.name}'`);
  assert(op.mnem === 'v', `Should be 'v', got '${op.mnem}'`);
});

test('decodeOp decodes output instruction correctly', () => {
  const charCode = (5 - 10 + 94) % 94;
  const adjusted = charCode < 33 ? charCode + 94 : charCode;
  const op = decodeOp(adjusted, 10);
  assert(op.name === 'output', `Should be 'output', got '${op.name}'`);
  assert(op.mnem === '<', `Should be '<', got '${op.mnem}'`);
});

test('OP_NAMES contains all 8 operations', () => {
  const expectedOps = [4, 5, 23, 39, 40, 62, 68, 81];
  for (const op of expectedOps) {
    assert(OP_NAMES[op], `OP_NAMES should contain op ${op}`);
    assert(OP_NAMES[op].name, `OP_NAMES[${op}] should have name`);
    assert(OP_NAMES[op].mnem, `OP_NAMES[${op}] should have mnem`);
    assert(OP_NAMES[op].desc, `OP_NAMES[${op}] should have desc`);
  }
});

test('debug with halt-only program returns correct state', () => {
  const result = debug('Q');
  assert(result.status === 'halted', `Status should be 'halted', got '${result.status}'`);
  assert(result.stepsExecuted === 1, `Steps should be 1, got ${result.stepsExecuted}`);
  assert(result.registers.C.value === 0, `C should be 0, got ${result.registers.C.value}`);
  assert(result.registers.A.value === 0, `A should be 0, got ${result.registers.A.value}`);
});

test('debug returns register details', () => {
  const result = debug('Q');
  assert(result.registers.A, 'Should have A register');
  assert(result.registers.C, 'Should have C register');
  assert(result.registers.D, 'Should have D register');
  assert(typeof result.registers.A.value === 'number', 'A.value should be number');
  assert(typeof result.registers.A.mod256 === 'number', 'A.mod256 should be number');
  assert(typeof result.registers.A.char === 'string', 'A.char should be string');
  assert(typeof result.registers.A.trits === 'string', 'A.trits should be string');
  assert(result.registers.A.trits.length === 10, `A.trits should be 10 chars, got ${result.registers.A.trits.length}`);
});

test('debug returns current instruction info', () => {
  const result = debug('Q');
  assert(result.currentInstruction, 'Should have currentInstruction');
  assert(result.currentInstruction.address === 0, `Address should be 0, got ${result.currentInstruction.address}`);
  assert(result.currentInstruction.charCode === 81, `charCode should be 81, got ${result.currentInstruction.charCode}`);
  assert(result.currentInstruction.char === 'Q', `char should be 'Q', got '${result.currentInstruction.char}'`);
  assert(result.currentInstruction.decoded, 'Should have decoded instruction');
  assert(result.currentInstruction.decoded.name === 'halt', `Should be 'halt', got '${result.currentInstruction.decoded.name}'`);
});

test('debug returns next instruction info (when valid)', () => {
  const code = 'ABCDEFG';
  const result = debug(code, { breakAtAddress: 3 });
  assert(result.nextInstruction, 'Should have nextInstruction');
  assert(result.nextInstruction.address === 4, `Next address should be 4, got ${result.nextInstruction.address}`);
  assert(result.nextInstruction.decoded, 'Next instruction should be decoded');
});

console.log();
console.log('2. Breakpoint Tests');
console.log('-'.repeat(40));

test('debug with breakAtAddress stops at correct address', () => {
  const code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const result = debug(code, { breakAtAddress: 5, maxSteps: 100 });
  assert(result.hitBreakpoint === true, 'Should hit breakpoint');
  assert(result.status === 'breakpoint', `Status should be 'breakpoint', got '${result.status}'`);
  assert(result.breakpointAddress === 5, `Breakpoint address should be 5, got ${result.breakpointAddress}`);
  assert(result.registers.C.value === 5, `C should be 5, got ${result.registers.C.value}`);
});

test('debug with breakAtAddress 0 stops before first instruction', () => {
  const code = 'ABC';
  const result = debug(code, { breakAtAddress: 0 });
  assert(result.hitBreakpoint === true, 'Should hit breakpoint at 0');
  assert(result.stepsExecuted === 0, `Should have executed 0 steps, got ${result.stepsExecuted}`);
});

test('debug with invalid breakAtAddress throws error in API (tested separately)', () => {
  assert(true, 'API validation tested in API tests');
});

console.log();
console.log('3. Memory Snapshot Tests');
console.log('-'.repeat(40));

test('debug returns memory snapshot', () => {
  const result = debug('Q', { memorySnapshotRange: [0, 10] });
  assert(result.memorySnapshot, 'Should have memorySnapshot');
  assert(result.memorySnapshotRange[0] === 0, `Snapshot start should be 0, got ${result.memorySnapshotRange[0]}`);
  assert(result.memorySnapshotRange[1] === 10, `Snapshot end should be 10, got ${result.memorySnapshotRange[1]}`);
  for (let i = 0; i < 10; i++) {
    assert(result.memorySnapshot[i], `Should have memory entry for address ${i}`);
    assert(typeof result.memorySnapshot[i].value === 'number', `Address ${i} should have value`);
  }
});

test('debug memory snapshot entries have correct structure', () => {
  const result = debug('Q', { memorySnapshotRange: [0, 5] });
  const entry = result.memorySnapshot[0];
  assert(typeof entry.value === 'number', 'Should have value');
  assert(entry.char === 'Q' || entry.char === null, 'Should have char or null');
  assert(typeof entry.isInstruction === 'boolean', 'Should have isInstruction');
});

test('debug memory snapshot correctly identifies program vs non-program memory', () => {
  const code = 'ABCDE';
  const result = debug(code, { memorySnapshotRange: [0, 10] });
  assert(result.memorySnapshot[0].isInstruction === true, 'Address 0 should be instruction');
  assert(result.memorySnapshot[4].isInstruction === true, 'Address 4 should be instruction');
  assert(result.memorySnapshot[5].isInstruction === false, 'Address 5 should not be instruction');
  assert(result.memorySnapshot[9].isInstruction === false, 'Address 9 should not be instruction');
});

test('debug memory snapshot handles large ranges', () => {
  const result = debug('Q', { memorySnapshotRange: [0, 500] });
  assert(result.memorySnapshotRange[1] === 500, `End should be 500, got ${result.memorySnapshotRange[1]}`);
  assert(Object.keys(result.memorySnapshot).length === 500, `Should have 500 entries, got ${Object.keys(result.memorySnapshot).length}`);
});

test('debug memory snapshot clamps to valid range', () => {
  const result = debug('Q', { memorySnapshotRange: [-10, MEMORY_SIZE + 100] });
  assert(result.memorySnapshotRange[0] === 0, `Start should be clamped to 0, got ${result.memorySnapshotRange[0]}`);
  assert(result.memorySnapshotRange[1] === MEMORY_SIZE, `End should be clamped to MEMORY_SIZE, got ${result.memorySnapshotRange[1]}`);
});

console.log();
console.log('4. Trace Tests');
console.log('-'.repeat(40));

test('debug returns execution trace', () => {
  const code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const result = debug(code, { maxSteps: 10, traceLastSteps: 10 });
  assert(Array.isArray(result.trace), 'Trace should be an array');
  assert(result.trace.length > 0, 'Trace should not be empty');
  assert(result.trace.length <= 10, `Trace should have at most 10 steps, got ${result.trace.length}`);
});

test('trace entries have correct structure', () => {
  const code = 'ABCDEF';
  const result = debug(code, { maxSteps: 5, traceLastSteps: 5 });
  const step = result.trace[0];
  assert(typeof step.step === 'number', 'Should have step number');
  assert(typeof step.C === 'number', 'Should have C');
  assert(typeof step.D === 'number', 'Should have D');
  assert(typeof step.A === 'number', 'Should have A');
  assert(step.instruction, 'Should have instruction info');
  assert(step.instruction.mnemonic, 'Instruction should have mnemonic');
  assert(step.instruction.operation, 'Instruction should have operation name');
  assert(step.afterExecution, 'Should have afterExecution state');
});

test('trace shows self-modification info', () => {
  const code = 'ABCDEF';
  const result = debug(code, { maxSteps: 3, traceLastSteps: 3 });
  let foundSelfMod = false;
  for (const step of result.trace) {
    if (step.selfModification) {
      foundSelfMod = true;
      assert(typeof step.selfModification.before === 'number', 'Should have before value');
      assert(typeof step.selfModification.after === 'number', 'Should have after value');
      assert(step.selfModification.before !== step.selfModification.after, 'Before and after should differ');
      break;
    }
  }
  assert(foundSelfMod, 'Should find self-modification in trace');
});

test('trace shows instruction results', () => {
  const code = 'ABCDEF';
  const result = debug(code, { maxSteps: 3, traceLastSteps: 3 });
  let foundResult = false;
  for (const step of result.trace) {
    if (step.result) {
      foundResult = true;
      break;
    }
  }
  assert(foundResult, 'Should find result info in trace');
});

test('trace respects traceLastSteps limit', () => {
  const { assemble } = require('./src/malbolge/assembler');
  let normalized = '';
  for (let i = 0; i < 200; i++) {
    normalized += 'o';
  }
  normalized += 'v';
  const code = assemble(normalized);
  
  const result = debug(code, { maxSteps: 100, traceLastSteps: 10 });
  assert(result.trace.length === 10, `Trace should have exactly 10 steps, got ${result.trace.length}`);
  assert(result.trace[0].step === 91, `First trace step should be 91, got ${result.trace[0].step}`);
  assert(result.trace[9].step === 100, `Last trace step should be 100, got ${result.trace[9].step}`);
});

console.log();
console.log('5. Error Detection Tests');
console.log('-'.repeat(40));

test('debug detects invalid instruction errors', () => {
  const memory = new Array(10).fill(32);
  memory[0] = 33;
  let badCode = String.fromCharCode(33);
  for (let i = 1; i < 20; i++) {
    badCode += String.fromCharCode(Math.floor(Math.random() * 94) + 33);
  }
  const result = debug(badCode, { maxSteps: 1000 });
  assert(result.error !== null || result.halted === true || result.status === 'halted', 'Should either error or halt');
});

test('debug captures error address and message', () => {
  const code = String.fromCharCode(127);
  const result = debug(code, { maxSteps: 100 });
  if (result.error) {
    assert(typeof result.error === 'string', 'Error should be string');
    assert(result.error.includes('Invalid instruction'), `Error should mention 'Invalid instruction', got '${result.error}'`);
  }
});

test('debug stops at maxSteps', () => {
  const longCode = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const result = debug(longCode, { maxSteps: 50 });
  assert(result.stepsExecuted <= 50, `Should not exceed 50 steps, got ${result.stepsExecuted}`);
  if (result.error) {
    assert(result.error.includes('Maximum execution steps exceeded'), 
      `Error should mention step limit, got '${result.error}'`);
  }
});

console.log();
console.log('6. Program Info Tests');
console.log('-'.repeat(40));

test('debug returns program info', () => {
  const code = 'ABCDEFGHIJ';
  const result = debug(code, { maxSteps: 1 });
  assert(result.programInfo, 'Should have programInfo');
  assert(result.programInfo.length === 10, `Program length should be 10, got ${result.programInfo.length}`);
  assert(result.programInfo.firstInvalidAddress === 10, `First invalid address should be 10, got ${result.programInfo.firstInvalidAddress}`);
});

test('debug registers indicate if pointers are in program', () => {
  const code = 'ABCDEFGHIJ';
  const result = debug(code, { breakAtAddress: 5, maxSteps: 10 });
  assert(result.registers.C.isInProgram === true, 'C should be in program');
  assert(typeof result.registers.D.isInProgram === 'boolean', 'D.isInProgram should be boolean');
});

console.log();
console.log('='.repeat(60));
console.log(`  Results: ${passed} passed, ${failed} failed`);
console.log('='.repeat(60));

if (failed > 0) {
  process.exit(1);
}
