DELIMITER //

CREATE PROCEDURE GetLatestAnswersByQuestion(IN question_id INT)
BEGIN
    SELECT 
        a.id AS answer_id,
        a.model_name,
        CASE
            WHEN e.modified_text IS NOT NULL THEN e.modified_text
            ELSE a.generated_text
        END AS final_text,
        CASE
            WHEN e.timestamp IS NOT NULL THEN e.timestamp
            ELSE a.timestamp
        END AS last_updated,
        CASE
            WHEN e.status IS NOT NULL THEN e.status
            ELSE 'not started'
        END AS status
    FROM 
        answers a
    LEFT JOIN 
        (SELECT answer_id, MAX(timestamp) AS latest_timestamp
         FROM edits
         GROUP BY answer_id) latest_edits
    ON a.id = latest_edits.answer_id
    LEFT JOIN 
        edits e
    ON e.answer_id = a.id AND e.timestamp = latest_edits.latest_timestamp
    WHERE a.question_id = question_id
    ORDER BY a.id;
END //

DELIMITER ;



-- create tables
-- Table: questions
CREATE TABLE questions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    text TEXT NOT NULL
);

-- Table: answers
CREATE TABLE answers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    question_id INT NOT NULL,
    model_name VARCHAR(255) NOT NULL,
    generated_text TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
);

-- Table: edits
CREATE TABLE edits (
    id INT AUTO_INCREMENT PRIMARY KEY,
    answer_id INT NOT NULL,
    user_id INT NOT NULL,
    modified_text TEXT NOT NULL,
    status ENUM('not started', 'in progress', 'complete') NOT NULL DEFAULT 'not started',
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (answer_id) REFERENCES answers(id) ON DELETE CASCADE
);



-- sample data

INSERT INTO questions (text)
VALUES
('What is GDPR?'),
('Explain Article 17 of GDPR.'),
('Describe the Right to Be Forgotten.');

INSERT INTO questions (text)
VALUES
('How long has the law been in place?'),
('How does the law work?'),
('Describe the way in which DPOs enforce the law.');

INSERT INTO answers (question_id, model_name, generated_text)
VALUES
(1, 'GPT-4', 'GDPR stands for General Data Protection Regulation, per GPT-4.'),
(2, 'GPT-4', 'Article 17 of GDPR discusses the Right to Be Forgotten, per GPT-4.'),
(3, 'GPT-4', 'The Right to Be Forgotten allows individuals to request data deletion, per GPT-4.');

INSERT INTO answers (question_id, model_name, generated_text)
VALUES
(1, 'Claude', 'GDPR regulates data protection and privacy in the EU, per Claude.'),
(2, 'Claude', 'Article 17 of GDPR discusses the Right to Be Forgotten, per Claude.'),
(3, 'Claude', 'The Right to Be Forgotten allows individuals to request data deletion, per Claude.');

INSERT INTO edits (answer_id, user_id, modified_text, status)
VALUES
(6, 101, 'Individuals can request their personal data to be deleted, per 101.', 'complete');

INSERT INTO edits (answer_id, user_id, modified_text, status)
VALUES
(3, 102, 'Individuals can request their personal data to be deleted, per 102.', 'in progress');

CALL GetLatestAnswersByQuestion(1);


-- RESET --

DROP TABLE IF EXISTS questions;
DROP TABLE IF EXISTS edits;
DROP TABLE IF EXISTS answers;
DROP PROCEDURE IF EXISTS GetLatestAnswersByQuestion;


