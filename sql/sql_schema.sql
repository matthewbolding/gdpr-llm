-- Table: questions
CREATE TABLE questions (
    question_id INT AUTO_INCREMENT PRIMARY KEY,
    text TEXT NOT NULL
);

-- Table: answers
CREATE TABLE responses (
    response_id INT AUTO_INCREMENT PRIMARY KEY,
    question_id INT NOT NULL,
    model VARCHAR(255) NOT NULL,
    response_text TEXT NOT NULL,
    status ENUM('not started', 'in progress', 'complete') NOT NULL DEFAULT 'not started',
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (question_id) REFERENCES questions(question_id) ON DELETE CASCADE
);

CREATE TABLE duration (
    id INT AUTO_INCREMENT PRIMARY KEY,
    question_id INT NOT NULL,
    hours_spent FLOAT NOT NULL DEFAULT 0,  -- Tracks hours spent editing
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,  -- Auto-timestamped
    FOREIGN KEY (question_id) REFERENCES questions(question_id) ON DELETE CASCADE
);

-- Trigger: after_question_insert
DELIMITER //

CREATE TRIGGER after_question_insert
AFTER INSERT ON questions
FOR EACH ROW
BEGIN
    INSERT INTO responses (question_id, model, response_text, status)
    VALUES (NEW.question_id, 'human', 'Human-generated response...', 'not started');
END;
//

DELIMITER ;

-- Trigger: after_question_insert_duration
DELIMITER //

CREATE TRIGGER after_question_insert_duration
AFTER INSERT ON questions
FOR EACH ROW
BEGIN
    INSERT INTO duration (question_id, hours_spent)
    VALUES (NEW.question_id, 0);
END;
//

DELIMITER ;

-- Index: idx_responses_question_id
CREATE INDEX idx_responses_question_id ON responses(question_id);

-- Index: idx_duration_question_id
CREATE INDEX idx_duration_question_id ON duration(question_id);
