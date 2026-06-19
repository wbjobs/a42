const http = require('http');
const { transpile } = require('./src/compiler/transpiler');
const { generateForString } = require('./src/malbolge/generator');
const { assemble } = require('./src/malbolge/assembler');

const app = require('./src/server');

const PORT = 3999;

function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: PORT,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: JSON.parse(body)
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: body
          });
        }
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function runTests() {
  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    return fn()
      .then(() => {
        console.log(`  ✓ ${name}`);
        passed++;
      })
      .catch((e) => {
        console.log(`  ✗ ${name}`);
        console.log(`    Error: ${e.message}`);
        failed++;
      });
  }

  console.log('=' .repeat(60));
  console.log('  Malbolge Compiler - API Integration Tests');
  console.log('=' .repeat(60));
  console.log();

  const server = app.listen(PORT);

  try {
    console.log('1. Health Check');
    console.log('-'.repeat(40));

    await test('GET /api/health returns 200', async () => {
      const res = await makeRequest('GET', '/api/health');
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (res.data.status !== 'ok') throw new Error('Expected status: ok');
    });

    console.log();
    console.log('2. Compile Endpoint');
    console.log('-'.repeat(40));

    await test('POST /api/compile with JS code', async () => {
      const res = await makeRequest('POST', '/api/compile', {
        source: 'console.log("Hello!");',
        language: 'javascript'
      });
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (!res.data.malbolgeCode) throw new Error('Expected malbolgeCode in response');
      if (!res.data.normalizedCode) throw new Error('Expected normalizedCode in response');
      if (res.data.language !== 'javascript') throw new Error('Expected language: javascript');
    });

    await test('POST /api/compile with Python code', async () => {
      const res = await makeRequest('POST', '/api/compile', {
        source: 'print("Hello!")',
        language: 'python'
      });
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (!res.data.malbolgeCode) throw new Error('Expected malbolgeCode in response');
    });

    await test('POST /api/compile auto-detect language', async () => {
      const res = await makeRequest('POST', '/api/compile', {
        source: 'console.log("test");'
      });
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (res.data.language !== 'javascript') throw new Error('Should auto-detect javascript');
    });

    await test('POST /api/compile returns 400 for no source', async () => {
      const res = await makeRequest('POST', '/api/compile', {});
      if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
      if (!res.data.error) throw new Error('Expected error in response');
    });

    console.log();
    console.log('3. Interpret Endpoint');
    console.log('-'.repeat(40));

    const simpleProgram = generateForString('Hi');

    await test('POST /api/interpret executes Malbolge code', async () => {
      const res = await makeRequest('POST', '/api/interpret', {
        code: simpleProgram
      });
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (typeof res.data.output !== 'string') throw new Error('Expected output string');
      if (typeof res.data.steps !== 'number') throw new Error('Expected steps number');
    });

    await test('POST /api/interpret with halt-only program', async () => {
      const res = await makeRequest('POST', '/api/interpret', {
        code: 'Q'
      });
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (res.data.halted !== true) throw new Error('Expected halted: true');
      if (res.data.steps !== 1) throw new Error('Expected 1 step');
    });

    console.log();
    console.log('4. Validate Endpoint');
    console.log('-'.repeat(40));

    await test('POST /api/validate valid program', async () => {
      const res = await makeRequest('POST', '/api/validate', {
        code: 'Hello World'
      });
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (res.data.valid !== true) throw new Error('Expected valid: true');
    });

    console.log();
    console.log('5. Assemble Endpoint');
    console.log('-'.repeat(40));

    await test('POST /api/assemble normalized code', async () => {
      const res = await makeRequest('POST', '/api/assemble', {
        code: 'v'
      });
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (!res.data.malbolgeCode) throw new Error('Expected malbolgeCode');
    });

    console.log();
    console.log('6. Disassemble Endpoint');
    console.log('-'.repeat(40));

    await test('POST /api/disassemble malbolge code', async () => {
      const res = await makeRequest('POST', '/api/disassemble', {
        code: 'Q'
      });
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (!res.data.normalizedCode) throw new Error('Expected normalizedCode');
      if (res.data.normalizedCode !== 'v') throw new Error('Expected normalized code v');
    });

    console.log();
    console.log('7. Debug Endpoint');
    console.log('-'.repeat(40));

    await test('POST /api/debug returns state info', async () => {
      const res = await makeRequest('POST', '/api/debug', {
        code: 'ABCDEFGHIJ',
        maxSteps: 5
      });
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (!res.data.registers) throw new Error('Expected registers in response');
      if (!res.data.currentInstruction) throw new Error('Expected currentInstruction in response');
      if (!res.data.memorySnapshot) throw new Error('Expected memorySnapshot in response');
      if (!Array.isArray(res.data.trace)) throw new Error('Expected trace array in response');
    });

    await test('POST /api/debug with breakpoint', async () => {
      let normalized = '';
      for (let i = 0; i < 50; i++) normalized += 'o';
      const code = assemble(normalized);
      const res = await makeRequest('POST', '/api/debug', {
        code: code,
        breakAtAddress: 10,
        maxSteps: 100
      });
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (res.data.hitBreakpoint !== true) throw new Error('Expected hitBreakpoint: true');
      if (res.data.registers.C.value !== 10) throw new Error(`Expected C=10, got ${res.data.registers.C.value}`);
    });

    await test('POST /api/debug with custom memory range', async () => {
      const res = await makeRequest('POST', '/api/debug', {
        code: 'ABCDEFG',
        memorySnapshotRange: [0, 50],
        maxSteps: 3
      });
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (res.data.memorySnapshotRange[0] !== 0) throw new Error('Expected snapshot start 0');
      if (res.data.memorySnapshotRange[1] !== 50) throw new Error('Expected snapshot end 50');
      if (Object.keys(res.data.memorySnapshot).length !== 50) throw new Error('Expected 50 memory entries');
    });

    await test('POST /api/debug with invalid breakpoint returns 400', async () => {
      const res = await makeRequest('POST', '/api/debug', {
        code: 'ABC',
        breakAtAddress: -1
      });
      if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
      if (!res.data.error) throw new Error('Expected error in response');
    });

    await test('POST /api/debug with no code returns 400', async () => {
      const res = await makeRequest('POST', '/api/debug', {});
      if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
      if (!res.data.error) throw new Error('Expected error in response');
    });

    console.log();
    console.log('8. Error Handling');
    console.log('-'.repeat(40));

    await test('404 for unknown route', async () => {
      const res = await makeRequest('GET', '/api/nonexistent');
      if (res.status !== 404) throw new Error(`Expected 404, got ${res.status}`);
    });

    console.log();
    console.log('=' .repeat(60));
    console.log(`  Results: ${passed} passed, ${failed} failed`);
    console.log('=' .repeat(60));

    if (failed > 0) {
      process.exitCode = 1;
    }
  } finally {
    server.close();
  }
}

runTests().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
