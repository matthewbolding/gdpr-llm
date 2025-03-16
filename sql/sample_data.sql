USE gdpr;

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
(2, 1, 'Users can request access to their data via a Data Subject Access Request (DSAR).'),
(2, 3, 'Data access requests must be responded to within one month.'),
(3, 4, 'GDPR fines can reach up to 4% of annual revenue or €20 million, whichever is higher.');
