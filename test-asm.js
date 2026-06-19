const { assemble, disassemble, opToChar, charToOp } = require('./src/malbolge/assembler');

console.log('=== Testing Assembler ===\n');

console.log('1. Testing opToChar for position 0:');
const ops = [4, 5, 23, 39, 40, 62, 68, 81];
const mnem = ['i', '<', '/', '*', 'j', 'p', 'o', 'v'];
for (let i = 0; i < ops.length; i++) {
  const charCode = opToChar(ops[i], 0);
  console.log(`   op ${ops[i]} (${mnem[i]}) -> char ${charCode} ('${String.fromCharCode(charCode)}')`);
}

console.log('\n2. Testing with cat program normalized:');
const catNormalized = `jpoo*pjoooop*ojoopoo*ojoooooppjoivvv
o/i
<iviv
i<vvvvvvvvvvvvv
oji`;

const assembled = assemble(catNormalized);
console.log('   Assembled length:', assembled.length);
console.log('   First 30 chars:', assembled.substring(0, 30));

console.log('\n3. Testing round-trip (normalize -> disassemble:');
const disassembled = disassemble(assembled);
console.log('   Disassembled length:', disassembled.length);
console.log('   Match:', disassembled === catNormalized.replace(/\s/g, ''));

console.log('\n4. Testing with original cat program:');
const catOriginal = `(=BA#9"=<;:3y7x54-21q/p-,+*)"!h%B0/.
~P<
<:(8&
66#"!~}|{zyxwvu
gJ%`;
const disOrig = disassemble(catOriginal);
console.log('   Disassembled:', disOrig);

console.log('\n=== Tests Complete ===');
