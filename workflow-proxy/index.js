import express from 'express';
import dotenv from 'dotenv';
dotenv.config();

import { runWorkflow } from './workflow.js';

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
    const result = await runWorkflow({ input_as_text: question });
    const text = result?.output_text || '';
    console.log(`[PROXY] Done — ${text.length} chars`);
    res.json({ success: true, response: text, chars: text.length });
  } catch (error) {
    console.error('[PROXY ERROR]', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`SCIP Workflow Proxy running on port ${PORT}`);
});
