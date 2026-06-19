const { interpret, loadProgram, crz, rotr, XLAT2, XLAT2_FROM } = require('./src/malbolge/interpreter');

console.log('=== XLAT2 Table Verification ===');
console.log('XLAT2_FROM length:', XLAT2_FROM.length);
console.log('XLAT2 length:', XLAT2.length);

console.log('\nFirst 10 chars of XLAT2_FROM:', XLAT2_FROM.substring(0, 10).split('').join(' '));
console.log('First 10 chars of XLAT2:', XLAT2.substring(0, 10).split('').join(' '));

console.log('\nTest: xlat2 of "!" (33):', XLAT2[0], '(char code:', XLAT2.charCodeAt(0), ')');
console.log('Test: xlat2 of "Q" (81):', XLAT2[81-33], '(char code:', XLAT2.charCodeAt(81-33), ')');

const catProgram = `(=BA#9"=<;:3y7x54-21q/p-,+*)"!h%B0/.
~P<
<:(8&
66#"!~}|{zyxwvu
gJ%`;

console.log('\n=== Cat Program Info ===');
const cleanProgram = catProgram.replace(/\s/g, '');
console.log('Clean length:', cleanProgram.length);
console.log('First 20 chars:', cleanProgram.substring(0, 20));

console.log('\n=== Memory First 10 Cells ===');
const memory = loadProgram(catProgram);
for (let i = 0; i < 10; i++) {
  console.log(`  [${i}] = ${memory[i]} ('${String.fromCharCode(memory[i])}') op = ${(i + memory[i]) % 94}`);
}

console.log('\n=== Running with Step Tracing (first 50 steps) ===');

function traceInterpret(source, options = {}) {
  const { input = '', maxSteps = 50 } = options;
  
  const memory = loadProgram(source);
  let C = 0;
  let D = 0;
  let A = 0;
  let output = '';
  let inputPos = 0;
  let steps = 0;
  let halted = false;
  let error = null;

  const MEMORY_SIZE = 59049;

  function xlat2(charCode) {
    const idx = charCode - 33;
    if (idx < 0 || idx >= XLAT2.length) {
      return charCode;
    }
    return XLAT2.charCodeAt(idx);
  }

  const opNames = {
    4: 'JMP',
    5: 'OUT',
    23: 'IN',
    39: 'ROT',
    40: 'MOVD',
    62: 'CRAZY',
    68: 'NOP',
    81: 'HALT'
  };

  while (steps < maxSteps) {
    steps++;
    
    const cell = memory[C];
    const op = (C + cell) % 94;
    const opName = opNames[op] || 'NOP?';

    if (cell < 33 || cell > 126) {
      console.log(`Step ${steps}: C=${C}, cell=${cell} (INVALID) - HALTING`);
      halted = true;
      error = 'Invalid instruction (out of printable range)';
      break;
    }

    const originalC = C;
    const oldC = C;
    const oldD = D;
    const oldA = A;

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
        const crazyResult = crz(A, memory[D]);
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

    const oldCell = memory[originalC];
    if (oldCell >= 33 && oldCell <= 126) {
      memory[originalC] = xlat2(oldCell);
    }

    C = (C + 1) % MEMORY_SIZE;
    D = (D + 1) % MEMORY_SIZE;

    console.log(`Step ${steps}: C=${oldC} D=${oldD} A=${oldA} cell=${oldCell}('${String.fromCharCode(oldCell)}') op=${op}(${opName}) -> C=${C} D=${D} A=${A} newCell=${memory[originalC]}('${String.fromCharCode(memory[originalC])}')`);

    if (halted) break;
  }

  return { output, steps, halted, error };
}

const result = traceInterpret(catProgram, { input: 'Hi!', maxSteps: 50 });
console.log('\n=== Result ===');
console.log('Output:', JSON.stringify(result.output));
console.log('Steps:', result.steps);
console.log('Halted:', result.halted);
console.log('Error:', result.error);
