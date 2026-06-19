const MEMORY_SIZE = 59049;

const XLAT2 = '5z]&gqtyfr$(we4{WP)H-Zn,[%\\3dL+Q;>U!pJS72FhOA1CB6v^=I_0/8|jsb9m<.TVac`uY*MK\'X~xDl}REokN:#?G"i@';
const XLAT2_FROM = '!"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~';

const OP_NAMES = {
  4: { name: 'jump', desc: 'C = [D] - 1 (jump to data pointer address)', mnem: 'i' },
  5: { name: 'output', desc: 'Output A % 256 as character', mnem: '<' },
  23: { name: 'input', desc: 'Read character into A', mnem: '/' },
  39: { name: 'rotate', desc: 'A = [D] = rotr([D])', mnem: '*' },
  40: { name: 'dataptr', desc: 'D = [D] (move data pointer)', mnem: 'j' },
  62: { name: 'crazy', desc: 'A = [D] = crz([D], A)', mnem: 'p' },
  68: { name: 'nop', desc: 'No operation', mnem: 'o' },
  81: { name: 'halt', desc: 'Halt program', mnem: 'v' }
};

function decodeOp(charCode, position) {
  const op = (position + charCode) % 94;
  return OP_NAMES[op] || { name: 'unknown', desc: 'Unknown operation (nop)', mnem: '?', opCode: op };
}

const CRZ_TABLE = [
  [1, 0, 0],
  [1, 0, 2],
  [2, 2, 1]
];

function crz(a, b) {
  let result = 0;
  let place = 1;
  for (let i = 0; i < 10; i++) {
    const aTrit = a % 3;
    const bTrit = b % 3;
    result += CRZ_TABLE[aTrit][bTrit] * place;
    a = Math.floor(a / 3);
    b = Math.floor(b / 3);
    place *= 3;
  }
  return result;
}

function rotr(value) {
  const lsb = value % 3;
  return Math.floor(value / 3) + lsb * 19683;
}

function xlat2(charCode) {
  const idx = charCode - 33;
  if (idx < 0 || idx >= XLAT2.length) {
    return charCode;
  }
  return XLAT2.charCodeAt(idx);
}

function xlat2Char(char) {
  const idx = XLAT2_FROM.indexOf(char);
  if (idx === -1) return char;
  return XLAT2[idx];
}

function loadProgram(source) {
  const memory = new Array(MEMORY_SIZE).fill(0);
  let pos = 0;

  for (let i = 0; i < source.length; i++) {
    const c = source.charCodeAt(i);
    if (c <= 32) continue;
    memory[pos] = c;
    pos++;
    if (pos >= MEMORY_SIZE) break;
  }

  if (pos === 0) {
    return memory;
  }

  if (pos === 1) {
    for (let i = 1; i < MEMORY_SIZE; i++) {
      memory[i] = crz(memory[i - 1], memory[0]);
    }
  } else {
    for (let i = pos; i < MEMORY_SIZE; i++) {
      memory[i] = crz(memory[i - 1], memory[i - 2]);
    }
  }

  return memory;
}

