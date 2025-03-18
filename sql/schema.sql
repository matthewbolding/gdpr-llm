USE gdpr;

CREATE TABLE questions (
    question_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    question_text TEXT NOT NULL
);

CREATE INDEX idx_question_text ON questions(question_text(255));

CREATE TABLE models (
    model_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    model_name VARCHAR(255) NOT NULL UNIQUE
);

CREATE TABLE generations (
    generation_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    question_id BIGINT UNSIGNED NOT NULL,
    model_id BIGINT UNSIGNED NOT NULL,
    generation_text TEXT NOT NULL,
    FOREIGN KEY (question_id) REFERENCES questions(question_id) ON DELETE CASCADE,
    FOREIGN KEY (model_id) REFERENCES models(model_id) ON DELETE CASCADE
);

CREATE INDEX idx_generations_question ON generations(question_id);
CREATE INDEX idx_generations_model ON generations(model_id);

CREATE TABLE ratings (
    rating_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    question_id BIGINT UNSIGNED NOT NULL,
    gen_id_1 BIGINT UNSIGNED NOT NULL,
    gen_id_2 BIGINT UNSIGNED NOT NULL,
    user_selection ENUM('both_unusable', 'gen_1_usable', 'gen_2_usable', 'both_usable_pref_1', 'both_usable_pref_2', 'both_usable_no_pref') NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (question_id) REFERENCES questions(question_id) ON DELETE CASCADE,
    FOREIGN KEY (gen_id_1) REFERENCES generations(generation_id) ON DELETE CASCADE,
    FOREIGN KEY (gen_id_2) REFERENCES generations(generation_id) ON DELETE CASCADE
);

CREATE INDEX idx_ratings_question ON ratings(question_id);
CREATE INDEX idx_ratings_gen_1 ON ratings(gen_id_1);
CREATE INDEX idx_ratings_gen_2 ON ratings(gen_id_2);
CREATE INDEX idx_ratings_user_selection ON ratings (user_selection, question_id);

CREATE TABLE writeins (
    writein_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    question_id BIGINT UNSIGNED NOT NULL,
    writein_text TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (question_id) REFERENCES questions(question_id) ON DELETE CASCADE
);

CREATE INDEX idx_writeins_question ON writeins(question_id);

CREATE TABLE writein_generations (
    writein_id BIGINT UNSIGNED NOT NULL,
    generation_id BIGINT UNSIGNED NOT NULL,
    used BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (writein_id, generation_id),
    FOREIGN KEY (writein_id) REFERENCES writeins(writein_id) ON DELETE CASCADE,
    FOREIGN KEY (generation_id) REFERENCES generations(generation_id) ON DELETE CASCADE
);

CREATE INDEX idx_writein_generations_writein ON writein_generations(writein_id);
CREATE INDEX idx_writein_generations_generation ON writein_generations(generation_id);

CREATE TABLE pairs (
    pair_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    question_id BIGINT UNSIGNED NOT NULL,
    generation_id_1 BIGINT UNSIGNED NOT NULL,
    generation_id_2 BIGINT UNSIGNED NOT NULL,
    FOREIGN KEY (question_id) REFERENCES questions(question_id) ON DELETE CASCADE,
    FOREIGN KEY (generation_id_1) REFERENCES generations(generation_id) ON DELETE CASCADE,
    FOREIGN KEY (generation_id_2) REFERENCES generations(generation_id) ON DELETE CASCADE
);

CREATE INDEX idx_pairs_question ON pairs(question_id);
CREATE INDEX idx_pairs_gen_1 ON pairs(generation_id_1);
CREATE INDEX idx_pairs_gen_2 ON pairs(generation_id_2);

CREATE TABLE rating_generations (
    rating_id BIGINT UNSIGNED NOT NULL,
    generation_id BIGINT UNSIGNED NOT NULL,
    usable BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (rating_id, generation_id),
    FOREIGN KEY (rating_id) REFERENCES ratings(rating_id) ON DELETE CASCADE,
    FOREIGN KEY (generation_id) REFERENCES generations(generation_id) ON DELETE CASCADE
);

CREATE INDEX idx_rating_generations_rating ON rating_generations(rating_id);
CREATE INDEX idx_rating_generations_generation ON rating_generations(generation_id);
