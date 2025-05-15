import express from 'express';
import bodyParser from 'body-parser';
import mysql from 'mysql2';
import fs from 'fs/promises';
import cors from 'cors';
import session from 'express-session';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = 3001;

// Middleware for JSON body parsing
app.use(bodyParser.json());

const allowedOrigins = [
  'http://localhost:5173',
  'http://10.126.1.103:5173',
  'https://preference.gdpr-llm.org'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE']
}));

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // Set secure: true in production with HTTPS
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

// Get all user-question assignments
app.get('/api/user-questions', async (req, res) => {
  try {
    console.log(`[GET] /api/user-questions - Fetching all user-question assignments`);
    const [rows] = await db.query('SELECT user_id, question_id FROM user_questions');
    res.json(rows);
  } catch (err) {
    console.error('[ERROR] Fetching user-question assignments:', err.message);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Assign or unassign a user to a question
app.post('/api/user-questions', async (req, res) => {
  const { user_id, question_id, assigned } = req.body;

  if (!user_id || !question_id || typeof assigned !== 'boolean') {
    return res.status(400).json({ message: 'Missing or invalid user_id, question_id, or assigned flag.' });
  }

  try {
    console.log(`[POST] /api/user-questions - ${assigned ? 'Assigning' : 'Unassigning'} user ${user_id} to question ${question_id}`);
    
    if (assigned) {
      await db.query(
        'INSERT IGNORE INTO user_questions (user_id, question_id) VALUES (?, ?)',
        [user_id, question_id]
      );
      res.status(200).json({ message: 'Assignment added.' });
    } else {
      await db.query(
        'DELETE FROM user_questions WHERE user_id = ? AND question_id = ?',
        [user_id, question_id]
      );
      res.status(200).json({ message: 'Assignment removed.' });
    }
  } catch (err) {
    console.error('[ERROR] Modifying user-question assignment:', err.message);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// User Registration
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: 'Missing username or password.' });
  }

  try {
    const [existing] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
    if (existing.length > 0) {
      return res.status(409).json({ message: 'Username already taken.' });
    }

    const hash = await bcrypt.hash(password, 12);
    const [result] = await db.query('INSERT INTO users (username, password_hash) VALUES (?, ?)', [username, hash]);
    req.session.userId = result.insertId;
    req.session.username = username;
    res.status(201).json({ message: 'User registered successfully', userId: result.insertId });
  } catch (err) {
    console.error(`[ERROR] Registering user: ${err.message}`);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// User Login
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: 'Missing username or password.' });
  }

  try {
    const [rows] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
    if (rows.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    req.session.userId = user.user_id;
    req.session.username = user.username;
    res.json({ message: 'Login successful', userId: user.user_id });
  } catch (err) {
    console.error(`[ERROR] Logging in user: ${err.message}`);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// User Logout
app.post('/api/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error(`[ERROR] Logging out: ${err.message}`);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
    res.clearCookie('connect.sid');
    res.json({ message: 'Logout successful' });
  });
});

// Session Existence Check
app.get('/api/session', (req, res) => {
  if (req.session.userId) {
    return res.json({ userId: req.session.userId, username: req.session.username });
  }
  res.status(401).json({ message: 'Not authenticated' });
});

