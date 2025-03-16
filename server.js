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

  try {
    console.log(`[GET] /api/questions - Fetching page ${page} (limit: ${limit})`);

    // Fetch paginated questions + total count in one query
    const query = `
      SELECT q.*, (SELECT COUNT(*) FROM questions) AS total_count
      FROM questions q
      ORDER BY q.question_id
      LIMIT ? OFFSET ?;
    `;

    const [rows] = await db.query(query, [limit, offset]);

    if (rows.length === 0) {
      return res.status(404).json({ message: 'No questions found.' });
    }

    // Extract total count from the first row
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

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}.`);
});