function interpret(source, options = {}) {
  const { input = '', maxSteps = 1000000 } = options;
  
  const memory = loadProgram(source);
  let C = 0;
  let D = 0;
  let A = 0;
  let output = '';
  let inputPos = 0;
  let steps = 0;
  let halted = false;
  let error = null;

  while (steps < maxSteps) {
    steps++;
    
    const cell = memory[C];
    if (cell < 33 || cell > 126) {
      halted = true;
      error = 'Invalid instruction (out of printable range)';
      break;
    }

    const op = (C + cell) % 94;
    const originalC = C;

    switch (op) {
      case 4:
        C = (memory[D] - 1 + MEMORY_SIZE) % MEMORY_SIZE;
        break;
      case 5:
        output += String.fromCharCode(A % 256);
        break;
      case 23:
        if (inputPos < input.length) {
          A = input.charCodeAt(inputPos);
          inputPos++;
        } else {
          A = 0;
        }
        break;
      case 39:
        const rotated = rotr(memory[D]);
        A = rotated;
        memory[D] = rotated;
        break;
      case 40:
        D = memory[D] % MEMORY_SIZE;
        break;
      case 62:
        const crazyResult = crz(memory[D], A);
        A = crazyResult;
        memory[D] = crazyResult;
        break;
      case 68:
        break;
      case 81:
        halted = true;
        break;
      default:
        break;
    }

    if (halted) break;

    const originalCell = memory[originalC];
    if (originalCell >= 33 && originalCell <= 126) {
      memory[originalC] = xlat2(originalCell);
    }

    C = (C + 1) % MEMORY_SIZE;
    D = (D + 1) % MEMORY_SIZE;
  }

  if (steps >= maxSteps && !halted) {
    error = 'Maximum execution steps exceeded';
  }

  return {
    output,
    steps,
    halted,
    error,
    finalState: {
      C,
      D,
      A,
      memory: options.includeMemory ? memory : undefined
    }
  };
}

function validateProgram(source) {
  let pos = 0;
  const errors = [];

  for (let i = 0; i < source.length; i++) {
    const c = source.charCodeAt(i);
    if (c <= 32) continue;
    if (c < 33 || c > 126) {
      errors.push({ position: pos, char: source[i], reason: 'Non-printable character' });
    }
    pos++;
  }

  return {
    valid: errors.length === 0,
    errors,
    length: pos
  };
}

