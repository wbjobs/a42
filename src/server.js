const express = require('express');
const path = require('path');
const { transpile } = require('./compiler/transpiler');
const { interpret, validateProgram, debug, stepDebug, initDebugState, getMemoryPage, decodeOp, MEMORY_SIZE } = require('./malbolge/interpreter');
const { assemble, disassemble } = require('./malbolge/assembler');

const app = express();
const PORT = process.env.PORT || 3000;

const debugSessions = new Map();
const DEBUG_SESSION_TIMEOUT = 30 * 60 * 1000;

function generateSessionId() {
  return 'dbg_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
}

function cleanupExpiredSessions() {
  const now = Date.now();
  for (const [id, session] of debugSessions) {
    if (now - session.lastAccess > DEBUG_SESSION_TIMEOUT) {
      debugSessions.delete(id);
    }
  }
}

setInterval(cleanupExpiredSessions, 60 * 1000);

app.use(express.json({ limit: '1mb' }));

app.use(express.static(path.join(__dirname, '..', 'public')));

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'malbolge-compiler',
    version: '1.0.0'
  });
});

app.post('/api/compile', (req, res) => {
  try {
    const { source, language, options = {} } = req.body;

    if (!source || typeof source !== 'string') {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Source code is required and must be a string'
      });
    }

    if (source.length > 100000) {
      return res.status(400).json({
        error: 'Source too large',
        message: 'Source code must be less than 100,000 characters'
      });
    }

    const result = transpile(source, {
      language: language || 'auto',
      ...options
    });

    res.json({
      success: true,
      malbolgeCode: result.malbolgeCode,
      normalizedCode: result.normalizedCode,
      language: result.language,
      metadata: result.metadata
    });
  } catch (error) {
    console.error('Compile error:', error);
    res.status(500).json({
      error: 'Compilation failed',
      message: error.message
    });
  }
});

app.post('/api/interpret', (req, res) => {
  try {
    const { code, input, maxSteps } = req.body;

    if (!code || typeof code !== 'string') {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Malbolge code is required and must be a string'
      });
    }

    const validation = validateProgram(code);
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Invalid Malbolge code',
        message: 'Code contains invalid characters',
        errors: validation.errors
      });
    }

    const options = {
      input: input || '',
      maxSteps: maxSteps || 1000000
    };

    const result = interpret(code, options);

    res.json({
      success: true,
      output: result.output,
      steps: result.steps,
      halted: result.halted,
      error: result.error,
      finalState: {
        C: result.finalState.C,
        D: result.finalState.D,
        A: result.finalState.A
      }
    });
  } catch (error) {
    console.error('Interpret error:', error);
    res.status(500).json({
      error: 'Execution failed',
      message: error.message
    });
  }
});

app.post('/api/validate', (req, res) => {
  try {
    const { code } = req.body;

    if (!code || typeof code !== 'string') {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Malbolge code is required'
      });
    }

    const result = validateProgram(code);

    res.json({
      valid: result.valid,
      length: result.length,
      errors: result.errors
    });
  } catch (error) {
    res.status(500).json({
      error: 'Validation failed',
      message: error.message
    });
  }
});

app.post('/api/assemble', (req, res) => {
  try {
    const { code } = req.body;

    if (!code || typeof code !== 'string') {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Normalized Malbolge code is required'
      });
    }

    const result = assemble(code);

    res.json({
      success: true,
      malbolgeCode: result
    });
  } catch (error) {
    res.status(400).json({
      error: 'Assembly failed',
      message: error.message
    });
  }
});

app.post('/api/disassemble', (req, res) => {
  try {
    const { code } = req.body;

    if (!code || typeof code !== 'string') {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Malbolge code is required'
      });
    }

    const result = disassemble(code);

    res.json({
      success: true,
      normalizedCode: result
    });
  } catch (error) {
    res.status(500).json({
      error: 'Disassembly failed',
      message: error.message
    });
  }
});

