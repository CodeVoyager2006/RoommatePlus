-- ------- Drop tables ----------
DROP TABLE IF EXISTS Household, Machine, AppUser, Message, Thread, UserChore, Chore CASCADE;
DROP TYPE IF EXISTS chore_status, repeat_pattern, machine_status;

-- ---------- Enums ----------
CREATE TYPE chore_status  AS ENUM ('incomplete', 'late', 'completed', 'abandoned');
CREATE TYPE repeat_unit   AS ENUM ('none', 'daily', 'weekly', 'monthly');
CREATE TYPE machine_status AS ENUM ('available', 'in_use', 'maintenance');

-- ---------- Tables ----------
CREATE TABLE Household (
  id           SERIAL PRIMARY KEY,
  name         TEXT NOT NULL,
  invite_code  TEXT NOT NULL UNIQUE,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE AppUser (
  email         TEXT PRIMARY KEY,
  household_id  INT REFERENCES Household(id) ON DELETE CASCADE,
  first_name    TEXT NOT NULL,
  last_name     TEXT NOT NULL,
  password      TEXT NOT NULL,              -- ideally store a password hash
  streak        INTEGER NOT NULL DEFAULT 0,
  points        INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE Machine (
  id             SERIAL PRIMARY KEY,
  user_email     TEXT NOT NULL REFERENCES AppUser(email) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  image_url      TEXT,
  status         machine_status NOT NULL DEFAULT 'available'
);

CREATE TABLE Chore (
  id                    SERIAL PRIMARY KEY,

  assigned_user_email   TEXT REFERENCES AppUser(email) ON DELETE SET NULL,
  created_user_email    TEXT REFERENCES AppUser(email) ON DELETE SET NULL,
  machine_id            INT REFERENCES Machine(id) ON DELETE SET NULL,

  title                 TEXT NOT NULL,
  due_date              TIMESTAMP,
  description           TEXT,

  status                chore_status NOT NULL DEFAULT 'incomplete',

  -- Weekly selection via bitmask
  -- Bits: Mon=1 Tue=2 Wed=4 Thu=8 Fri=16 Sat=32 Sun=64 (0..127 range)
  repeat_unit           repeat_unit NOT NULL DEFAULT 'none',
  repeat_interval       INTEGER NOT NULL DEFAULT 1,      -- every N units (e.g., every 2 weeks)
  repeat_days           SMALLINT NOT NULL DEFAULT 0,     -- only used when repeat_unit='weekly'

  point_value           INTEGER NOT NULL DEFAULT 0,

  date_created          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  date_completed        TIMESTAMP,
  completion_image_url  TEXT,
  date_abandoned        TIMESTAMP,
  reason_abandon        TEXT,

  -- Basic sanity constraints
  CONSTRAINT chk_repeat_interval_positive CHECK (repeat_interval >= 1),
  CONSTRAINT chk_repeat_days_valid CHECK (repeat_days BETWEEN 0 AND 127),

  -- repeat_days rules:
  -- - if not weekly -> must be 0
  -- - if weekly -> must be 1..127 (at least one day selected)
  CONSTRAINT chk_repeat_days_weekly
    CHECK (
      (repeat_unit <> 'weekly' AND repeat_days = 0)
      OR
      (repeat_unit = 'weekly' AND repeat_days BETWEEN 1 AND 127)
    )
);

CREATE TABLE UserChore (
  id            SERIAL PRIMARY KEY,
  user_email    TEXT NOT NULL REFERENCES AppUser(email) ON DELETE CASCADE,
  chore_id      INT NOT NULL REFERENCES Chore(id) ON DELETE CASCADE,
  date_assigned TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT uq_user_chore UNIQUE (user_email, chore_id)
);


CREATE TABLE Thread (
  id           SERIAL PRIMARY KEY,
  user_email   TEXT NOT NULL REFERENCES AppUser(email) ON DELETE CASCADE,
  chore_id     INT NOT NULL REFERENCES Chore(id) ON DELETE CASCADE,
  ai_summary   TEXT,
  date_created TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE Message (
  id         SERIAL PRIMARY KEY,
  thread_id  INT NOT NULL REFERENCES Thread(id) ON DELETE CASCADE,
  user_email TEXT REFERENCES AppUser(email) ON DELETE SET NULL, -- sender (optional but useful)
  content    TEXT NOT NULL,
  date_sent  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------- Indexes (practical defaults) ----------
CREATE INDEX idx_user_household_id            ON AppUser(household_id);

CREATE INDEX idx_machine_user_email           ON Machine(user_email);

CREATE INDEX idx_chore_assigned_user_email    ON Chore(assigned_user_email);
CREATE INDEX idx_chore_created_user_email     ON Chore(created_user_email);
CREATE INDEX idx_chore_machine_id             ON Chore(machine_id);
CREATE INDEX idx_chore_due_date               ON Chore(due_date);

CREATE INDEX idx_userchore_user_email         ON UserChore(user_email);
CREATE INDEX idx_userchore_chore_id           ON UserChore(chore_id);

CREATE INDEX idx_thread_user_email            ON Thread(user_email);
CREATE INDEX idx_thread_chore_id              ON Thread(chore_id);

CREATE INDEX idx_message_thread_id            ON Message(thread_id);
CREATE INDEX idx_message_user_email           ON Message(user_email);