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

CREATE TABLE durations (
    duration_id INT AUTO_INCREMENT PRIMARY KEY,
    question_id INT NOT NULL,
    hours_spent FLOAT NOT NULL DEFAULT 0,  -- Tracks hours spent editing
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,  -- Auto-timestamped
    FOREIGN KEY (question_id) REFERENCES questions(question_id) ON DELETE CASCADE
);

CREATE TABLE ratings (
    rating_id INT AUTO_INCREMENT PRIMARY KEY,
    question_id INT NOT NULL,
    text TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (question_id) REFERENCES questions(question_id) ON DELETE CASCADE
);

-- Trigger: after_question_insert
DELIMITER //

CREATE TRIGGER after_question_insert_responses
AFTER INSERT ON questions
FOR EACH ROW
BEGIN
    INSERT INTO responses (question_id, model, response_text, status)
    VALUES (NEW.question_id, 'Human', 'Human-generated response...', 'not started');
END;
//

DELIMITER ;

-- Trigger: after_question_insert_durations
DELIMITER //

CREATE TRIGGER after_question_insert_durations
AFTER INSERT ON questions
FOR EACH ROW
BEGIN
    INSERT INTO durations (question_id, hours_spent)
    VALUES (NEW.question_id, 0);
END;
//

DELIMITER ;

-- Trigger: after_question_insert_ratings
DELIMITER //

CREATE TRIGGER after_question_insert_ratings
AFTER INSERT ON questions
FOR EACH ROW
BEGIN
    INSERT INTO ratings (question_id, text)
    VALUES (NEW.question_id, 'Question rating...');
END;

//

DELIMITER ;


-- Index: idx_responses_question_id
CREATE INDEX idx_responses_question_id ON responses(question_id);

-- Index: idx_durations_question_id
CREATE INDEX idx_durations_question_id ON durations(question_id);
