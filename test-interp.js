const { interpret, validateProgram, crz, rotr } = require('./src/malbolge/interpreter');

console.log('=== Testing Malbolge Interpreter ===\n');

console.log('1. Testing crz operation:');
console.log('   crz(0, 0) =', crz(0, 0), '(expected: ?)');
console.log('   crz(1, 1) =', crz(1, 1), '(expected: ?)');

console.log('\n2. Testing rotr operation:');
console.log('   rotr(1) =', rotr(1));
console.log('   rotr(3) =', rotr(3));

console.log('\n3. Testing halt program ("Q" at position 0):');
const haltResult = interpret('Q');
console.log('   Output:', JSON.stringify(haltResult.output));
console.log('   Steps:', haltResult.steps);
console.log('   Halted:', haltResult.halted);
console.log('   Error:', haltResult.error);

console.log('\n4. Testing validation:');
const validation = validateProgram('Hello World!');
console.log('   Valid:', validation.valid);
console.log('   Length:', validation.length);

console.log('\n5. Testing cat program (from esolangs):');
const catProgram = `(=BA#9"=<;:3y7x54-21q/p-,+*)"!h%B0/.
~P<
<:(8&
66#"!~}|{zyxwvu
gJ%`;
const catResult = interpret(catProgram, { input: 'Hi!', maxSteps: 100000 });
console.log('   Output:', JSON.stringify(catResult.output));
console.log('   Steps:', catResult.steps);
console.log('   Halted:', catResult.halted);
console.log('   Error:', catResult.error);

console.log('\n=== Tests Complete ===');
