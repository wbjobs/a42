const express = require('express');
const path = require('path');
const { transpile } = require('./compiler/transpiler');
const { interpret, validateProgram } = require('./malbolge/interpreter');
const { assemble, disassemble } = require('./malbolge/assembler');

const app = express();
const PORT = process.env.PORT || 3000;

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
