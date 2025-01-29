// This is a basic scaffolding for the MVP web app you described. The project will have:
// - Frontend in Svelte
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

// Get list of questions with pagination
app.get('/api/questions', async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const offset = (page - 1) * limit;

  try {
    console.log(`Fetching questions for page ${page} with limit ${limit}`);
    const [results] = await db.promise().query('SELECT * FROM questions LIMIT ? OFFSET ?', [limit, offset]);
    const [[{ total }]] = await db.promise().query('SELECT COUNT(*) AS total FROM questions');
    const totalPages = Math.ceil(total / limit);

    res.json({
      questions: results,
      total,
      totalPages,
      currentPage: page
    });
  } catch (err) {
    console.error('Error fetching questions:', err);
    res.status(500).send('Internal Server Error');
  }
});

// Get list of questions with pagination
app.get('/api/question', async (req, res) => {
  const questionId = parseInt(req.query.questionId, 10)

  try {
    console.log(`Fetching question with ID ${questionId}`);
    const [result] = await db.promise().query('SELECT * FROM questions WHERE id = ?', [questionId]);

    res.json({
      question: result
    });
  } catch (err) {
    console.error('Error fetching questions:', err);
    res.status(500).send('Internal Server Error');
  }
});

// Call stored procedure to get latest answers with pagination
app.get('/api/latest-answers', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;

  console.log(`Fetching latest answers for page ${page} with limit ${limit}`);

  // Get total number of questions for accurate pagination
  db.query('SELECT COUNT(*) AS total FROM questions', (err, totalResult) => {
    if (err) {
      console.error('Error fetching total question count:', err);
      res.status(500).send('Internal Server Error');
      return;
    }

    const totalQuestions = totalResult[0].total;
    const totalPages = Math.ceil(totalQuestions / limit);

    // Fetch question IDs for the current page
    db.query('SELECT id FROM questions LIMIT ? OFFSET ?', [limit, offset], (err, questions) => {
      if (err) {
        console.error('Error fetching question IDs:', err);
        res.status(500).send('Internal Server Error');
        return;
      }

      const questionIds = questions.map((q) => q.id);
      const results = [];

      const fetchAnswers = questionIds.map((questionId) => {
        return new Promise((resolve, reject) => {
          db.query('CALL GetLatestAnswersByQuestion(?)', [questionId], (err, result) => {
            if (err) {
              console.error(`Error fetching answers for question ID ${questionId}:`, err);
              return reject(err);
            }
            resolve({ questionId, answers: result[0] });
          });
        });
      });

      Promise.all(fetchAnswers)
        .then((allResults) => {
          res.json({
            results: allResults,
            total: totalQuestions,
            currentPage: page,
            totalPages
          });
        })
        .catch((err) => {
          console.error('Error fetching latest answers:', err);
          res.status(500).send('Internal Server Error');
        });
    });
  });
});

// Call stored procedure to get latest answers for a specific question
app.get('/api/question-info', (req, res) => {
  const questionId = parseInt(req.query.questionId);
  console.log(`Fetching latest answers for question ID: ${questionId}`);

  db.query('CALL GetLatestAnswersByQuestion(?)', [questionId], (err, result) => {
    if (err) {
      console.error(`Error fetching answers for question ID ${questionId}:`, err);
      res.status(500).send('Internal Server Error');
      return;
    }

    res.json({
      questionId,
      answers: result[0]
    });
  });
});

// Post a new question
app.post('/api/questions', (req, res) => {
  const { text } = req.body;
  console.log(`Adding a new question: ${text}`);

  db.query('INSERT INTO questions (text) VALUES (?)', [text], (err, result) => {
    if (err) {
      console.error('Error adding question:', err);
      res.status(500).send('Internal Server Error');
      return;
    }
    console.log('Question added successfully:', result);
    res.send({ message: 'Question added successfully', questionId: result.insertId });
  });
});

// Save a new answer using query parameters
app.post('/api/answers', (req, res) => {
  const questionId = req.query.question_id;
  const { modelName, generatedText } = req.body;

  console.log(`Saving answer for question ID: ${questionId}, Model: ${modelName}`);
  db.query(
    'INSERT INTO answers (question_id, model_name, generated_text, timestamp) VALUES (?, ?, ?, NOW())',
    [questionId, modelName, generatedText],
    (err, result) => {
      if (err) {
        console.error('Error saving answer:', err);
        res.status(500).send('Internal Server Error');
        return;
      }
      console.log('Answer saved successfully:', result);
      res.send('Answer saved successfully');
    }
  );
});

// Save user edits for an answer using query parameters
app.post('/api/edits', (req, res) => {
  const answerId = req.query.answer_id;
  const { userId, modifiedText, status } = req.body;

  console.log(`Saving edit for answer ID: ${answerId}, User ID: ${userId}, Status: ${status}`);
  db.query(
    'INSERT INTO edits (answer_id, user_id, modified_text, status, timestamp) VALUES (?, ?, ?, ?, NOW())',
    [answerId, userId, modifiedText, status],
    (err, result) => {
      if (err) {
        console.error('Error saving edit:', err);
        res.status(500).send('Internal Server Error');
        return;
      }
      console.log('Edit saved successfully:', result);
      res.send('Edit saved successfully');
    }
  );
});

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

// Frontend (Svelte)
// 1. Initialize Svelte project: `npx degit sveltejs/template svelte-app`
// 2. Create the following structure:
// - src/routes/
//     - index.svelte (main page)
//     - [id].svelte (individual question page)
// - Use Fetch API to call backend endpoints.

// Database Schema (MySQL)
// Table: questions
// Columns: id (PK), text (TEXT)

// Table: answers
// Columns: id (PK), question_id (FK), model_name (VARCHAR), generated_text (TEXT), timestamp (DATETIME)

// Table: edits
// Columns: id (PK), answer_id (FK), user_id (INT), modified_text (TEXT), status ENUM('not started', 'in progress', 'complete'), timestamp (DATETIME)

// Updated schema to add status tracking to edits table.

// Run MySQL commands to create the database and tables. Adjust scripts based on your needs.

// How to run locally:
// 1. Install dependencies: `npm install express body-parser mysql2`
// 2. Create a `db_config.json` file in the project root with your database credentials.
//    Example:
//    {
//      "host": "localhost",
//      "user": "your_username",
//      "password": "your_password",
//      "database": "llm_ground_truth"
//    }
// 3. Start backend: `node server.js`
// 4. Use `npm run dev` in the Svelte frontend to run the app.
