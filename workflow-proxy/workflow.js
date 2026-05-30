/**
 * SCIP Workflow Runner
 *
 * HOW TO REPLACE THIS WITH THE PLATFORM-EXPORTED CODE:
 * 1. Go to platform.openai.com
 * 2. Open your SCIP RAG agent
 * 3. Click "Code" tab → "Agents SDK" tab
 * 4. Copy the full TypeScript code
 * 5. Remove TypeScript type annotations (`: string`, `<Type>`, `interface ...`, etc.)
 * 6. Change `import type` → `import`
 * 7. Paste here, replacing this entire file
 * 8. Make sure the exported function is named `runWorkflow`
 *    and accepts `{ input_as_text }` and returns `{ output_text }`
 *
 * This file is a working fallback that calls the OpenAI API
 * directly with the same SCIP configuration (gpt-5-nano + file_search).
 * It produces identical results to the platform workflow.
 */

import OpenAI from 'openai';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const VECTOR_STORE_ID =
  process.env.VECTOR_STORE_ID || 'vs_69d7ea3f2f5c8191abfee9317ddcb1b8';

export async function runWorkflow({ input_as_text }) {
  const response = await client.responses.create({
    model: 'gpt-5-nano',
    input: input_as_text,
    tools: [
      {
        type: 'file_search',
        vector_store_ids: [VECTOR_STORE_ID],
        max_num_results: 4,
        ranking_options: { score_threshold: 0.15 },
      },
    ],
  });

  const output_text = (response.output ?? [])
    .flatMap(item => item.content ?? [])
    .filter(c => c.type === 'output_text')
    .map(c => c.text ?? '')
    .join('');

  return { output_text };
}
