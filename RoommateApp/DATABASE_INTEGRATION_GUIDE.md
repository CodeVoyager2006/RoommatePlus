# RoommatePlus - Database Integration Guide

This document explains how to transform data between your React app format and the Supabase database format.

## Overview

The database schema has been corrected to match your app requirements. However, there are several data format mismatches that require transformation in your app layer (frontend or API middleware).

---

## Critical Data Transformations Needed

### 1. Chore Dates: String ↔ Timestamp

**App Format:**
```javascript
dueDate: "2025-06-30"  // ISO date string
```

**Database Format:**
```sql
due_at: timestamptz  -- Full timestamp with timezone
```

**Conversion Functions:**

```javascript
// App → Database
function appDateToDb(dateStr) {
  if (!dateStr) return null;
  // Convert "2025-06-30" to timestamptz
  return new Date(dateStr + 'T23:59:59Z').toISOString();
}

// Database → App
function dbDateToApp(timestamp) {
  if (!timestamp) return '';
  // Convert timestamptz to "2025-06-30"
  return new Date(timestamp).toISOString().split('T')[0];
}
```

---

### 2. Chore Assignments: Array ↔ Junction Table

**App Format:**
```javascript
peopleAssigned: ["You", "Alice", "Bob"]  // Array of display names
```

**Database Format:**
```sql
-- Separate table: chore_assignments
-- Each assignment is a row with user_id (UUID)
```

**Fetching Chores with Assignees:**

```javascript
// Use the helper view for easy fetching
const { data: chores } = await supabase
  .from('chores_with_details')
  .select('*')
  .eq('household_id', householdId);

// Result includes:
// - assignee_ids: [uuid1, uuid2]
// - assignee_names: ["Alex Smith", "Bob Jones"]
```

**Creating Chore with Assignees:**

```javascript
async function createChore(choreData) {
  // 1. Create the chore
  const { data: chore, error: choreError } = await supabase
    .from('chores')
    .insert({
      household_id: householdId,
      title: choreData.title,
      description: choreData.description,
      due_at: appDateToDb(choreData.dueDate),
      repeat_unit: choreData.repeatUnit || 'none',
      repeat_interval: choreData.repeatInterval || 1,
      repeat_days: repeatDaysToDb(choreData.repeatDays)
    })
    .select()
    .single();

  if (choreError) throw choreError;

  // 2. Get user IDs for assignee names
  const assigneeIds = await getUserIdsByNames(choreData.peopleAssigned);

  // 3. Create assignments
  const assignments = assigneeIds.map(userId => ({
    chore_id: chore.chore_id,
    user_id: userId
  }));

  const { error: assignError } = await supabase
    .from('chore_assignments')
    .insert(assignments);

  if (assignError) throw assignError;

  return chore;
}

// Helper function
async function getUserIdsByNames(names) {
  // Map display names to user_ids
  // This requires querying profiles table
  const { data: profiles } = await supabase
    .from('profiles')
    .select('user_id, first_name, last_name')
    .in('first_name', names); // Simplified - you'll need better matching

  return profiles.map(p => p.user_id);
}
```

---

### 3. Repeat Days: Array ↔ Bitmask

**App Format:**
```javascript
repeatDays: ["Mon", "Wed", "Fri"]  // Array of day abbreviations
```

**Database Format:**
```sql
repeat_days: smallint  -- Bitmask: Sun=1, Mon=2, Tue=4, Wed=8, Thu=16, Fri=32, Sat=64
-- Example: Mon+Wed+Fri = 2+8+32 = 42
```

**Conversion Functions:**

