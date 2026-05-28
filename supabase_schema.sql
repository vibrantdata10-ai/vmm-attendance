-- =====================================================
-- VIBRANT MARKETING MANAGEMENT - ATTENDANCE SYSTEM
-- Run this SQL in Supabase SQL Editor
-- =====================================================

-- Agents Table
CREATE TABLE IF NOT EXISTS agents (
  id SERIAL PRIMARY KEY,
  crm_id VARCHAR(50) UNIQUE NOT NULL,
  dialer_id VARCHAR(50),
  name VARCHAR(100) NOT NULL,
  date_of_joining DATE NOT NULL,
  team VARCHAR(100) NOT NULL,
  status VARCHAR(20) DEFAULT 'active', -- active / terminated
  terminated_date DATE DEFAULT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Attendance Table
CREATE TABLE IF NOT EXISTS attendance (
  id SERIAL PRIMARY KEY,
  crm_id VARCHAR(50) NOT NULL,
  agent_name VARCHAR(100) NOT NULL,
  team VARCHAR(100) NOT NULL,
  attendance_date DATE NOT NULL,
  status VARCHAR(10) NOT NULL, -- PRESENT / ABSENT
  uploaded_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(crm_id, attendance_date)
);

-- Enable Row Level Security (RLS) - Allow all for now
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all agents" ON agents FOR ALL USING (true);
CREATE POLICY "Allow all attendance" ON attendance FOR ALL USING (true);
