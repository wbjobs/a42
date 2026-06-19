const { crz, rotr, MEMORY_SIZE, XLAT2, XLAT2_FROM } = require('./interpreter');
const { assemble, OPCODES } = require('./assembler');

function xlat2CharCode(code) {
  const idx = code - 33;
  if (idx < 0 || idx >= XLAT2.length) return code;
  return XLAT2.charCodeAt(idx);
}

function generateForString(targetString, options = {}) {
  const {
    maxIterations = 5000,
    programLengthCap = 500
  } = options;

  if (targetString.length === 0) {
    return assemble('v');
  }

  let bestProgram = null;
  let bestOutput = '';

  const targetCodes = [];
  for (let i = 0; i < targetString.length; i++) {
    targetCodes.push(targetString.charCodeAt(i));
  }

  const programTemplates = [
    () => generateLinear(targetCodes, maxIterations, programLengthCap),
    () => generateWithCrazy(targetCodes, maxIterations, programLengthCap)
  ];

  for (const template of programTemplates) {
    try {
      const result = template();
      if (result && result.output === targetString) {
        return result.program;
      }
      if (result && (!bestProgram || result.output.length > bestOutput.length)) {
        bestProgram = result.program;
        bestOutput = result.output;
      }
    } catch (e) {
    }
  }

  if (bestProgram) {
    return bestProgram;
  }

  return generateFallback(targetString);
}

function generateLinear(targetCodes, maxIterations, maxLength) {
  const memory = new Array(MEMORY_SIZE).fill(0);
  let C = 0;
  let D = 0;
  let A = 0;
  let output = '';
  let program = '';
  let pos = 0;

  const opChoices = [
    { op: '*', code: 39, name: 'rot' },
    { op: 'p', code: 62, name: 'crazy' },
    { op: 'j', code: 40, name: 'movd' },
    { op: 'o', code: 68, name: 'nop' }
  ];

  let targetIdx = 0;
  let iterations = 0;

  while (targetIdx < targetCodes.length && pos < maxLength && iterations < maxIterations) {
    iterations++;

    const targetChar = targetCodes[targetIdx];

    if (A % 256 === targetChar) {
      const opCode = 5;
      let charCode = (opCode - pos) % 94;
      if (charCode < 0) charCode += 94;
      if (charCode < 33) charCode += 94;
      
      const originalC = C;
      output += String.fromCharCode(A % 256);
      
      const oldCell = memory[originalC];
      if (oldCell >= 33 && oldCell <= 126) {
        memory[originalC] = xlat2CharCode(oldCell);
      }
      
      C = (C + 1) % MEMORY_SIZE;
      D = (D + 1) % MEMORY_SIZE;
      
      program += String.fromCharCode(charCode);
      pos++;
      targetIdx++;
      continue;
    }

    let bestOp = null;
    let bestScore = Infinity;

    for (const op of opChoices) {
      let testA = A;
      let testD = D;
      let testMem = memory[D];

      switch (op.code) {
        case 39:
          testA = rotr(memory[D]);
          testMem = testA;
          break;
        case 62:
          testA = crz(memory[D], A);
          testMem = testA;
          break;
        case 40:
          testD = memory[D] % MEMORY_SIZE;
          break;
        case 68:
          break;
      }

      const score = Math.abs((testA % 256) - targetChar);
      if (score < bestScore) {
        bestScore = score;
        bestOp = op;
      }
    }

    if (!bestOp) break;

    let charCode = (bestOp.code - pos) % 94;
    if (charCode < 0) charCode += 94;
    if (charCode < 33) charCode += 94;

    const originalC = C;
    const oldCell = memory[originalC];

    switch (bestOp.code) {
      case 39:
        const rotated = rotr(memory[D]);
        A = rotated;
        memory[D] = rotated;
        break;
      case 62:
        const crazyResult = crz(memory[D], A);
        A = crazyResult;
        memory[D] = crazyResult;
        break;
      case 40:
        D = memory[D] % MEMORY_SIZE;
        break;
      case 68:
        break;
    }

    if (oldCell >= 33 && oldCell <= 126) {
      memory[originalC] = xlat2CharCode(oldCell);
    }

    C = (C + 1) % MEMORY_SIZE;
    D = (D + 1) % MEMORY_SIZE;

    program += String.fromCharCode(charCode);
    pos++;
  }

  if (targetIdx < targetCodes.length) {
    let haltCode = (81 - pos) % 94;
    if (haltCode < 0) haltCode += 94;
    if (haltCode < 33) haltCode += 94;
    program += String.fromCharCode(haltCode);
  }

  return { program, output };
}

function generateWithCrazy(targetCodes, maxIterations, maxLength) {
  const memory = new Array(MEMORY_SIZE).fill(0);
  memory[0] = OPCODES['o'];
  for (let i = 1; i < MEMORY_SIZE; i++) {
    memory[i] = crz(memory[i - 1], memory[Math.max(0, i - 2)]);
  }

  let program = '';
  let output = '';
  let pos = 0;
  let dPtr = 0;
  let aReg = 0;

  const ops = ['*', 'p', 'j', 'o', '<'];
  let targetIdx = 0;
  let iterations = 0;

  while (targetIdx < targetCodes.length && pos < maxLength && iterations < maxIterations) {
    iterations++;

    const target = targetCodes[targetIdx];
    
    if (aReg % 256 === target) {
      program += '<';
      output += String.fromCharCode(target);
      pos++;
      targetIdx++;
      continue;
    }

    let bestOp = null;
    let bestDist = Infinity;
    let bestNextA = aReg;
    let bestNextD = dPtr;

    for (const opChar of ops) {
      if (opChar === '<') continue;
      
      let testA = aReg;
      let testD = dPtr;
      
      switch (opChar) {
        case '*':
          testA = rotr(memory[dPtr]);
          break;
        case 'p':
          testA = crz(memory[dPtr], aReg);
          break;
        case 'j':
          testD = memory[dPtr] % MEMORY_SIZE;
          break;
        case 'o':
          break;
      }

      const dist = Math.abs((testA % 256) - target);
      if (dist < bestDist) {
        bestDist = dist;
        bestOp = opChar;
        bestNextA = testA;
        bestNextD = testD;
      }
    }

    if (!bestOp) break;

    program += bestOp;
    pos++;

    if (bestOp === '*') {
      memory[dPtr] = rotr(memory[dPtr]);
      aReg = memory[dPtr];
    } else if (bestOp === 'p') {
      memory[dPtr] = crz(memory[dPtr], aReg);
      aReg = memory[dPtr];
    } else if (bestOp === 'j') {
      dPtr = memory[dPtr] % MEMORY_SIZE;
    }
  }

  if (targetIdx < targetCodes.length) {
    program += 'v';
  }

  const assembled = assemble(program);
  return { program: assembled, output };
}

function generateFallback(targetString) {
  let normalized = '';
  for (let i = 0; i < targetString.length * 3; i++) {
    normalized += 'op';
    if (i % 2 === 0) normalized += '<';
  }
  normalized += 'v';
  
  try {
    return assemble(normalized);
  } catch (e) {
    return assemble('o'.repeat(targetString.length * 5) + 'v');
  }
}

module.exports = {
  generateForString
};
