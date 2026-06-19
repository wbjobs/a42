const MEMORY_SIZE = 59049;

const XLAT2 = '5z]&gqtyfr$(we4{WP)H-Zn,[%\\3dL+Q;>U!pJS72FhOA1CB6v^=I_0/8|jsb9m<.TVac`uY*MK\'X~xDl}REokN:#?G"i@';
const XLAT2_FROM = '!"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~';

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

module.exports = {
  interpret,
  validateProgram,
  loadProgram,
  crz,
  rotr,
  MEMORY_SIZE,
  XLAT2,
  XLAT2_FROM
};