app.post('/api/debug', (req, res) => {
  try {
    const { code, breakAtAddress, maxSteps, memorySnapshotRange, traceLastSteps, input } = req.body;

    if (!code || typeof code !== 'string') {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Malbolge code is required'
      });
    }

    const validation = validateProgram(code);
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Invalid Malbolge code',
        message: 'Code contains invalid characters',
        errors: validation.errors
      });
    }

    if (breakAtAddress !== undefined && breakAtAddress !== null) {
      if (typeof breakAtAddress !== 'number' || breakAtAddress < 0 || breakAtAddress >= 59049) {
        return res.status(400).json({
          error: 'Invalid breakpoint address',
          message: 'breakAtAddress must be a number between 0 and 59048'
        });
      }
    }

    const options = {};
    if (breakAtAddress !== undefined) options.breakAtAddress = breakAtAddress;
    if (maxSteps !== undefined) options.maxSteps = maxSteps;
    if (memorySnapshotRange !== undefined) options.memorySnapshotRange = memorySnapshotRange;
    if (traceLastSteps !== undefined) options.traceLastSteps = traceLastSteps;
    if (input !== undefined) options.input = input;

    const result = debug(code, options);

    res.json({
      success: true,
      status: result.status,
      hitBreakpoint: result.hitBreakpoint,
      breakpointAddress: result.breakpointAddress,
      error: result.error,
      output: result.output,
      stepsExecuted: result.stepsExecuted,
      registers: result.registers,
      currentInstruction: result.currentInstruction,
      nextInstruction: result.nextInstruction,
      memorySnapshot: result.memorySnapshot,
      memorySnapshotRange: result.memorySnapshotRange,
      trace: result.trace,
      programInfo: result.programInfo
    });
  } catch (error) {
    console.error('Debug error:', error);
    res.status(500).json({
      error: 'Debug session failed',
      message: error.message
    });
  }
});

app.post('/api/debug/init', (req, res) => {
  try {
    const { code, input } = req.body;

    if (!code || typeof code !== 'string') {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Malbolge code is required'
      });
    }

    const validation = validateProgram(code);
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Invalid Malbolge code',
        message: 'Code contains invalid characters',
        errors: validation.errors
      });
    }

    const state = initDebugState(code, input || '');

    const sessionId = generateSessionId();
    debugSessions.set(sessionId, {
      state,
      code,
      lastAccess: Date.now()
    });

    const programMemory = [];
    for (let i = 0; i < state.programLength; i++) {
      const val = state.memory[i];
      programMemory.push({
        address: i,
        value: val,
        char: (val >= 33 && val <= 126) ? String.fromCharCode(val) : null,
        decodedOp: (val >= 33 && val <= 126) ? decodeOp(val, i) : null
      });
    }

    const memPageStart = 0;
    const memPageSize = 256;
    const memoryPage = getMemoryPage(state.memory, memPageStart, memPageSize, state.programLength);

    res.json({
      success: true,
      sessionId,
      C: state.C,
      D: state.D,
      A: state.A,
      steps: state.steps,
      output: state.output,
      halted: state.halted,
      error: state.error,
      programLength: state.programLength,
      programMemory,
      memoryPage,
      memoryPageStart: memPageStart,
      normalizedCode: disassemble(code)
    });
  } catch (error) {
    console.error('Debug init error:', error);
    res.status(500).json({
      error: 'Debug init failed',
      message: error.message
    });
  }
});

app.post('/api/debug/step', (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Valid sessionId is required'
      });
    }

    const session = debugSessions.get(sessionId);
    if (!session) {
      return res.status(404).json({
        error: 'Session not found',
        message: 'Debug session has expired or does not exist. Please reload.'
      });
    }

    if (session.state.halted || session.state.error) {
      return res.status(400).json({
        error: 'Program halted',
        message: session.state.error || 'Program has halted'
      });
    }

    const result = stepDebug(session.state);
    session.state = result;
    session.lastAccess = Date.now();

    res.json({
      success: true,
      sessionId,
      C: result.C,
      D: result.D,
      A: result.A,
      steps: result.steps,
      output: result.output,
      inputPos: result.inputPos,
      halted: result.halted,
      error: result.error,
      instruction: result.instruction,
      selfModification: result.selfModification
    });
  } catch (error) {
    console.error('Debug step error:', error);
    res.status(500).json({
      error: 'Debug step failed',
      message: error.message
    });
  }
});

app.post('/api/debug/memory', (req, res) => {
  try {
    const { sessionId, start = 0, size = 256 } = req.body;

    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Valid sessionId is required'
      });
    }

    const session = debugSessions.get(sessionId);
    if (!session) {
      return res.status(404).json({
        error: 'Session not found',
        message: 'Debug session has expired or does not exist'
      });
    }

    session.lastAccess = Date.now();

    const page = getMemoryPage(session.state.memory, start, size, session.state.programLength);

    res.json({
      success: true,
      start,
      size: page.length,
      page,
      C: session.state.C,
      D: session.state.D
    });
  } catch (error) {
    res.status(500).json({
      error: 'Memory query failed',
      message: error.message
    });
  }
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: `Endpoint ${req.method} ${req.path} not found`
  });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Malbolge Compiler API server running on port ${PORT}`);
    console.log(`Endpoints:`);
    console.log(`  GET  /api/health`);
    console.log(`  POST /api/compile`);
    console.log(`  POST /api/interpret`);
    console.log(`  POST /api/validate`);
    console.log(`  POST /api/assemble`);
    console.log(`  POST /api/disassemble`);
  });
}

module.exports = app;
