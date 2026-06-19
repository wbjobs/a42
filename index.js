const app = require('./src/server');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log('=' .repeat(60));
  console.log('  Malbolge Compiler API Server');
  console.log('  Backend service that compiles ordinary code into Malbolge');
  console.log('=' .repeat(60));
  console.log();
  console.log(`  Server running on: http://localhost:${PORT}`);
  console.log();
  console.log('  Available endpoints:');
  console.log('    GET  /api/health       - Health check');
  console.log('    POST /api/compile      - Compile source code to Malbolge');
  console.log('    POST /api/interpret    - Interpret and execute Malbolge code');
  console.log('    POST /api/validate     - Validate Malbolge code');
  console.log('    POST /api/assemble     - Assemble normalized Malbolge');
  console.log('    POST /api/disassemble  - Disassemble Malbolge code');
  console.log('    POST /api/debug        - Debug Malbolge with breakpoint');
  console.log();
  console.log('=' .repeat(60));
});
