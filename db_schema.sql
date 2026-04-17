-- Reference SQL schema (PostgreSQL-oriented)
-- NOTE: Keep this file in sync with SQLAlchemy models.

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by_id INT REFERENCES users(id),
  updated_by_id INT REFERENCES users(id)
);

CREATE TABLE projects (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  is_centre_project BOOLEAN DEFAULT FALSE,
  owner_user_id INT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by_id INT REFERENCES users(id),
  updated_by_id INT REFERENCES users(id)
);

CREATE TABLE accounts (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(200) NOT NULL,
  account_type VARCHAR(20) NOT NULL,
  parent_account_id INT REFERENCES accounts(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by_id INT REFERENCES users(id),
  updated_by_id INT REFERENCES users(id)
);

CREATE TABLE budget_heads (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  project_id INT REFERENCES projects(id),
  sanctioned_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by_id INT REFERENCES users(id),
  updated_by_id INT REFERENCES users(id)
);

CREATE TABLE transactions (
  id SERIAL PRIMARY KEY,
  txn_date TIMESTAMPTZ NOT NULL,
  narration TEXT NOT NULL,
  reference_no VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by_id INT REFERENCES users(id),
  updated_by_id INT REFERENCES users(id)
);

CREATE TABLE transaction_lines (
  id SERIAL PRIMARY KEY,
  transaction_id INT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  account_id INT NOT NULL REFERENCES accounts(id),
  project_id INT REFERENCES projects(id),
  budget_head_id INT REFERENCES budget_heads(id),
  entry_type VARCHAR(10) NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by_id INT REFERENCES users(id),
  updated_by_id INT REFERENCES users(id)
);

CREATE TABLE bank_accounts (
  id SERIAL PRIMARY KEY,
  bank_name VARCHAR(200) NOT NULL,
  account_number_masked VARCHAR(30) NOT NULL,
  ifsc VARCHAR(20),
  project_id INT REFERENCES projects(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by_id INT REFERENCES users(id),
  updated_by_id INT REFERENCES users(id)
);

CREATE TABLE bank_statement_lines (
  id SERIAL PRIMARY KEY,
  bank_account_id INT NOT NULL REFERENCES bank_accounts(id),
  statement_date TIMESTAMPTZ NOT NULL,
  description TEXT NOT NULL,
  debit NUMERIC(14,2) NOT NULL DEFAULT 0,
  credit NUMERIC(14,2) NOT NULL DEFAULT 0,
  closing_balance NUMERIC(14,2),
  is_reconciled BOOLEAN DEFAULT FALSE,
  matched_transaction_id INT REFERENCES transactions(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by_id INT REFERENCES users(id),
  updated_by_id INT REFERENCES users(id)
);

CREATE TABLE events (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  project_id INT REFERENCES projects(id),
  budget_head_id INT REFERENCES budget_heads(id),
  estimated_cost NUMERIC(14,2) NOT NULL DEFAULT 0,
  prior_approval_required BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by_id INT REFERENCES users(id),
  updated_by_id INT REFERENCES users(id)
);

CREATE TABLE documents (
  id SERIAL PRIMARY KEY,
  file_name VARCHAR(255) NOT NULL,
  storage_path VARCHAR(500) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  project_id INT REFERENCES projects(id),
  event_id INT REFERENCES events(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by_id INT REFERENCES users(id),
  updated_by_id INT REFERENCES users(id)
);

CREATE TABLE event_evidence (
  id SERIAL PRIMARY KEY,
  event_id INT NOT NULL REFERENCES events(id),
  document_id INT REFERENCES documents(id),
  video_url VARCHAR(500),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by_id INT REFERENCES users(id),
  updated_by_id INT REFERENCES users(id)
);

CREATE TABLE transaction_documents (
  id SERIAL PRIMARY KEY,
  transaction_id INT NOT NULL REFERENCES transactions(id),
  document_id INT NOT NULL REFERENCES documents(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by_id INT REFERENCES users(id),
  updated_by_id INT REFERENCES users(id)
);

CREATE TABLE report_templates (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) UNIQUE NOT NULL,
  type VARCHAR(30) NOT NULL,
  template_format VARCHAR(20) NOT NULL DEFAULT 'HTML',
  description TEXT,
  header_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  layout_json JSONB NOT NULL,
  html_template TEXT NOT NULL,
  template_file_path VARCHAR(500),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by_id INT REFERENCES users(id),
  updated_by_id INT REFERENCES users(id)
);



CREATE TABLE placeholder_definitions (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) UNIQUE NOT NULL,
  description TEXT,
  filters_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  expression_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by_id INT REFERENCES users(id),
  updated_by_id INT REFERENCES users(id)
);

CREATE TABLE generated_reports (
  id SERIAL PRIMARY KEY,
  template_id INT NOT NULL REFERENCES report_templates(id),
  project_id INT REFERENCES projects(id),
  from_date DATE,
  to_date DATE,
  parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
  html_output TEXT NOT NULL DEFAULT '',
  pdf_path VARCHAR(500),
  output_format VARCHAR(20) NOT NULL DEFAULT 'HTML',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by_id INT REFERENCES users(id),
  updated_by_id INT REFERENCES users(id)
);
