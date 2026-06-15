import express from 'express';
import dotenv from 'dotenv';
dotenv.config();

console.log('[PROXY] Starting...');
console.log('[PROXY] OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? 'SET' : 'MISSING');
console.log('[PROXY] VECTOR_STORE_ID:', process.env.VECTOR_STORE_ID ? 'SET' : 'MISSING');
console.log('[PROXY] PROXY_SECRET:', process.env.PROXY_SECRET ? 'SET' : 'MISSING');

import { runWorkflow, runWorkflowStream } from './workflow.js';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3001;
const PROXY_SECRET = process.env.PROXY_SECRET || '';
const WORKFLOW_ID = 'wf_69d7e891a0c0819094901345889eabee08500dc2c60bbbce';

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'scip-workflow-proxy', workflow: WORKFLOW_ID });
});

app.post('/run', async (req, res) => {
  const secret = req.headers['x-proxy-secret'];
  if (PROXY_SECRET && secret !== PROXY_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { question } = req.body;
  if (!question) {
    return res.status(400).json({ error: 'question is required' });
  }

  try {
    console.log(`[PROXY] Running workflow for: ${question.slice(0, 60)}`);
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Workflow timed out after 90s')), 90000)
    );
    const result = await Promise.race([runWorkflow({ input_as_text: question }), timeout]);
    const text = result?.output_text || '';
    console.log(`[PROXY] Done — ${text.length} chars`);
    res.json({ success: true, response: text, chars: text.length });
  } catch (error) {
    console.error('[PROXY ERROR]', error.message);
    console.error('[PROXY STACK]', error.stack);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

app.post('/run-stream', async (req, res) => {
  const secret = req.headers['x-proxy-secret'];
  if (PROXY_SECRET && secret !== PROXY_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const { question } = req.body;
  if (!question) {
    return res.status(400).json({ error: 'question is required' });
  }

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders(); // send headers immediately so client knows connection is alive

  let total = '';
  try {
    for await (const chunk of runWorkflowStream({ input_as_text: question })) {
      total += chunk;
      res.write(chunk);
    }
    console.log(`[PROXY] stream done — ${total.length} chars`);
    res.end();
  } catch (err) {
    console.error('[PROXY STREAM ERROR]', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    } else {
      res.end();
    }
  }
});

app.listen(PORT, () => {
  console.log(`SCIP Workflow Proxy running on port ${PORT}`);
});
