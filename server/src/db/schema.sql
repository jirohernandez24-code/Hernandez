CREATE TABLE IF NOT EXISTS scenarios (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  patient_data TEXT NOT NULL,
  vital_signs TEXT NOT NULL,
  medications TEXT,
  lab_results TEXT,
  nursing_goals TEXT,
  expected_actions TEXT,
  difficulty TEXT DEFAULT 'moderate',
  source_pdf TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS simulation_sessions (
  id TEXT PRIMARY KEY,
  scenario_id TEXT NOT NULL,
  start_time TEXT DEFAULT (datetime('now')),
  end_time TEXT,
  score INTEGER,
  feedback TEXT,
  actions_log TEXT,
  conversation_log TEXT,
  FOREIGN KEY (scenario_id) REFERENCES scenarios(id)
);