function debug(source, options = {}) {
  const {
    breakAtAddress = null,
    maxSteps = 1000000,
    memorySnapshotRange = [0, 200],
    traceLastSteps = 50,
    input = ''
  } = options;

  const memory = loadProgram(source);
  let C = 0;
  let D = 0;
  let A = 0;
  let output = '';
  let inputPos = 0;
  let steps = 0;
  let halted = false;
  let error = null;
  let hitBreakpoint = false;
  const trace = [];
  const programLength = validateProgram(source).length;

  while (steps < maxSteps) {
    if (breakAtAddress !== null && C === breakAtAddress) {
      hitBreakpoint = true;
      break;
    }

    steps++;
    const stepTrace = { step: steps, C, D, A };

    const cell = memory[C];
    if (cell < 33 || cell > 126) {
      halted = true;
      error = `Invalid instruction at address ${C}: value ${cell} (out of printable range 33-126)`;
      stepTrace.error = error;
      if (trace.length >= traceLastSteps) trace.shift();
      trace.push(stepTrace);
      break;
    }

    const op = (C + cell) % 94;
    const opInfo = decodeOp(cell, C);
    const originalC = C;

    stepTrace.instruction = {
      address: C,
      charCode: cell,
      char: String.fromCharCode(cell),
      opCode: op,
      mnemonic: opInfo.mnem,
      operation: opInfo.name,
      description: opInfo.desc
    };
    stepTrace.memoryD = {
      address: D,
      value: memory[D]
    };

    switch (op) {
      case 4:
        C = (memory[D] - 1 + MEMORY_SIZE) % MEMORY_SIZE;
        stepTrace.result = { jumpTarget: memory[D], newC: C };
        break;
      case 5:
        const outChar = String.fromCharCode(A % 256);
        output += outChar;
        stepTrace.result = { outputChar: outChar, outputCharCode: A % 256 };
        break;
      case 23:
        if (inputPos < input.length) {
          A = input.charCodeAt(inputPos);
          inputPos++;
        } else {
          A = 0;
        }
        stepTrace.result = { newA: A };
        break;
      case 39:
        const rotated = rotr(memory[D]);
        A = rotated;
        memory[D] = rotated;
        stepTrace.result = { rotatedValue: rotated, newA: A };
        break;
      case 40:
        D = memory[D] % MEMORY_SIZE;
        stepTrace.result = { newD: D };
        break;
      case 62:
        const crazyResult = crz(memory[D], A);
        A = crazyResult;
        memory[D] = crazyResult;
        stepTrace.result = { crazyResult, newA: A };
        break;
      case 68:
        stepTrace.result = { note: 'NOP' };
        break;
      case 81:
        halted = true;
        stepTrace.result = { note: 'HALT' };
        break;
      default:
        stepTrace.result = { note: 'NOP (unknown opcode)' };
        break;
    }

    if (trace.length >= traceLastSteps) trace.shift();
    trace.push(stepTrace);

    if (halted) break;

    const originalCell = memory[originalC];
    if (originalCell >= 33 && originalCell <= 126) {
      memory[originalC] = xlat2(originalCell);
      stepTrace.selfModification = {
        address: originalC,
        before: originalCell,
        beforeChar: String.fromCharCode(originalCell),
        after: memory[originalC],
        afterChar: String.fromCharCode(memory[originalC])
      };
    }

    C = (C + 1) % MEMORY_SIZE;
    D = (D + 1) % MEMORY_SIZE;

    stepTrace.afterExecution = { C, D, A };
  }

  if (steps >= maxSteps && !halted && !hitBreakpoint) {
    error = 'Maximum execution steps exceeded';
  }

  const [memStart, memEnd] = memorySnapshotRange;
  const memorySnapshot = {};
  const snapshotStart = Math.max(0, memStart);
  const snapshotEnd = Math.min(MEMORY_SIZE, memEnd);
  for (let i = snapshotStart; i < snapshotEnd; i++) {
    const val = memory[i];
    memorySnapshot[i] = {
      value: val,
      char: (val >= 33 && val <= 126) ? String.fromCharCode(val) : null,
      isInstruction: i < programLength,
      decodedOp: (val >= 33 && val <= 126) ? decodeOp(val, i) : null
    };
  }

  const currentInstruction = (memory[C] >= 33 && memory[C] <= 126) 
    ? {
        address: C,
        charCode: memory[C],
        char: String.fromCharCode(memory[C]),
        decoded: decodeOp(memory[C], C)
      }
    : {
        address: C,
        charCode: memory[C],
        error: 'Invalid instruction at current address'
      };

  const nextInstruction = (memory[(C + 1) % MEMORY_SIZE] >= 33 && memory[(C + 1) % MEMORY_SIZE] <= 126)
    ? {
        address: (C + 1) % MEMORY_SIZE,
        charCode: memory[(C + 1) % MEMORY_SIZE],
        char: String.fromCharCode(memory[(C + 1) % MEMORY_SIZE]),
        decoded: decodeOp(memory[(C + 1) % MEMORY_SIZE], (C + 1) % MEMORY_SIZE)
      }
    : null;

  return {
    status: hitBreakpoint ? 'breakpoint' : (halted ? 'halted' : 'running'),
    error,
    hitBreakpoint,
    breakpointAddress: breakAtAddress,
    output,
    stepsExecuted: steps,
    registers: {
      A: {
        value: A,
        mod256: A % 256,
        char: String.fromCharCode(A % 256),
        trits: A.toString(3).padStart(10, '0')
      },
      C: {
        value: C,
        isInProgram: C < programLength,
        offsetFromProgramStart: C < programLength ? C : `+${C - programLength}`
      },
      D: {
        value: D,
        memoryValue: memory[D],
        memoryChar: (memory[D] >= 33 && memory[D] <= 126) ? String.fromCharCode(memory[D]) : null,
        isInProgram: D < programLength
      }
    },
    currentInstruction,
    nextInstruction,
    memorySnapshot,
    memorySnapshotRange: [snapshotStart, snapshotEnd],
    trace,
    programInfo: {
      length: programLength,
      firstInvalidAddress: programLength
    }
  };
}

