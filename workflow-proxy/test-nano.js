import OpenAI from 'openai';
import dotenv from 'dotenv';
dotenv.config();

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function test() {
  console.log('Testing gpt-5-nano...');
  console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? 'SET' : 'MISSING');

  // Test 1: Most basic call possible
  try {
    const r1 = await client.responses.create({
      model: 'gpt-5-nano',
      input: 'Say hello',
    });
    console.log('\n--- Test 1: Basic call ---');
    console.log('output:', JSON.stringify(r1.output, null, 2));
    console.log('output_text:', r1.output_text);
  } catch (e) {
    console.log('\n--- Test 1: Basic call ---');
    console.log('ERROR:', e.message);
  }

  // Test 2: With reasoning
  try {
    const r2 = await client.responses.create({
      model: 'gpt-5-nano',
      reasoning: { effort: 'low' },
      input: 'What is 2+2?',
    });
    console.log('\n--- Test 2: With reasoning ---');
    console.log('output:', JSON.stringify(r2.output, null, 2));
    console.log('output_text:', r2.output_text);
  } catch (e) {
    console.log('\n--- Test 2: With reasoning ---');
    console.log('ERROR:', e.message);
  }

  // Test 3: With system message
  try {
    const r3 = await client.responses.create({
      model: 'gpt-5-nano',
      input: [
        { role: 'system', content: 'You are a doctor.' },
        { role: 'user',   content: 'Treatment of UTI?' },
      ],
    });
    console.log('\n--- Test 3: With system message ---');
    console.log('output:', JSON.stringify(r3.output, null, 2));
    console.log('output_text:', r3.output_text);
  } catch (e) {
    console.log('\n--- Test 3: With system message ---');
    console.log('ERROR:', e.message);
  }
}

test().catch(console.error);