app.get('/api/questions', async (req, res) => {
  const hasParams = req.query.page || req.query.limit || req.query.search || req.query.user_id;

  let page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  let limit = Math.max(parseInt(req.query.limit, 10) || 5, 1);
  let offset = (page - 1) * limit;
  const searchQuery = req.query.search ? `%${req.query.search}%` : '%';
  let userId = parseInt(req.query.user_id, 10);

  try {
    if (!hasParams) {
      // No query parameters: return ALL questions
      console.log(`[GET] /api/questions - Returning all questions (no filters)`);

      const [rows] = await db.query(`SELECT * FROM questions ORDER BY question_id`);
      return res.json({ questions: rows });
    }

    // Fallback to paginated logic
    if (isNaN(userId)) userId = 1;

    console.log(`[GET] /api/questions - Fetching page ${page} (limit: ${limit}) with search query: ${req.query.search || 'None'} and user_id: ${userId}`);

    const query = `
      SELECT q.*, (
        SELECT COUNT(*)
        FROM questions q2
        JOIN user_questions uq2 ON q2.question_id = uq2.question_id
        WHERE uq2.user_id = ? AND q2.question_text LIKE ?
      ) AS total_count
      FROM questions q
      JOIN user_questions uq ON q.question_id = uq.question_id
      WHERE uq.user_id = ? AND q.question_text LIKE ?
      ORDER BY q.question_id
      LIMIT ? OFFSET ?;
    `;
    const params = [userId, searchQuery, userId, searchQuery, limit, offset];

    const [rows] = await db.query(query, params);

    if (rows.length === 0) {
      return res.status(404).json({ message: 'No questions found.' });
    }

    const total = rows.length > 0 ? rows[0].total_count : 0;
    const totalPages = Math.ceil(total / limit);

    res.json({
      questions: rows.map(({ total_count, ...q }) => q),
      total,
      totalPages,
      currentPage: page
    });
  } catch (err) {
    console.error(`[ERROR] Fetching questions: ${err.message}`);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

app.get('/api/models', async (req, res) => {
  try {
    console.log('[GET] /api/models - Fetching all models');

    const [rows] = await db.query('SELECT model_id, model_name FROM models ORDER BY model_id ASC');
    res.json(rows);
  } catch (err) {
    console.error('[ERROR] Fetching models:', err.message);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Create a new model
app.post('/api/models', async (req, res) => {
  const { model_name } = req.body;

  if (!model_name || typeof model_name !== 'string') {
    return res.status(400).json({ message: 'Missing or invalid model_name.' });
  }

  try {
    console.log(`[POST] /api/models - Attempting to insert model "${model_name}"`);

    // Try inserting the model
    const [result] = await db.query(
      `INSERT IGNORE INTO models (model_name) VALUES (?)`,
      [model_name]
    );

    let modelId;

    if (result.insertId) {
      // Newly inserted
      modelId = result.insertId;
      console.log(`[INSERTED] Model "${model_name}" with ID ${modelId}`);
    } else {
      // Already existed — fetch the existing model_id
      const [rows] = await db.query(
        `SELECT model_id FROM models WHERE model_name = ?`,
        [model_name]
      );

      if (rows.length === 0) {
        throw new Error(`Failed to retrieve model_id for "${model_name}" after insert`);
      }

      modelId = rows[0].model_id;
      console.log(`[EXISTS] Model "${model_name}" already exists with ID ${modelId}`);
    }

    res.status(201).json({ message: 'Model processed successfully', model_id: modelId });
  } catch (err) {
    console.error(`[ERROR] Inserting model "${model_name}":`, err.message);
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
      SELECT g.generation_id, g.generation_text, m.model_name, m.model_id
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

app.post('/api/generations', async (req, res) => {
  const { question_id, generation_text, model_name } = req.body;

  if (!question_id || !generation_text || !model_name) {
    return res.status(400).json({ message: 'Missing required fields.' });
  }

  const connection = await db.getConnection();
  await connection.beginTransaction();

  try {
    // Check if model exists or insert it
    const [modelRows] = await connection.query(
      `SELECT model_id FROM models WHERE model_name = ?`,
      [model_name]
    );

    let model_id;
    if (modelRows.length > 0) {
      model_id = modelRows[0].model_id;
    } else {
      const [modelInsert] = await connection.query(
        `INSERT INTO models (model_name) VALUES (?)`,
        [model_name]
      );
      model_id = modelInsert.insertId;
    }

    // Insert generation
    const [genResult] = await connection.query(
      `INSERT INTO generations (question_id, generation_text, model_id) VALUES (?, ?, ?)`,
      [question_id, generation_text, model_id]
    );

    await connection.commit();
    connection.release();

    res.status(201).json({
      message: 'Generation added successfully',
      generation_id: genResult.insertId,
      model_id
    });
  } catch (err) {
    await connection.rollback();
    connection.release();
    console.error(`[ERROR] Adding generation: ${err.message}`);
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
  const user_id = req.session.userId;
  const { question_id, gen_1_id, gen_2_id, selection, time_spent } = req.body;
  
  if (!user_id) {
    return res.status(401).json({ message: 'Must be logged in.' });
  }

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
    console.log(`[POST] /api/rate - Saving rating for user ${user_id}, question ${question_id}, pair (${gen_1_id}, ${gen_2_id})`);
  
    const query = `
      INSERT INTO ratings (question_id, gen_id_1, gen_id_2, user_selection, time_spent_seconds, user_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
  
    await db.query(query, [question_id, gen_1_id, gen_2_id, selection, time_spent, user_id]);
  
    res.status(200).json({ message: 'Rating submitted successfully' });
  } catch (err) {
    console.error(`[ERROR] Saving rating: ${err.message}`);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

app.get('/api/ratings', async (req, res) => {
  const userId = req.session.userId;
  const questionId = parseInt(req.query.question_id, 10);

  if (!userId) {
    return res.status(401).json({ message: 'Must be logged in.' });
  }
  
  if (isNaN(questionId)) {
    return res.status(400).json({ message: 'Invalid question_id' });
  }

  try {
    console.log(`[GET] /api/ratings?question_id=${questionId} - Fetching latest ratings`);
    
    const query = `
      SELECT r.rating_id, r.question_id, r.gen_id_1, r.gen_id_2, r.user_selection, r.timestamp
      FROM ratings r
      INNER JOIN (
        SELECT gen_id_1, gen_id_2, MAX(timestamp) AS latest_timestamp
        FROM ratings
        WHERE question_id = ? AND user_id = ?
        GROUP BY gen_id_1, gen_id_2
      ) latest ON r.gen_id_1 = latest.gen_id_1 AND r.gen_id_2 = latest.gen_id_2 AND r.timestamp = latest.latest_timestamp
      WHERE r.question_id = ? AND r.user_id = ?
      ORDER BY r.timestamp DESC
    `;
    
    const [rows] = await db.query(query, [questionId, userId, questionId, userId]);

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
  const userId = req.session.userId;
  const questionId = parseInt(req.query.question_id, 10);

  if (!userId) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

  if (isNaN(questionId)) {
    return res.status(400).json({ message: 'Invalid question_id' });
  }

  try {
    console.log(`[GET] /api/has-writein?question_id=${questionId} - Checking if write-up is possible for user ${userId}`);

    // 1. Fetch generation pairs for this question
    const [pairs] = await db.query(`
      SELECT g1.generation_id AS gen_1_id, g2.generation_id AS gen_2_id
      FROM generations g1
      JOIN generations g2 ON g1.question_id = g2.question_id AND g1.generation_id < g2.generation_id
      WHERE g1.question_id = ?
    `, [questionId]);

    if (pairs.length === 0) {
      return res.json({ question_id: questionId, has_writein: false });
    }

    // 2. Fetch the latest user ratings for each pair
    const [ratings] = await db.query(`
      SELECT r.gen_id_1, r.gen_id_2, r.user_selection
      FROM ratings r
      INNER JOIN (
        SELECT gen_id_1, gen_id_2, MAX(rating_id) AS max_rating_id
        FROM ratings
        WHERE question_id = ? AND user_id = ?
        GROUP BY gen_id_1, gen_id_2
      ) latest ON r.rating_id = latest.max_rating_id
    `, [questionId, userId]);

    const ratingMap = new Map();
    ratings.forEach(rating => {
      ratingMap.set(`${rating.gen_id_1}-${rating.gen_id_2}`, rating.user_selection);
    });

    // 3. Check if all pairs are rated and marked 'both_unusable'
    const allUnusable = pairs.every(pair => {
      const key = `${pair.gen_1_id}-${pair.gen_2_id}`;
      return ratingMap.get(key) === 'both_unusable';
    });

    return res.json({
      question_id: questionId,
      has_writein: allUnusable
    });

  } catch (err) {
    console.error(`[ERROR] Checking write-in eligibility for question ${questionId}: ${err.message}`);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
});


app.post('/api/writeins', async (req, res) => {
  const userId = req.session.userId;
  const { question_id, writein_text, generations, time_spent } = req.body;

  if (!userId) {
    return res.status(401).json({ message: 'Must be logged in.' });
  }
  
  if (!question_id || !writein_text || !Array.isArray(generations)) {
    return res.status(400).json({ message: 'Missing required fields or invalid format.' });
  }

  const connection = await db.getConnection();
  await connection.beginTransaction();

  try {
    console.log(`[POST] /api/writeins - Submitting write-in for question ${question_id} from user_id ${userId}`);
    
    // Insert the write-in response
    const [writeinResult] = await connection.query(
      `INSERT INTO writeins (question_id, writein_text, time_spent_seconds, user_id) VALUES (?, ?, ?, ?)`,
      [question_id, writein_text, time_spent, userId]
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
  const userId = req.session.userId;

  if (!userId) {
    return res.status(401).json({ message: 'Must be logged in.' });
  }

  if (isNaN(questionId)) {
    return res.status(400).json({ message: 'Invalid question_id' });
  }

  try {
    console.log(`[GET] /api/writeins/latest?question_id=${questionId} - Fetching latest write-in for user ${userId}`);

    // First, get the latest writein_id for the user/question
    const [latestRows] = await db.query(`
      SELECT writein_id
      FROM writeins
      WHERE question_id = ? AND user_id = ?
      ORDER BY timestamp DESC
      LIMIT 1
    `, [questionId, userId]);

    if (latestRows.length === 0) {
      return res.status(404).json({ message: 'No write-ins found for this question.' });
    }

    const writeinId = latestRows[0].writein_id;

    // Then fetch the full writein with associated generation_ids
    const [resultRows] = await db.query(`
      SELECT 
        w.writein_id,
        w.question_id,
        w.writein_text,
        w.timestamp,
        COALESCE(JSON_ARRAYAGG(wg.generation_id), JSON_ARRAY()) AS generation_ids
      FROM writeins w
      LEFT JOIN writein_generations wg ON w.writein_id = wg.writein_id AND wg.used = TRUE
      WHERE w.writein_id = ?
      GROUP BY w.writein_id
    `, [writeinId]);

    res.json(resultRows[0]);
  } catch (err) {
    console.error(`[ERROR] Fetching latest write-in for question ${questionId}: ${err.message}`);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});


app.get('/api/time/ratings', async (req, res) => {
  const questionId = parseInt(req.query.question_id, 10);
  const userId = req.session.userId;

  if (!userId) {
    return res.status(401).json({ message: 'Must be logged in.' });
  }
  
  if (isNaN(questionId)) {
    return res.status(400).json({ message: 'Invalid question_id' });
  }

  try {
    const query = `
      SELECT COALESCE(SUM(time_spent_seconds), 0) AS total_rating_time
      FROM ratings
      WHERE user_id = ? AND question_id = ?;
    `;

    const [rows] = await db.query(query, [userId, questionId]);
    res.json({ question_id: questionId, total_rating_time: rows[0].total_rating_time });
  } catch (err) {
    console.error(`[ERROR] Summing rating time: ${err.message}`);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

app.get('/api/time/writeins', async (req, res) => {
  const questionId = parseInt(req.query.question_id, 10);
  const userId = req.session.userId;

  if (!userId) {
    return res.status(401).json({ message: 'Must be logged in.' });
  }
  
  if (isNaN(questionId)) {
    return res.status(400).json({ message: 'Invalid question_id' });
  }

  try {
    const query = `
      SELECT COALESCE(SUM(time_spent_seconds), 0) AS total_writein_time
      FROM writeins
      WHERE user_id = ? AND question_id = ?;
    `;

    const [rows] = await db.query(query, [userId, questionId]);
    res.json({ question_id: questionId, total_writein_time: rows[0].total_writein_time });
  } catch (err) {
    console.error(`[ERROR] Summing write-in time: ${err.message}`);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

app.get('/api/questions/is-answered', async (req, res) => {
  const userId = req.session.userId;
  const questionId = parseInt(req.query.question_id, 10);

  if (!userId) {
    return res.status(401).json({ message: 'Must be logged in.' });
  }

  if (isNaN(questionId)) {
    return res.status(400).json({ message: 'Invalid question_id' });
  }

  try {
    console.log(`[GET] /api/questions/is-answered?question_id=${questionId} - Checking completion for user ${userId}`);

    // 1. Get all generation pairs for the question
    const [pairs] = await db.query(`
      SELECT g1.generation_id AS gen_1_id, g2.generation_id AS gen_2_id
      FROM generations g1
      JOIN generations g2 ON g1.question_id = g2.question_id AND g1.generation_id < g2.generation_id
      WHERE g1.question_id = ?;
    `, [questionId]);

    if (pairs.length === 0) {
      return res.json({ question_id: questionId, is_answered: false });
    }

    // 2. Get most recent ratings for the user and question
    const [ratings] = await db.query(`
      SELECT r.gen_id_1, r.gen_id_2, r.user_selection
      FROM ratings r
      INNER JOIN (
        SELECT gen_id_1, gen_id_2, MAX(rating_id) AS max_rating_id
        FROM ratings
        WHERE question_id = ? AND user_id = ?
        GROUP BY gen_id_1, gen_id_2
      ) latest ON r.rating_id = latest.max_rating_id
      WHERE r.user_id = ? AND r.question_id = ?;
    `, [questionId, userId, userId, questionId]);

    const ratingMap = new Map();
    ratings.forEach(rating => {
      const key = `${rating.gen_id_1}-${rating.gen_id_2}`;
      ratingMap.set(key, rating.user_selection);
    });

    let allHaveRatings = true;
    let hasNonBothUnusable = false;

    for (const pair of pairs) {
      const key = `${pair.gen_1_id}-${pair.gen_2_id}`;
      const selection = ratingMap.get(key);

      if (!selection) {
        allHaveRatings = false;
        break;
      }

      if (selection !== 'both_unusable') {
        hasNonBothUnusable = true;
      }
    }

    if (!allHaveRatings) {
      return res.json({ question_id: questionId, is_answered: false });
    }

    // 3. If all are rated but marked both_unusable, check for user's write-in
    if (!hasNonBothUnusable) {
      const [writeins] = await db.query(`
        SELECT 1 FROM writeins WHERE question_id = ? AND user_id = ? LIMIT 1;
      `, [questionId, userId]);

      return res.json({ question_id: questionId, is_answered: writeins.length > 0 });
    }

    return res.json({ question_id: questionId, is_answered: true });

  } catch (err) {
    console.error(`[ERROR] Checking is-answered for question ${questionId} (user ${userId}): ${err.message}`);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});


app.post('/api/questions', async (req, res) => {
  const { question_text } = req.body;
  if (!question_text) {
    return res.status(400).json({ message: 'Missing question_text.' });
  }

  try {
    const [result] = await db.query(
      `INSERT INTO questions (question_text) VALUES (?)`,
      [question_text]
    );
    res.status(201).json({ message: 'Question added successfully', question_id: result.insertId });
  } catch (err) {
    console.error(`[ERROR] Adding question: ${err.message}`);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

app.post('/api/generations', async (req, res) => {
  const { question_id, generation_text, model_name } = req.body;
  if (!question_id || !generation_text || !model_name) {
    return res.status(400).json({ message: 'Missing required fields.' });
  }

  const connection = await db.getConnection();
  await connection.beginTransaction();

  try {
    const [modelRows] = await connection.query(
      `SELECT model_id FROM models WHERE model_name = ?`,
      [model_name]
    );

    let model_id;
    if (modelRows.length > 0) {
      model_id = modelRows[0].model_id;
    } else {
      const [modelInsert] = await connection.query(
        `INSERT INTO models (model_name) VALUES (?)`,
        [model_name]
      );
      model_id = modelInsert.insertId;
    }

    const [genResult] = await connection.query(
      `INSERT INTO generations (question_id, generation_text, model_id) VALUES (?, ?, ?)`,
      [question_id, generation_text, model_id]
    );

    await connection.commit();
    connection.release();

    res.status(201).json({
      message: 'Generation added successfully',
      generation_id: genResult.insertId,
      model_id
    });
  } catch (err) {
    await connection.rollback();
    connection.release();
    console.error(`[ERROR] Adding generation: ${err.message}`);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

app.get('/api/users', async (req, res) => {
  try {
    const [rows] = await db.query(`SELECT user_id, username FROM users ORDER BY username`);
    res.json(rows);
  } catch (err) {
    console.error(`[ERROR] Fetching users: ${err.message}`);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Start the server
app.listen(port, '0.0.0.0', () => {
  console.log(`Server running at http://localhost:${port}...`);
});
