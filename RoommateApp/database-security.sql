-- ============================================
-- ITEM 1: ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================
-- This prevents users from seeing/modifying data from other households

-- Enable RLS on all tables
ALTER TABLE Household ENABLE ROW LEVEL SECURITY;
ALTER TABLE AppUser ENABLE ROW LEVEL SECURITY;
ALTER TABLE Machine ENABLE ROW LEVEL SECURITY;
ALTER TABLE Chore ENABLE ROW LEVEL SECURITY;
ALTER TABLE UserChore ENABLE ROW LEVEL SECURITY;
ALTER TABLE Thread ENABLE ROW LEVEL SECURITY;
ALTER TABLE Message ENABLE ROW LEVEL SECURITY;

-- ===== Household Policies =====

-- Users can view households they belong to
CREATE POLICY "Users can view their household"
  ON Household FOR SELECT
  USING (
    id IN (
      SELECT household_id FROM AppUser 
      WHERE email = current_setting('app.current_user_email', true)
    )
  );

-- Users can insert households (when creating new household)
CREATE POLICY "Users can create households"
  ON Household FOR INSERT
  WITH CHECK (true);

-- ===== AppUser Policies =====

-- Users can view other members in their household
CREATE POLICY "Users can view household members"
  ON AppUser FOR SELECT
  USING (
    household_id IN (
      SELECT household_id FROM AppUser 
      WHERE email = current_setting('app.current_user_email', true)
    )
  );

-- Users can view their own profile even if not in household yet
CREATE POLICY "Users can view own profile"
  ON AppUser FOR SELECT
  USING (email = current_setting('app.current_user_email', true));

-- Users can insert their own profile (registration)
CREATE POLICY "Users can create own profile"
  ON AppUser FOR INSERT
  WITH CHECK (email = current_setting('app.current_user_email', true));

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON AppUser FOR UPDATE
  USING (email = current_setting('app.current_user_email', true));

-- ===== Machine Policies =====

-- Users can view machines in their household
CREATE POLICY "Users can view household machines"
  ON Machine FOR SELECT
  USING (
    user_email IN (
      SELECT email FROM AppUser 
      WHERE household_id IN (
        SELECT household_id FROM AppUser 
        WHERE email = current_setting('app.current_user_email', true)
      )
    )
  );

-- Users can insert machines in their household
CREATE POLICY "Users can create machines"
  ON Machine FOR INSERT
  WITH CHECK (
    user_email IN (
      SELECT email FROM AppUser 
      WHERE household_id IN (
        SELECT household_id FROM AppUser 
        WHERE email = current_setting('app.current_user_email', true)
      )
    )
  );

-- Users can update machines in their household
CREATE POLICY "Users can update household machines"
  ON Machine FOR UPDATE
  USING (
    user_email IN (
      SELECT email FROM AppUser 
      WHERE household_id IN (
        SELECT household_id FROM AppUser 
        WHERE email = current_setting('app.current_user_email', true)
      )
    )
  );

-- Users can delete their own machines
CREATE POLICY "Users can delete own machines"
  ON Machine FOR DELETE
  USING (user_email = current_setting('app.current_user_email', true));

-- ===== Chore Policies =====

-- Users can view chores in their household
CREATE POLICY "Users can view household chores"
  ON Chore FOR SELECT
  USING (
    assigned_user_email IN (
      SELECT email FROM AppUser 
      WHERE household_id IN (
        SELECT household_id FROM AppUser 
        WHERE email = current_setting('app.current_user_email', true)
      )
    )
    OR
    created_user_email IN (
      SELECT email FROM AppUser 
      WHERE household_id IN (
        SELECT household_id FROM AppUser 
        WHERE email = current_setting('app.current_user_email', true)
      )
    )
  );

-- Users can create chores in their household
CREATE POLICY "Users can create chores"
  ON Chore FOR INSERT
  WITH CHECK (
    created_user_email = current_setting('app.current_user_email', true)
  );

-- Users can update chores they created or are assigned to
CREATE POLICY "Users can update their chores"
  ON Chore FOR UPDATE
  USING (
    created_user_email = current_setting('app.current_user_email', true)
    OR
    assigned_user_email = current_setting('app.current_user_email', true)
  );

-- Users can delete chores they created
CREATE POLICY "Users can delete their chores"
  ON Chore FOR DELETE
  USING (created_user_email = current_setting('app.current_user_email', true));

-- ===== UserChore Policies =====

-- Users can view chore assignments in their household
CREATE POLICY "Users can view household chore assignments"
  ON UserChore FOR SELECT
  USING (
    chore_id IN (
      SELECT id FROM Chore WHERE 
        assigned_user_email IN (
          SELECT email FROM AppUser 
          WHERE household_id IN (
            SELECT household_id FROM AppUser 
            WHERE email = current_setting('app.current_user_email', true)
          )
        )
    )
  );

-- Users can create assignments for chores in their household
CREATE POLICY "Users can create chore assignments"
  ON UserChore FOR INSERT
  WITH CHECK (
    chore_id IN (
      SELECT id FROM Chore WHERE 
        created_user_email = current_setting('app.current_user_email', true)
    )
  );

