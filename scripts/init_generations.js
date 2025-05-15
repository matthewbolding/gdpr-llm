import dotenv from 'dotenv';
import path from 'path';
import fetch from 'node-fetch';
import fs from 'fs/promises';
import os from 'os';

dotenv.config();

const QUESTIONS_API = 'http://10.126.1.103:3001/api/questions?page=1&limit=2';
const MODELS_API = 'http://localhost:3001/api/models';
const GENERATIONS_API = 'http://localhost:3001/api/generations';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL_NAMES = ['google/gemini-2.0-flash-001', 'anthropic/claude-3.7-sonnet', 'openai/gpt-4o-mini'];
const GENERATIONS_PATH = path.join(os.homedir(), 'gdpr-llm', 'data', 'generations.json');

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const dryRun = process.argv.includes('--dry-run');

// Load existing generations JSON file (or start fresh)
async function loadExistingGenerations() {
  try {
    const data = await fs.readFile(GENERATIONS_PATH, 'utf8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function saveAllGenerations(allGenerations) {
  await fs.writeFile(GENERATIONS_PATH, JSON.stringify(allGenerations, null, 2));
}

async function fetchQuestions() {
  const res = await fetch(QUESTIONS_API);
  if (!res.ok) throw new Error(`Failed to fetch questions: ${res.status}`);
  return (await res.json()).questions;
}

async function ensureModels() {
  const res = await fetch(MODELS_API);
  if (!res.ok) throw new Error('Failed to fetch models');
  const data = await res.json();

  const existing = new Map(data.map(m => [m.model_name, m.model_id]));
  const map = new Map(existing);

  for (const name of MODEL_NAMES) {
    if (!existing.has(name)) {
      const r = await fetch(MODELS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model_name: name })
      });
      const d = await r.json();
      map.set(name, d.model_id);
      console.log(`[MODEL] Created "${name}" → ID ${d.model_id}`);
    }
  }

  return map;
}

async function fetchExistingGenerationModelIds(questionId) {
  const res = await fetch(`${GENERATIONS_API}?question_id=${questionId}`);
  if (!res.ok) return new Set();
  const data = await res.json();
  return new Set(data.generations.map(g => g.model_id));
}

async function generateFromModel(question, modelName) {
  const prompt = `I have a GDPR-based legal question I'd like for you to answer. Provide your response in IRAC (Issue, Rules, Application, and Conclusion) format. Do not stylize your answers with emojis, bold typeface, or italics. Do not use Markdown syntax. You may use paragraphs and enumerated and itemized lists.\n\n${question.question_text}`;
  const payload = {
    model: modelName,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.25
  };

  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) throw new Error(`OpenRouter error for model ${modelName}: ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim();
}

async function uploadGenerations() {
  if (!OPENROUTER_API_KEY) {
    console.error('OPENROUTER_API_KEY not set.');
    process.exit(1);
  }

  const generationsOutput = await loadExistingGenerations();
  const questions = await fetchQuestions();
  const modelMap = await ensureModels();

  for (const question of questions) {
    const short = question.question_text.slice(0, 25) + '...';
    const existingModelIds = await fetchExistingGenerationModelIds(question.question_id);

    for (const modelName of MODEL_NAMES) {
      const model_id = modelMap.get(modelName);

      if (existingModelIds.has(model_id)) {
        console.log(`[SKIP] Already has generation for question ${question.question_id}, model ID ${model_id}`);
        continue;
      }

      console.log(`[GEN] ${short} using ${modelName}`);

      const content = await generateFromModel(question, modelName);
      if (!content) {
        console.warn(`[WARN] No content returned for question ${question.question_id} using ${modelName}`);
        continue;
      }

      generationsOutput.push({
        question_id: question.question_id,
        model_id,
        generation_text: content
      });

      if (dryRun) {
        console.log(`[DRY-RUN] Would insert generation for question ${question.question_id}, model ID ${model_id}`);
      } else {
        const res = await fetch(GENERATIONS_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question_id: question.question_id,
            generation_text: content,
            model_name: modelName
          })
        });

        const data = await res.json();
        if (!res.ok) {
          console.error(`[ERROR] Failed to insert generation: ${data.message}`);
        } else {
          console.log(`[INSERTED] Generation ID ${data.generation_id}`);
        }
      }
    }
  }

  await saveAllGenerations(generationsOutput);
}

uploadGenerations();
