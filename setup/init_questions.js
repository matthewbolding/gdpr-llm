import fs from 'fs/promises';
import fetch from 'node-fetch';

const FILE_PATH = './data/questions.txt';
const API_URL = 'http://localhost:3001/api/questions';
const GET_ALL_URL = 'http://localhost:3001/api/questions?page=1&limit=10000&user_id=1';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

async function fetchExistingQuestions() {
  const res = await fetch(GET_ALL_URL, { method: 'GET' });
  if (!res.ok) {
    throw new Error(`Failed to fetch existing questions: ${res.status}`);
  }

  const data = await res.json();
  return new Map(data.questions.map(q => [q.question_text.trim(), q.question_id]));
}

async function uploadQuestions() {
  try {
    const raw = await fs.readFile(FILE_PATH, 'utf8');
    const lines = raw
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'));

    const existingMap = await fetchExistingQuestions();
    const total = lines.length;
    let skipped = 0;
    let inserted = 0;

    for (const line of lines) {
      const short = line.slice(0, 25) + (line.length > 25 ? '...' : '');

      if (existingMap.has(line)) {
        const existingId = existingMap.get(line);
        console.log(`[SKIP] ${short} → already exists (ID ${existingId})`);
        skipped++;
        continue;
      }

      if (dryRun) {
        console.log(`[DRY-RUN] ${short} → would insert`);
        continue;
      }

      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question_text: line })
      });

      const data = await res.json();

      if (!res.ok) {
        console.error(`[ERROR] ${short} → ${res.status}: ${data.message || 'unknown error'}`);
        continue;
      }

      console.log(`[INSERTED] ${short} → ID ${data.question_id}`);
      inserted++;
    }

    console.log(`Done. Processed ${total} lines (${inserted} inserted, ${skipped} skipped).`);
  } catch (err) {
    console.error(`Fatal error: ${err.message}`);
  }
}

uploadQuestions();
