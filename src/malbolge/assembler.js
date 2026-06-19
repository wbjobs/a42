const OPCODES = {
  'j': 40,
  'i': 4,
  '*': 39,
  'p': 62,
  '<': 5,
  '/': 23,
  'v': 81,
  'o': 68
};

const MNEMONICS = {};
for (const [mnem, op] of Object.entries(OPCODES)) {
  MNEMONICS[op] = mnem;
}

function opToChar(opCode, position) {
  let c = (opCode - position) % 94;
  if (c < 0) c += 94;
  if (c < 33) c += 94;
  return c;
}

function charToOp(charCode, position) {
  return (position + charCode) % 94;
}

function assemble(normalizedSource) {
  let result = '';
  let pos = 0;
  for (let i = 0; i < normalizedSource.length; i++) {
    const c = normalizedSource[i];
    if (c <= ' ' || c.charCodeAt(0) <= 32) continue;
    const opCode = OPCODES[c];
    if (opCode === undefined) {
      throw new Error(`Unknown mnemonic '${c}' at position ${pos}`);
    }
    const charCode = opToChar(opCode, pos);
    result += String.fromCharCode(charCode);
    pos++;
  }
  return result;
}

function disassemble(malbolgeSource) {
  let result = '';
  let pos = 0;
  for (let i = 0; i < malbolgeSource.length; i++) {
    const c = malbolgeSource.charCodeAt(i);
    if (c <= 32) continue;
    const opCode = charToOp(c, pos);
    const mnem = MNEMONICS[opCode] || '?';
    result += mnem;
    pos++;
  }
  return result;
}

module.exports = {
  assemble,
  disassemble,
  opToChar,
  charToOp,
  OPCODES,
  MNEMONICS
};