-- Users can delete assignments for chores they created
CREATE POLICY "Users can delete chore assignments"
  ON UserChore FOR DELETE
  USING (
    chore_id IN (
      SELECT id FROM Chore WHERE 
        created_user_email = current_setting('app.current_user_email', true)
    )
  );

-- ===== Thread Policies =====

-- Users can view threads in their household
CREATE POLICY "Users can view household threads"
  ON Thread FOR SELECT
  USING (
    chore_id IN (
      SELECT id FROM Chore WHERE 
        assigned_user_email IN (
          SELECT email FROM AppUser 
          WHERE household_id IN (
            SELECT household_id FROM AppUser 
            WHERE email = current_setting('app.current_user_email', true)
          )
        )
    )
  );

-- Users can create threads for chores in their household
CREATE POLICY "Users can create threads"
  ON Thread FOR INSERT
  WITH CHECK (
    user_email = current_setting('app.current_user_email', true)
  );

-- ===== Message Policies =====

-- Users can view messages in threads they can access
CREATE POLICY "Users can view household messages"
  ON Message FOR SELECT
  USING (
    thread_id IN (
      SELECT id FROM Thread WHERE 
        chore_id IN (
          SELECT id FROM Chore WHERE 
            assigned_user_email IN (
              SELECT email FROM AppUser 
              WHERE household_id IN (
                SELECT household_id FROM AppUser 
                WHERE email = current_setting('app.current_user_email', true)
              )
            )
        )
    )
  );

-- Users can create messages in threads they can access
CREATE POLICY "Users can create messages"
  ON Message FOR INSERT
  WITH CHECK (
    thread_id IN (
      SELECT id FROM Thread WHERE 
        chore_id IN (
          SELECT id FROM Chore WHERE 
            assigned_user_email IN (
              SELECT email FROM AppUser 
              WHERE household_id IN (
                SELECT household_id FROM AppUser 
                WHERE email = current_setting('app.current_user_email', true)
              )
            )
        )
    )
  );


-- ============================================
-- ITEM 2: AUTO-UPDATE TRIGGERS FOR TIMESTAMPS
-- ============================================
-- Automatically updates 'updated_at' columns when rows are modified

-- First, add updated_at columns to tables that need them
ALTER TABLE AppUser ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE Machine ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE Chore ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Create trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to tables
CREATE TRIGGER update_appuser_updated_at
  BEFORE UPDATE ON AppUser
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_machine_updated_at
  BEFORE UPDATE ON Machine
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chore_updated_at
  BEFORE UPDATE ON Chore
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


-- ============================================
-- ITEM 3: ADDITIONAL CHECK CONSTRAINTS
-- ============================================

-- Email format validation
ALTER TABLE AppUser ADD CONSTRAINT chk_email_format 
  CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- Ensure points are non-negative
ALTER TABLE AppUser ADD CONSTRAINT chk_points_non_negative 
  CHECK (points >= 0);

-- Ensure streak is non-negative
ALTER TABLE AppUser ADD CONSTRAINT chk_streak_non_negative 
  CHECK (streak >= 0);

-- Ensure chore point_value is non-negative
ALTER TABLE Chore ADD CONSTRAINT chk_point_value_non_negative 
  CHECK (point_value >= 0);

-- Ensure completion date is after creation date
ALTER TABLE Chore ADD CONSTRAINT chk_completed_after_created 
  CHECK (date_completed IS NULL OR date_completed >= date_created);

-- Ensure abandonment date is after creation date
ALTER TABLE Chore ADD CONSTRAINT chk_abandoned_after_created 
  CHECK (date_abandoned IS NULL OR date_abandoned >= date_created);

-- Ensure due date is in the future when created (optional - commented out)
-- ALTER TABLE Chore ADD CONSTRAINT chk_due_date_future 
--   CHECK (due_date IS NULL OR due_date >= date_created);


-- ============================================
-- ITEM 4: UNIQUE CONSTRAINT ON MACHINE NAMES
-- ============================================
-- Prevents duplicate machine names for the same user

ALTER TABLE Machine ADD CONSTRAINT uq_machine_name_per_user 
  UNIQUE (user_email, name);


-- ============================================
-- HELPER FUNCTION: Set Current User for RLS
-- ============================================
-- Call this function at the start of each session to set the current user
-- This is used by RLS policies to filter data

CREATE OR REPLACE FUNCTION set_current_user(user_email TEXT)
RETURNS void AS $$
BEGIN
  PERFORM set_config('app.current_user_email', user_email, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Usage example:
-- SELECT set_current_user('user@example.com');


-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- Run these to verify everything was applied correctly

-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('Household', 'AppUser', 'Machine', 'Chore', 'UserChore', 'Thread', 'Message');

-- Check policies exist
SELECT tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Check triggers exist
SELECT trigger_name, event_object_table 
FROM information_schema.triggers 
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- Check constraints exist
SELECT conname, conrelid::regclass AS table_name, pg_get_constraintdef(oid) AS constraint_def
FROM pg_constraint
WHERE conrelid::regclass::text IN ('AppUser', 'Machine', 'Chore')
  AND contype = 'c'
ORDER BY table_name, conname;