```javascript
const DAY_BITS = {
  'Sun': 1,
  'Mon': 2,
  'Tue': 4,
  'Wed': 8,
  'Thu': 16,
  'Fri': 32,
  'Sat': 64
};

const BIT_DAYS = {
  1: 'Sun',
  2: 'Mon',
  4: 'Tue',
  8: 'Wed',
  16: 'Thu',
  32: 'Fri',
  64: 'Sat'
};

// App → Database
function repeatDaysToDb(daysArray) {
  if (!daysArray || daysArray.length === 0) return 0;
  
  return daysArray.reduce((bitmask, day) => {
    return bitmask | (DAY_BITS[day] || 0);
  }, 0);
}

// Database → App
function dbToRepeatDays(bitmask) {
  if (!bitmask || bitmask === 0) return [];
  
  const days = [];
  for (let bit = 1; bit <= 64; bit *= 2) {
    if (bitmask & bit) {
      days.push(BIT_DAYS[bit]);
    }
  }
  return days;
}

// Examples:
repeatDaysToDb(['Mon', 'Wed', 'Fri'])  // Returns: 42
dbToRepeatDays(42)  // Returns: ['Mon', 'Wed', 'Fri']
```

---

### 4. Machine Status: Enum Values

**App Format:**
```javascript
status: "busy"
```

**Database Format:**
```sql
status: machine_status enum ('available', 'busy', 'maintenance')
```

**✅ FIXED:** The database enum now matches your app code (`busy` instead of `in_use`).

**Using Machines:**

```javascript
// Occupy a machine
async function occupyMachine(machineId) {
  const { error } = await supabase
    .from('machines')
    .update({
      status: 'busy',
      occupied_by: userId  // Current user's UUID
    })
    .eq('machine_id', machineId);
  
  return !error;
}

// Free a machine
async function freeMachine(machineId) {
  const { error } = await supabase
    .from('machines')
    .update({
      status: 'available',
      occupied_by: null
    })
    .eq('machine_id', machineId);
  
  return !error;
}

// Fetch machines with occupier names (use helper view)
const { data: machines } = await supabase
  .from('household_machines')
  .select('*')
  .eq('household_id', householdId);

// Result includes occupied_by_name field
```

---

### 5. Thread Messages: Field Name Mapping

**App Format:**
```javascript
{
  id: "m1",
  author: "Alex",        // Display name
  text: "Message here",  // Field name
  createdAt: timestamp   // Field name
}
```

**Database Format:**
```sql
message_id uuid
sender_id uuid         -- Not author (UUID, not name)
content text           -- Not text
sent_at timestamptz    -- Not createdAt
```

**Fetching Messages:**

```javascript
async function getThreadMessages(threadId) {
  const { data: messages } = await supabase
    .from('messages')
    .select(`
      message_id,
      content,
      sent_at,
      sender:profiles(first_name, last_name, email)
    `)
    .eq('thread_id', threadId)
    .order('sent_at', { ascending: true });

  // Transform to app format
  return messages.map(msg => ({
    id: msg.message_id,
    author: msg.sender.first_name + ' ' + msg.sender.last_name,
    text: msg.content,
    createdAt: new Date(msg.sent_at).getTime()
  }));
}
```

**Creating Messages:**

```javascript
async function sendMessage(threadId, text) {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      thread_id: threadId,
      content: text,
      sender_id: userId  // Current user's UUID (from auth.uid())
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}
```

---

### 6. User Display Names

**Database Format:**
```sql
profiles table has: first_name, last_name (separate fields)
```

**App Format:**
```javascript
user.name = "Alex Smith"  // Single field
```

**Solution:**

```javascript
// Fetching user profile
async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .single();

  return {
    ...profile,
    name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email
  };
}
```

---

## Helper Views Available

The database includes these views to simplify queries:

### 1. `chores_with_details`
Includes assignee information aggregated:
```sql
SELECT * FROM chores_with_details WHERE household_id = ?;
```
Returns:
- All chore fields
- `assignee_ids`: array of UUIDs
- `assignee_names`: array of display names

### 2. `user_chores`
All chores assigned to each user:
```sql
SELECT * FROM user_chores WHERE user_id = auth.uid();
```

### 3. `household_machines`
Machines with occupier information:
```sql
SELECT * FROM household_machines WHERE household_id = ?;
```
Returns:
- All machine fields
- `occupied_by_name`: display name of current occupier

---

## Authentication Flow

