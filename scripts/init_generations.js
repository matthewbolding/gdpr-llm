import dotenv from 'dotenv';
import path from 'path';
import fetch from 'node-fetch';
import fs from 'fs/promises';
import os from 'os';

dotenv.config();

const QUESTIONS_API = 'http://10.126.1.103:3001/api/questions';
const MODELS_API = 'http://localhost:3001/api/models';
const GENERATIONS_API = 'http://localhost:3001/api/generations';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL_NAMES = ['google/gemini-2.0-flash-001', 'anthropic/claude-3.7-sonnet', 'openai/gpt-4o-mini'];
const GENERATIONS_PATH = path.join(os.homedir(), 'gdpr-llm', 'data', 'generations.json');

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

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

// Main script function...
async function uploadGenerations() {
  if (!OPENROUTER_API_KEY) {
    console.error('OPENROUTER_API_KEY not set.');
    process.exit(1);
  }

  // Loads the generations from data/generations.json...
  const generationsOutput = await loadExistingGenerations();

  // Loads the questions from the database...
  const questions = await fetchQuestions();

  // Ensures that all the models specified in MODEL_NAMES exist in the database...
  const modelMap = await ensureModels();

  // Iterate over the questions...
  for (const question of questions) {
    console.log(`[INFO] Processing Question ${question.question_id}...`);
    const short = question.question_text.slice(0, 25) + '...';

    // Fetches all the existing model_ids for a given question_id...
    const existingModelIds = await fetchExistingGenerationModelIds(question.question_id);

    // Iterate over the chosen models...
    for (const modelName of MODEL_NAMES) {
      const model_id = modelMap.get(modelName);

      // Skip if PK (question_id, model_id) already exists in the database...
      if (existingModelIds.has(model_id)) {
        console.log(`[SKIP] Already has generation for question ${question.question_id}, model ID ${model_id}`);
        continue;
      }

      // Check if there's a generation already saved locally...
      const existingLocal = generationsOutput.find(
        g => g.question_id === question.question_id && g.model_id === model_id
      );

      let content;
      if (existingLocal) {
        console.log(`[REUSE] Using local generation for question ${question.question_id}, model ID ${model_id}`);
        content = existingLocal.generation_text;
      } else {
        // Otherwise generate fresh content from OpenRouter
        console.log(`[GEN] ${short} using ${modelName}`);
        try {
          content = await generateFromModel(question, modelName);
        } catch (err) {
          console.error(`[ERROR] Generation failed for model ${modelName}: ${err.message}`);
          continue;
        }

        if (!content) {
          console.warn(`[WARN] No content returned for question ${question.question_id} using ${modelName}`);
          continue;
        }

        // Add new generation to local copy...
        generationsOutput.push({
          question_id: question.question_id,
          model_id,
          modelName,
          generation_text: content
        });
      }

      // Post generation to database...
      const body = {
        question_id: question.question_id,
        generation_text: content,
        model_name: modelName
      };

      const res = await fetch(GENERATIONS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await res.json();
      if (!res.ok) {
        console.error(`[ERROR] Failed to insert generation: ${data.message}`);
      } else {
        console.log(`[INSERTED] Generation ID ${data.generation_id}`);
      }
    }
  }

  await saveAllGenerations(generationsOutput);
}

uploadGenerations();
