import express from 'express';
import bodyParser from 'body-parser';
import mysql from 'mysql2';
import fs from 'fs/promises';
import cors from 'cors';

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
      SELECT g1.generation_id AS gen_1_id, g1.generation_text AS gen_1_text, m1.model_name AS gen_1_model,
             g2.generation_id AS gen_2_id, g2.generation_text AS gen_2_text, m2.model_name AS gen_2_model
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


// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}.`);
});
