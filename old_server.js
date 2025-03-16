// This is a basic scaffolding for the MVP web app you described. The project will have:
// - Frontend in Svelte Kit
// - Middleware in Node.js/Express
// - Backend using MySQL

import express from 'express';
import bodyParser from 'body-parser';
import mysql from 'mysql2';
import fs from 'fs/promises';
import cors from 'cors'

const app = express();
const port = 3000;

// Middleware for JSON body parsing
app.use(bodyParser.json());

app.use(cors({
  origin: 'http://localhost:5173', // Your Svelte app's URL
  methods: ['GET', 'POST', 'PUT', 'DELETE'], // Allowed methods
}));

// Load database credentials from a configuration file using async/await
let dbConfig;
try {
  const dbConfigData = await fs.readFile('./db_config.json', 'utf8');
  dbConfig = JSON.parse(dbConfigData);
} catch (error) {
  console.error('Error reading database config file:', error);
  process.exit(1);
}

// MySQL database connection
const db = mysql.createConnection({
  host: dbConfig.host,
  user: dbConfig.user,
  password: dbConfig.password,
  database: dbConfig.database
});

db.connect((err) => {
  if (err) {
    console.error('Error connecting to MySQL:', err);
    return;
  }
  console.log('Connected to MySQL');
});

// API Endpoints
app.get('/api/question', async (req, res) => {
  const questionId = parseInt(req.query.questionId, 10);

  if (isNaN(questionId) || questionId < 1) {
    return res.status(400).json({ message: 'Invalid question ID' });
  }

  try {
    console.log(`[GET] /api/question - Fetching question ID: ${questionId}`);

    // Fetch the question
    const [rows] = await db.promise().query(
      'SELECT * FROM questions WHERE question_id = ? LIMIT 1',
      [questionId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Question not found' });
    }

    res.json({ question: rows[0] });

  } catch (err) {
    console.error(`[ERROR] Fetching question ${questionId}: ${err.message}`);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

app.get('/api/questions', async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);  // Ensure page is at least 1
  const limit = Math.max(parseInt(req.query.limit, 10) || 5, 1); // Ensure limit is at least 1
  const offset = (page - 1) * limit;

  try {
    console.log(`[GET] /api/questions - Fetching page ${page} (limit: ${limit})`);

    // Fetch paginated questions + total count in one query
    const query = `
      SELECT q.*, (SELECT COUNT(*) FROM questions) AS total_count
      FROM questions q
      ORDER BY q.question_id
      LIMIT ? OFFSET ?;
    `;

    const [rows] = await db.promise().query(query, [limit, offset]);

    if (rows.length === 0) {
      return res.status(404).json({ message: 'No questions found' });
    }

    // Extract total count from the first row
    const total = rows.length > 0 ? rows[0].total_count : 0;
    const totalPages = Math.ceil(total / limit);

    res.json({
      questions: rows.map(({ total_count, ...q }) => q), // Remove total_count from response
      total,
      totalPages,
      currentPage: page
    });

  } catch (err) {
    console.error(`[ERROR] Fetching questions: ${err.message}`);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

app.get('/api/responses', async (req, res) => {
  const questionId = parseInt(req.query.questionId, 10);

  if (isNaN(questionId) || questionId < 1) {
    return res.status(400).json({ message: 'Invalid question ID' });
  }

  try {
    console.log(`[GET] /api/responses - Fetching latest responses for question ID: ${questionId}`);

    // Query to fetch only the most recent response per model
    const query = `
      SELECT r.* 
      FROM responses r
      INNER JOIN (
          SELECT model, MAX(timestamp) AS latest_timestamp
          FROM responses
          WHERE question_id = ?
          GROUP BY model
      ) latest_responses
      ON r.model = latest_responses.model AND r.timestamp = latest_responses.latest_timestamp
      WHERE r.question_id = ?
      ORDER BY r.model ASC;
    `;

    const [rows] = await db.promise().query(query, [questionId, questionId]);

    if (rows.length === 0) {
      return res.status(404).json({ message: 'No responses found for this question' });
    }

    res.json({ responses: rows });

  } catch (err) {
    console.error(`[ERROR] Fetching responses for question ${questionId}: ${err.message}`);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

app.post('/api/response', async (req, res) => {
  const { questionId, model, responseText, status } = req.body;

  // Validate required fields
  if (!questionId || !model || !responseText || !status) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  // Enforce allowed values for status
  const allowedStatuses = ["in progress", "complete"];
  if (!allowedStatuses.includes(status.toLowerCase())) {
    return res.status(400).json({ message: 'Invalid status. Allowed values: in progress, complete' });
  }

  try {
    console.log(`[POST] /api/response - Modifying response for question ID: ${questionId}, model: ${model}`);

    // Insert new response as a modification (new entry)
    const query = `
      INSERT INTO responses (question_id, model, response_text, status)
      VALUES (?, ?, ?, ?);
    `;

    await db.promise().query(query, [questionId, model, responseText, status]);

    res.status(201).json({ message: 'Response modified successfully' });
  } catch (err) {
    console.error(`[ERROR] Modifying response: ${err.message}`);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

app.get('/api/duration', async (req, res) => {
  const questionId = parseInt(req.query.questionId, 10);
  
  if (isNaN(questionId) || questionId < 1) {
    return res.status(400).json({ message: 'Invalid question ID' });
  }

  try {
    console.log(`[GET] /api/duration - Fetching latest duration for question ID: ${questionId}`);

    const query = `
      SELECT hours_spent, timestamp
      FROM durations
      WHERE question_id = ?
      ORDER BY timestamp DESC
      LIMIT 1;
    `;

    const [rows] = await db.promise().query(query, [questionId]);

    if (rows.length === 0) {
      return res.status(404).json({ message: 'No duration found for this question' });
    }

    res.json(rows[0]);

  } catch (err) {
    console.error(`[ERROR] Fetching duration: ${err.message}`);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

app.post('/api/duration', async (req, res) => {
  const { questionId, hoursSpent } = req.body;

  if (!questionId || isNaN(hoursSpent) || hoursSpent <= 0) {
    return res.status(400).json({ message: 'Invalid question ID or hours spent. Ensure questionId is a number and hoursSpent is greater than 0.' });
  }

  try {
    console.log(`[POST] Adding duration for question ID: ${questionId}, hours spent: ${hoursSpent}`);

    const query = `INSERT INTO durations (question_id, hours_spent) VALUES (?, ?);`;

    await db.promise().query(query, [questionId, hoursSpent]);

    res.status(201).json({ message: 'Duration added successfully' });
  } catch (err) {
    console.error(`[ERROR] Adding duration: ${err.message}`);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

app.get('/api/rating', async (req, res) => {
  const questionId = parseInt(req.query.questionId, 10);

  if (isNaN(questionId) || questionId < 1) {
    return res.status(400).json({ message: 'Invalid question ID' });
  }

  try {
    console.log(`[GET] Fetching rating for question ID: ${questionId}`);

    const query = `
      SELECT * FROM ratings
      WHERE question_id = ?
      ORDER BY timestamp DESC
      LIMIT 1;
    `;

    const [rows] = await db.promise().query(query, [questionId]);

    if (rows.length === 0) {
      return res.status(404).json({ message: 'No rating found for this question' });
    }

    res.json(rows[0]);

  } catch (err) {
    console.error(`[ERROR] Fetching rating: ${err.message}`);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

app.post('/api/rating', async (req, res) => {
  const { questionId, text } = req.body;

  if (!questionId || typeof text !== 'string' || text.trim() === '') {
    return res.status(400).json({ message: 'Invalid question ID or empty text' });
  }

  try {
    console.log(`[POST] Adding rating for question ID: ${questionId}`);

    const query = `
      INSERT INTO ratings (question_id, text)
      VALUES (?, ?);
    `;

    await db.promise().query(query, [questionId, text]);

    res.status(201).json({ message: 'Rating added successfully' });
  } catch (err) {
    console.error(`[ERROR] Adding rating: ${err.message}`);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});


// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}.`);
});
