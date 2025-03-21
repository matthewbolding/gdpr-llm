import express from 'express';
import bodyParser from 'body-parser';
import mysql from 'mysql2';
import fs from 'fs/promises';
import cors from 'cors';
import { time } from 'console';

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
const db = mysql.createPool({
  host: dbConfig.host,
  user: dbConfig.user,
  password: dbConfig.password,
  database: dbConfig.database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
}).promise();

// API Endpoint to fetch paginated questions
app.get('/api/questions', async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);  // Ensure page is at least 1
  const limit = Math.max(parseInt(req.query.limit, 10) || 5, 1); // Ensure limit is at least 1
  const offset = (page - 1) * limit;
  const searchQuery = req.query.search ? `%${req.query.search}%` : '%';

  try {
    console.log(`[GET] /api/questions - Fetching page ${page} (limit: ${limit}) with search query: ${req.query.search || 'None'}`);

    // Fetch paginated questions + total count in one query with search functionality
    const query = `
      SELECT q.*, (SELECT COUNT(*) FROM questions WHERE question_text LIKE ?) AS total_count
      FROM questions q
      WHERE q.question_text LIKE ?
      ORDER BY q.question_id
      LIMIT ? OFFSET ?;
    `;

    const [rows] = await db.query(query, [searchQuery, searchQuery, limit, offset]);

    if (rows.length === 0) {
      return res.status(404).json({ message: 'No questions found.' });
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

app.get('/api/question', async (req, res) => {
  const questionId = parseInt(req.query.question_id, 10);
  if (isNaN(questionId)) {
    return res.status(400).json({ message: 'Invalid question_id' });
  }

  try {
    console.log(`[GET] /api/question?question_id=${questionId} - Fetching question text`);
    
    const query = `SELECT question_text FROM questions WHERE question_id = ?`;
    const [rows] = await db.query(query, [questionId]);

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Question not found' });
    }

    res.json({
      question_id: questionId,
      question_text: rows[0].question_text
    });
  } catch (err) {
    console.error(`[ERROR] Fetching question ${questionId}: ${err.message}`);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

app.get('/api/generations', async (req, res) => {
  const questionId = parseInt(req.query.question_id, 10);
  if (isNaN(questionId)) {
    return res.status(400).json({ message: 'Invalid question_id' });
  }

  try {
    console.log(`[GET] /api/generations?question_id=${questionId} - Fetching generations`);
    
    const query = `
      SELECT g.generation_id, g.generation_text, m.model_name
      FROM generations g
      JOIN models m ON g.model_id = m.model_id
      WHERE g.question_id = ?
      ORDER BY g.generation_id;
    `;
    
    const [rows] = await db.query(query, [questionId]);

    if (rows.length === 0) {
      return res.status(404).json({ message: 'No generations found for this question.' });
    }

    res.json({
      question_id: questionId,
      generations: rows
    });
  } catch (err) {
    console.error(`[ERROR] Fetching generations for question ${questionId}: ${err.message}`);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

app.get('/api/pairs', async (req, res) => {
  const questionId = parseInt(req.query.question_id, 10);
  if (isNaN(questionId)) {
    return res.status(400).json({ message: 'Invalid question_id.' });
  }

  try {
    console.log(`[GET] /api/pairs?question_id=${questionId} - Fetching pairs`);
    
    const query = `
      SELECT g1.generation_id AS gen_1_id, g1.generation_text AS gen_1_text, m1.model_id AS gen_1_model_id,
             g2.generation_id AS gen_2_id, g2.generation_text AS gen_2_text, m2.model_id AS gen_2_model_id
      FROM generations g1
      JOIN generations g2 ON g1.question_id = g2.question_id AND g1.generation_id < g2.generation_id
      JOIN models m1 ON g1.model_id = m1.model_id
      JOIN models m2 ON g2.model_id = m2.model_id
      WHERE g1.question_id = ?
      ORDER BY g1.generation_id, g2.generation_id;
    `;
    
    const [rows] = await db.query(query, [questionId]);

    if (rows.length === 0) {
      return res.status(404).json({ message: 'No generation pairs found for this question.' });
    }

    res.json({
      question_id: questionId,
      pairs: rows
    });
  } catch (err) {
    console.error(`[ERROR] Fetching generation pairs for question ${questionId}: ${err.message}`);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

app.post('/api/rate', async (req, res) => {
  const { question_id, gen_1_id, gen_2_id, selection, time_spent } = req.body;
  
  if (!question_id || !gen_1_id || !gen_2_id || !selection || !time_spent) {
    return res.status(400).json({ message: 'Missing required fields.' });
  }

  const validSelections = [
    'both_unusable',
    'gen_1_usable',
    'gen_2_usable',
    'both_usable_pref_1',
    'both_usable_pref_2',
    'both_usable_no_pref'
  ];

  if (!validSelections.includes(selection)) {
    return res.status(400).json({ message: 'Invalid selection value.' });
  }

  try {
    console.log(`[POST] /api/rate - Saving rating for question ${question_id}, pair (${gen_1_id}, ${gen_2_id})`);
  
    const query = `
      INSERT INTO ratings (question_id, gen_id_1, gen_id_2, user_selection, time_spent_seconds)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE user_selection = VALUES(user_selection), time_spent_seconds = VALUES(time_spent_seconds);
    `;
  
    await db.query(query, [question_id, gen_1_id, gen_2_id, selection, time_spent]);
  
    res.status(200).json({ message: 'Rating submitted successfully' });
  } catch (err) {
    console.error(`[ERROR] Saving rating: ${err.message}`);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

app.get('/api/ratings', async (req, res) => {
  const questionId = parseInt(req.query.question_id, 10);
  if (isNaN(questionId)) {
    return res.status(400).json({ message: 'Invalid question_id' });
  }

  try {
    console.log(`[GET] /api/ratings?question_id=${questionId} - Fetching latest ratings`);
    
    const query = `
      SELECT r.rating_id, r.question_id, r.gen_id_1, r.gen_id_2, r.user_selection, r.timestamp
      FROM ratings r
      INNER JOIN (
        SELECT question_id, gen_id_1, gen_id_2, MAX(timestamp) AS latest_timestamp
        FROM ratings
        WHERE question_id = ?
        GROUP BY question_id, gen_id_1, gen_id_2
      ) latest_ratings
      ON r.question_id = latest_ratings.question_id
      AND r.gen_id_1 = latest_ratings.gen_id_1
      AND r.gen_id_2 = latest_ratings.gen_id_2
      AND r.timestamp = latest_ratings.latest_timestamp
      ORDER BY r.timestamp DESC;
    `;
    
    const [rows] = await db.query(query, [questionId]);

    if (rows.length === 0) {
      return res.status(404).json({ message: 'No ratings found for this question.' });
    }

    res.json({
      question_id: questionId,
      ratings: rows
    });
  } catch (err) {
    console.error(`[ERROR] Fetching latest ratings for question ${questionId}: ${err.message}`);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

app.get('/api/has-writein', async (req, res) => {
  const questionId = parseInt(req.query.question_id, 10);
  if (isNaN(questionId)) {
    return res.status(400).json({ message: 'Invalid question_id' });
  }

  try {
    console.log(`[GET] /api/has-writein?question_id=${questionId} - Checking if write-up is possible`);
    
    // Fetch all generation pairs for the question
    const pairsResponse = await fetch(`http://localhost:3000/api/pairs?question_id=${questionId}`);
    if (!pairsResponse.ok) {
      return res.json({ question_id: questionId, writeup_possible: false });
    }
    const pairsData = await pairsResponse.json();

    if (!pairsData.pairs || pairsData.pairs.length === 0) {
      return res.json({ question_id: questionId, writeup_possible: false });
    }

    // Fetch all latest ratings for the question
    const ratingsResponse = await fetch(`http://localhost:3000/api/ratings?question_id=${questionId}`);
    if (!ratingsResponse.ok) {
      return res.json({ question_id: questionId, writeup_possible: false });
    }
    const ratingsData = await ratingsResponse.json();

    // Convert ratings into a map for easy lookup
    const ratingsMap = new Map();
    ratingsData.ratings.forEach(rating => {
      ratingsMap.set(`${rating.gen_id_1}-${rating.gen_id_2}`, rating.user_selection);
    });

    // Check if all pairs are marked as 'both_unusable'
    const allUnusable = pairsData.pairs.every(pair => {
      const key = `${pair.gen_1_id}-${pair.gen_2_id}`;
      return ratingsMap.get(key) === 'both_unusable';
    });

    res.json({
      question_id: questionId,
      has_writein: allUnusable
    });
  } catch (err) {
    console.error(`[ERROR] Checking write-up possibility for question ${questionId}: ${err.message}`);
    res.json({ question_id: questionId, has_writein: false });
  }
});

app.post('/api/writeins', async (req, res) => {
  const { question_id, writein_text, generations, time_spent } = req.body;
  if (!question_id || !writein_text || !Array.isArray(generations)) {
    return res.status(400).json({ message: 'Missing required fields or invalid format.' });
  }

  const connection = await db.getConnection();
  await connection.beginTransaction();

  try {
    console.log(`[POST] /api/writeins - Submitting write-in for question ${question_id}`);
    
    // Insert the write-in response
    const [writeinResult] = await connection.query(
      `INSERT INTO writeins (question_id, writein_text, time_spent_seconds) VALUES (?, ?, ?)`,
      [question_id, writein_text, time_spent]
    );
    const writein_id = writeinResult.insertId;

    // Insert associations with selected generations
    if (generations.length > 0) {
      const values = generations.map(({ generation_id, used }) => [writein_id, generation_id, used]);
      await connection.query(
        `INSERT INTO writein_generations (writein_id, generation_id, used) VALUES ?`,
        [values]
      );
    }

    await connection.commit();
    connection.release();
    res.status(201).json({ message: 'Write-in submitted successfully', writein_id });
  } catch (err) {
    await connection.rollback();
    connection.release();
    console.error(`[ERROR] Submitting write-in: ${err.message}`);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

app.get('/api/writeins/latest', async (req, res) => {
  const questionId = parseInt(req.query.question_id, 10);
  if (isNaN(questionId)) {
    return res.status(400).json({ message: 'Invalid question_id' });
  }

  try {
    console.log(`[GET] /api/writeins/latest?question_id=${questionId} - Fetching latest write-in`);
    
    const query = `
      SELECT 
        w.writein_id, 
        w.question_id, 
        w.writein_text, 
        w.timestamp, 
        COALESCE(JSON_ARRAYAGG(wg.generation_id), JSON_ARRAY()) AS generation_ids
      FROM writeins w
      LEFT JOIN writein_generations wg 
        ON w.writein_id = wg.writein_id AND wg.used = TRUE
      WHERE w.question_id = ?
      GROUP BY w.writein_id
      ORDER BY w.timestamp DESC
      LIMIT 1;
    `;
    
    const [rows] = await db.query(query, [questionId]);
    
    if (rows.length === 0) {
      return res.status(404).json({ message: 'No write-ins found for this question.' });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error(`[ERROR] Fetching latest write-in for question ${questionId}: ${err.message}`);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});


app.get('/api/time/ratings', async (req, res) => {
  const questionId = parseInt(req.query.question_id, 10);
  if (isNaN(questionId)) {
    return res.status(400).json({ message: 'Invalid question_id' });
  }

  try {
    const query = `
      SELECT COALESCE(SUM(time_spent_seconds), 0) AS total_rating_time
      FROM ratings
      WHERE question_id = ?;
    `;

    const [rows] = await db.query(query, [questionId]);
    res.json({ question_id: questionId, total_rating_time: rows[0].total_rating_time });
  } catch (err) {
    console.error(`[ERROR] Summing rating time: ${err.message}`);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

app.get('/api/time/writeins', async (req, res) => {
  const questionId = parseInt(req.query.question_id, 10);
  if (isNaN(questionId)) {
    return res.status(400).json({ message: 'Invalid question_id' });
  }

  try {
    const query = `
      SELECT COALESCE(SUM(time_spent_seconds), 0) AS total_writein_time
      FROM writeins
      WHERE question_id = ?;
    `;

    const [rows] = await db.query(query, [questionId]);
    res.json({ question_id: questionId, total_writein_time: rows[0].total_writein_time });
  } catch (err) {
    console.error(`[ERROR] Summing write-in time: ${err.message}`);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}.`);
});
