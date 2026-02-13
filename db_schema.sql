-- Core SQL schema (PostgreSQL compatible with minor adjustments)
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE projects (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  is_centre_project BOOLEAN DEFAULT FALSE,
  owner_user_id INT REFERENCES users(id)
);

CREATE TABLE accounts (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(200) NOT NULL,
  account_type VARCHAR(20) NOT NULL,
  parent_account_id INT REFERENCES accounts(id)
);

CREATE TABLE budget_heads (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  project_id INT REFERENCES projects(id),
  sanctioned_amount NUMERIC(14,2) NOT NULL DEFAULT 0
);

CREATE TABLE transactions (
  id SERIAL PRIMARY KEY,
  txn_date TIMESTAMP NOT NULL,
  narration TEXT NOT NULL,
  reference_no VARCHAR(100)
);

CREATE TABLE transaction_lines (
  id SERIAL PRIMARY KEY,
  transaction_id INT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  account_id INT NOT NULL REFERENCES accounts(id),
  project_id INT REFERENCES projects(id),
  budget_head_id INT REFERENCES budget_heads(id),
  entry_type VARCHAR(10) NOT NULL,
  amount NUMERIC(14,2) NOT NULL
);