function stepDebug(state) {
  const { memory: memoryInput, C: inputC, D: inputD, A: inputA, input: inputStr = '', inputPos = 0, steps = 0, output: currentOutput = '' } = state;

  const memory = memoryInput.slice();
  let C = inputC;
  let D = inputD;
  let A = inputA;
  let output = currentOutput;
  let halted = false;
  let error = null;

  const cell = memory[C];
  if (cell < 33 || cell > 126) {
    halted = true;
    error = `Invalid instruction at address ${C}: value ${cell} (out of printable range 33-126)`;
    return {
      memory,
      C,
      D,
      A,
      output,
      inputPos,
      steps: steps + 1,
      halted,
      error,
      instruction: null,
      selfModification: null
    };
  }

  const op = (C + cell) % 94;
  const opInfo = decodeOp(cell, C);
  const originalC = C;

  const instruction = {
    address: C,
    charCode: cell,
    char: String.fromCharCode(cell),
    opCode: op,
    mnemonic: opInfo.mnem,
    operation: opInfo.name,
    description: opInfo.desc,
    memoryD: { address: D, value: memory[D] }
  };

  let result = {};

  switch (op) {
    case 4:
      C = (memory[D] - 1 + MEMORY_SIZE) % MEMORY_SIZE;
      result = { jumpTarget: memory[D], newC: C };
      break;
    case 5:
      const outChar = String.fromCharCode(A % 256);
      output += outChar;
      result = { outputChar: outChar, outputCharCode: A % 256 };
      break;
    case 23:
      if (inputPos < inputStr.length) {
        A = inputStr.charCodeAt(inputPos);
        inputPos++;
      } else {
        A = 0;
      }
      result = { newA: A };
      break;
    case 39:
      const rotated = rotr(memory[D]);
      A = rotated;
      memory[D] = rotated;
      result = { rotatedValue: rotated, newA: A };
      break;
    case 40:
      D = memory[D] % MEMORY_SIZE;
      result = { newD: D };
      break;
    case 62:
      const crazyResult = crz(memory[D], A);
      A = crazyResult;
      memory[D] = crazyResult;
      result = { crazyResult, newA: A };
      break;
    case 68:
      result = { note: 'NOP' };
      break;
    case 81:
      halted = true;
      result = { note: 'HALT' };
      break;
    default:
      result = { note: 'NOP (unknown opcode)' };
      break;
  }

  instruction.result = result;

  let selfModification = null;
  if (!halted) {
    const originalCell = memory[originalC];
    if (originalCell >= 33 && originalCell <= 126) {
      memory[originalC] = xlat2(originalCell);
      if (originalCell !== memory[originalC]) {
        selfModification = {
          address: originalC,
          before: originalCell,
          beforeChar: String.fromCharCode(originalCell),
          after: memory[originalC],
          afterChar: String.fromCharCode(memory[originalC])
        };
      }
    }

    C = (C + 1) % MEMORY_SIZE;
    D = (D + 1) % MEMORY_SIZE;
  }

  return {
    memory,
    C,
    D,
    A,
    output,
    inputPos,
    steps: steps + 1,
    halted,
    error,
    instruction,
    selfModification
  };
}

function initDebugState(source, input = '') {
  const memory = loadProgram(source);
  return {
    memory,
    C: 0,
    D: 0,
    A: 0,
    input,
    inputPos: 0,
    steps: 0,
    output: '',
    halted: false,
    error: null,
    programLength: validateProgram(source).length
  };
}

function getMemoryPage(memory, start, size, programLength) {
  const result = [];
  const end = Math.min(start + size, MEMORY_SIZE);
  for (let i = start; i < end; i++) {
    const val = memory[i];
    result.push({
      address: i,
      value: val,
      char: (val >= 33 && val <= 126) ? String.fromCharCode(val) : null,
      isInstruction: i < programLength,
      decodedOp: (val >= 33 && val <= 126) ? decodeOp(val, i) : null
    });
  }
  return result;
}

module.exports = {
  interpret,
  validateProgram,
  loadProgram,
  debug,
  stepDebug,
  initDebugState,
  getMemoryPage,
  decodeOp,
  crz,
  rotr,
  MEMORY_SIZE,
  XLAT2,
  XLAT2_FROM,
  OP_NAMES
};