### Sign Up
```javascript
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'password123',
  options: {
    data: {
      first_name: 'Alex',
      last_name: 'Smith'
    }
  }
});

// Profile is automatically created via trigger
```

### Create Household
```javascript
const { data: householdId, error } = await supabase
  .rpc('create_household', { p_name: 'My Apartment' });

// User automatically becomes owner
```

### Join Household
```javascript
const { data: householdId, error } = await supabase
  .rpc('join_household', { p_invite_code: 'ABC123XYZ' });
```

---

## Important Notes

### One Household Per User
The database enforces one household per user via unique constraint on `household_members(user_id)`. If you need to support multiple households later, remove this constraint:

```sql
ALTER TABLE household_members DROP CONSTRAINT uq_one_household_per_user;
```

### Field Name Mapping Summary

| App Field | DB Field | Notes |
|-----------|----------|-------|
| `dueDate` | `due_at` | String → Timestamp |
| `peopleAssigned` | `chore_assignments` table | Array → Junction table |
| `repeatDays` | `repeat_days` | Array → Bitmask |
| `text` (message) | `content` | Field rename |
| `createdAt` (message) | `sent_at` | Field rename |
| `author` (message) | `sender_id` | Name → UUID |
| `name` (user) | `first_name + last_name` | Combined field |
| `occupiedBy` (machine) | `occupied_by` | ✅ Now in DB |

---

## Next Steps

1. **Install Supabase JS Client:**
   ```bash
   npm install @supabase/supabase-js
   ```

2. **Create Supabase Client:**
   ```javascript
   // lib/supabaseClient.js
   import { createClient } from '@supabase/supabase-js';

   const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
   const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

   export const supabase = createClient(supabaseUrl, supabaseAnonKey);
   ```

3. **Create API Layer:**
   Create helper functions for each entity (chores, machines, threads) that handle the data transformations.

4. **Update Components:**
   Replace local state with Supabase queries using the transformation functions.

---

## Example: Complete Chore CRUD

```javascript
// api/chores.js
import { supabase } from '../lib/supabaseClient';

export const choreAPI = {
  // Fetch all chores for household
  async fetchChores(householdId) {
    const { data, error } = await supabase
      .from('chores_with_details')
      .select('*')
      .eq('household_id', householdId);

    if (error) throw error;

    // Transform to app format
    return data.map(chore => ({
      id: chore.chore_id,
      title: chore.title,
      description: chore.description,
      dueDate: dbDateToApp(chore.due_at),
      peopleAssigned: chore.assignee_names,
      repeatDays: dbToRepeatDays(chore.repeat_days),
      status: chore.status
    }));
  },

  // Create new chore
  async createChore(householdId, choreData) {
    // 1. Insert chore
    const { data: chore, error: choreError } = await supabase
      .from('chores')
      .insert({
        household_id: householdId,
        title: choreData.title,
        description: choreData.description,
        due_at: appDateToDb(choreData.dueDate),
        repeat_days: repeatDaysToDb(choreData.repeatDays)
      })
      .select()
      .single();

    if (choreError) throw choreError;

    // 2. Create assignments
    const assigneeIds = await getUserIdsByNames(choreData.peopleAssigned);
    const assignments = assigneeIds.map(userId => ({
      chore_id: chore.chore_id,
      user_id: userId
    }));

    const { error: assignError } = await supabase
      .from('chore_assignments')
      .insert(assignments);

    if (assignError) throw assignError;

    return chore;
  },

  // Delete chore
  async deleteChore(choreId) {
    const { error } = await supabase
      .from('chores')
      .delete()
      .eq('chore_id', choreId);

    if (error) throw error;
  }
};
```

---

## Questions or Issues?

If you encounter any issues with the database schema or data transformations, check:

1. Are you using the helper views for easier queries?
2. Are all field names mapped correctly?
3. Are dates being converted properly?
4. Are you handling UUIDs vs display names correctly?
5. Is the repeat_days bitmask conversion working?

Good luck with your integration! 🚀
