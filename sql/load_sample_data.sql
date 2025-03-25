USE gdpr;

INSERT INTO users (username) VALUES
('Alice'),
('Bob'),
('Charlie'),
('Dana'),
('Eve');

INSERT INTO questions (question_text) VALUES 
('What is the right to be forgotten?'),
('How can users request access to their personal data?'),
('What penalties does GDPR impose for non-compliance?'),
('How does GDPR impact AI-generated content?'),
('What are the legal bases for data processing under GDPR?'),
('How does GDPR handle data breaches?'),
('What constitutes personally identifiable information (PII) under GDPR?'),
('How should organizations handle user consent under GDPR?'),
('What are the key differences between GDPR and CCPA?'),
('How can companies demonstrate GDPR compliance?');

INSERT INTO models (model_name) VALUES 
('GPT-4'),
('Claude'),
('Mistral'),
('Gemini'),
('Llama');

INSERT INTO generations (question_id, model_id, generation_text) VALUES 
(1, 1, 'The right to be forgotten allows individuals to request deletion of their data.'),
(1, 2, 'GDPR grants EU citizens the right to have their personal data erased.'),
(1, 3, 'This generator is unsure.'),
(2, 1, 'Users can request access to their data via a Data Subject Access Request (DSAR).'),
(2, 2, 'Cannot say for certain!'),
(2, 3, 'Data access requests must be responded to within one month.');

INSERT INTO user_questions (user_id, question_id) VALUES
(2, 1), (2, 2), (2, 3), (2, 4),
(3, 2), (3, 3), (3, 4), (3, 5),
(4, 3), (4, 4), (4, 5), (4, 6),
(5, 4), (5, 5), (5, 6), (5, 7),
(6, 5), (6, 6), (6, 7), (6, 8);
