INSERT INTO questions (text) VALUES 
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

INSERT INTO responses (question_id, model, response_text) VALUES 
(1, 'GPTX', 'The right to be forgotten allows individuals to request deletion of their personal data.'),
(1, 'SecureAI', 'Under GDPR, individuals can request erasure of their data when it is no longer necessary.'),
(1, 'PrivacyMind', 'This right ensures personal data is erased when requested, subject to certain conditions.'),
(1, 'DataShield', 'GDPR Article 17 outlines the right to erasure, allowing users to delete their data.'),
(1, 'RegulaBot', 'The right to be forgotten is not absolute and applies only under specific conditions.'),

(2, 'GPTX', 'Users can submit data access requests through a Data Protection Officer (DPO) or via online forms.'),
(2, 'SecureAI', 'Data subjects can request their personal data using GDPR Article 15 rights.'),
(2, 'PrivacyMind', 'GDPR mandates controllers to provide personal data copies within one month upon request.'),
(2, 'DataShield', 'Users can request data access via email, online forms, or DPO contact.'),
(2, 'RegulaBot', 'Organizations must verify user identity before processing data access requests.'),

(3, 'GPTX', 'GDPR violations can lead to fines up to 4% of annual global turnover or €20 million.'),
(3, 'SecureAI', 'Non-compliance may result in heavy fines, reputational damage, and legal consequences.'),
(3, 'PrivacyMind', 'Supervisory authorities can issue warnings, reprimands, and monetary fines.'),
(3, 'DataShield', 'GDPR fines depend on severity, ranging from 2% to 4% of annual revenue.'),
(3, 'RegulaBot', 'Violations can lead to investigations and substantial penalties imposed by data authorities.'),

(4, 'GPTX', 'AI-generated content must comply with GDPR principles if it involves personal data processing.'),
(4, 'SecureAI', 'GDPR requires AI systems to implement safeguards to protect personal data privacy.'),
(4, 'PrivacyMind', 'AI-generated data should ensure user anonymity unless consent is explicitly given.'),
(4, 'DataShield', 'Transparency in AI decision-making is required under GDPR to ensure compliance.'),
(4, 'RegulaBot', 'AI developers must consider data minimization and purpose limitation when handling GDPR-sensitive data.'),

(5, 'GPTX', 'Lawful processing requires user consent, contract necessity, or legitimate interest.'),
(5, 'SecureAI', 'Six legal bases exist: consent, contract, legal obligation, vital interest, public task, and legitimate interest.'),
(5, 'PrivacyMind', 'GDPR allows processing based on consent or necessity for contract execution.'),
(5, 'DataShield', 'Organizations must document the legal basis for each type of data processing activity.'),
(5, 'RegulaBot', 'User consent must be freely given, specific, informed, and unambiguous under GDPR.');
