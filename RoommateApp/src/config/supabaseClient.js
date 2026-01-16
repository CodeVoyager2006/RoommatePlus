import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

// ============================================
// SESSION MANAGEMENT (Required for RLS)
// ============================================

/**
 * Set current user for RLS policies
 * IMPORTANT: Call this after user logs in or when app starts
 */
export const setCurrentUser = async (userEmail) => {
  const { error } = await supabaseClient.rpc('set_current_user', { user_email: userEmail });
  if (error) {
    console.warn('Could not set current user for RLS:', error);
  }
};

/**
 * Get current session user email
 * For now, returns hardcoded value. Replace with actual auth later.
 */
export const getCurrentUserEmail = () => {
  // TODO: Replace with actual Supabase Auth
  // const { data: { user } } = await supabase.auth.getUser();
  // return user?.email;
  
  return localStorage.getItem('current_user_email') || 'test@example.com';
};

/**
 * Initialize user session (call on app load)
 */
export const initializeSession = async () => {
  const userEmail = getCurrentUserEmail();
  await setCurrentUser(userEmail);
  return userEmail;
};

// ============================================
// HOUSEHOLD - GET METHODS
// ============================================

/**
 * Get all households the current user belongs to
 */
export const getHouseholds = async () => {
  const { data, error } = await supabaseClient
    .from('Household')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching households:', error);
    throw error;
  }
  return data;
};

/**
 * Get household by ID
 */
export const getHouseholdById = async (householdId) => {
  const { data, error } = await supabaseClient
    .from('Household')
    .select('*')
    .eq('id', householdId)
    .single();

  if (error) {
    console.error('Error fetching household:', error);
    throw error;
  }
  return data;
};

/**
 * Find household by invite code
 */
export const getHouseholdByInviteCode = async (inviteCode) => {
  const { data, error } = await supabaseClient
    .from('Household')
    .select('*')
    .eq('invite_code', inviteCode)
    .single();

  if (error) {
    console.error('Error fetching household by invite code:', error);
    throw error;
  }
  return data;
};

// ============================================
// USER (AppUser) - GET METHODS
// ============================================

/**
 * Get all users in a household
 */
export const getHouseholdUsers = async (householdId) => {
  const { data, error } = await supabaseClient
    .from('AppUser')
    .select('*')
    .eq('household_id', householdId)
    .order('first_name', { ascending: true });

  if (error) {
    console.error('Error fetching household users:', error);
    throw error;
  }
  return data;
};

/**
 * Get user by email
 */
export const getUserByEmail = async (email) => {
  const { data, error } = await supabaseClient
    .from('AppUser')
    .select('*')
    .eq('email', email)
    .single();

  if (error) {
    console.error('Error fetching user:', error);
    throw error;
  }
  return data;
};

/**
 * Get current logged-in user's profile
 */
export const getCurrentUserProfile = async () => {
  const email = getCurrentUserEmail();
  return await getUserByEmail(email);
};

// ============================================
// CHORE - GET METHODS
// ============================================

/**
 * Get all chores for a household (with relationships)
 * Returns chores with assigned users and creators
 */
export const getHouseholdChores = async (householdId) => {
  const { data, error } = await supabaseClient
    .from('Chore')
    .select(`
      *,
      assigned_user:AppUser!Chore_assigned_user_email_fkey(
        email, 
        first_name, 
        last_name,
        points,
        streak
      ),
      created_user:AppUser!Chore_created_user_email_fkey(
        email, 
        first_name, 
        last_name
      ),
      UserChore(
        user_email,
        date_assigned,
        AppUser(
          email, 
          first_name, 
          last_name
        )
      ),
      Machine(
        id,
        name,
        status
      )
    `)
    .or(`assigned_user_email.in.(select email from AppUser where household_id=${householdId}),created_user_email.in.(select email from AppUser where household_id=${householdId})`)
    .order('due_date', { ascending: true });

  if (error) {
    console.error('Error fetching household chores:', error);
    throw error;
  }
  return data;
};

/**
 * Get chore by ID with all relationships
 */
export const getChoreById = async (choreId) => {
  const { data, error } = await supabaseClient
    .from('Chore')
    .select(`
      *,
      assigned_user:AppUser!Chore_assigned_user_email_fkey(
        email, 
        first_name, 
        last_name,
        points,
        streak
      ),
      created_user:AppUser!Chore_created_user_email_fkey(
        email, 
        first_name, 
        last_name
      ),
      UserChore(
        user_email,
        date_assigned,
        AppUser(
          email, 
          first_name, 
          last_name
        )
      ),
      Machine(
        id,
        name,
        status
      )
    `)
    .eq('id', choreId)
    .single();

  if (error) {
    console.error('Error fetching chore:', error);
    throw error;
  }
  return data;
};

/**
 * Get chores assigned to a specific user
 */
export const getUserChores = async (userEmail) => {
  const { data, error } = await supabaseClient
    .from('Chore')
    .select(`
      *,
      assigned_user:AppUser!Chore_assigned_user_email_fkey(
        email, 
        first_name, 
        last_name
      ),
      UserChore(
        user_email,
        AppUser(
          email, 
          first_name, 
          last_name
        )
      )
    `)
    .eq('assigned_user_email', userEmail)
    .order('due_date', { ascending: true });

  if (error) {
    console.error('Error fetching user chores:', error);
    throw error;
  }
  return data;
};

/**
 * Get chores by status
 * @param {string} status - 'incomplete', 'late', 'completed', 'abandoned'
 */
export const getChoresByStatus = async (householdId, status) => {
  const { data, error } = await supabaseClient
    .from('Chore')
    .select(`
      *,
      assigned_user:AppUser!Chore_assigned_user_email_fkey(
        email, 
        first_name, 
        last_name
      )
    `)
    .eq('status', status)
    .or(`assigned_user_email.in.(select email from AppUser where household_id=${householdId})`)
    .order('due_date', { ascending: true });

  if (error) {
    console.error('Error fetching chores by status:', error);
    throw error;
  }
  return data;
};

/**
 * Get incomplete chores (active chores)
 */
export const getIncompleteChores = async (householdId) => {
  return await getChoresByStatus(householdId, 'incomplete');
};

/**
 * Get completed chores
 */
export const getCompletedChores = async (householdId) => {
  return await getChoresByStatus(householdId, 'completed');
};

// ============================================
// USER-CHORE ASSIGNMENT - GET METHODS
// ============================================

/**
 * Get all users assigned to a chore
 */
export const getChoreAssignments = async (choreId) => {
  const { data, error } = await supabaseClient
    .from('UserChore')
    .select(`
      *,
      AppUser(
        email, 
        first_name, 
        last_name, 
        points, 
        streak
      )
    `)
    .eq('chore_id', choreId)
    .order('date_assigned', { ascending: true });

  if (error) {
    console.error('Error fetching chore assignments:', error);
    throw error;
  }
  return data;
};

/**
 * Get all chores a user is assigned to (including via UserChore table)
 */
export const getUserAssignedChores = async (userEmail) => {
  const { data, error } = await supabaseClient
    .from('UserChore')
    .select(`
      *,
      Chore(
        *,
        assigned_user:AppUser!Chore_assigned_user_email_fkey(
          email, 
          first_name, 
          last_name
        )
      )
    `)
    .eq('user_email', userEmail)
    .order('date_assigned', { ascending: false });

  if (error) {
    console.error('Error fetching user assigned chores:', error);
    throw error;
  }
  return data;
};

// ============================================
// MACHINE - GET METHODS
// ============================================

/**
 * Get all machines for a user
 */
export const getUserMachines = async (userEmail) => {
  const { data, error } = await supabaseClient
    .from('Machine')
    .select('*')
    .eq('user_email', userEmail)
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching user machines:', error);
    throw error;
  }
  return data;
};

/**
 * Get all machines in a household
 */
export const getHouseholdMachines = async (householdId) => {
  const { data, error } = await supabaseClient
    .from('Machine')
    .select(`
      *,
      AppUser(
        email, 
        first_name, 
        last_name, 
        household_id
      )
    `)
    .eq('AppUser.household_id', householdId)
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching household machines:', error);
    throw error;
  }
  return data;
};

/**
 * Get machine by ID
 */
export const getMachineById = async (machineId) => {
  const { data, error } = await supabaseClient
    .from('Machine')
    .select(`
      *,
      AppUser(
        email, 
        first_name, 
        last_name
      )
    `)
    .eq('id', machineId)
    .single();

  if (error) {
    console.error('Error fetching machine:', error);
    throw error;
  }
  return data;
};

/**
 * Get machines by status
 * @param {string} status - 'available', 'in_use', 'maintenance'
 */
export const getMachinesByStatus = async (householdId, status) => {
  const { data, error } = await supabaseClient
    .from('Machine')
    .select(`
      *,
      AppUser(
        email, 
        first_name, 
        last_name, 
        household_id
      )
    `)
    .eq('status', status)
    .eq('AppUser.household_id', householdId)
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching machines by status:', error);
    throw error;
  }
  return data;
};

/**
 * Get available machines
 */
export const getAvailableMachines = async (householdId) => {
  return await getMachinesByStatus(householdId, 'available');
};

// ============================================
// THREAD - GET METHODS
// ============================================

/**
 * Get all threads for a chore
 */
export const getChoreThreads = async (choreId) => {
  const { data, error } = await supabaseClient
    .from('Thread')
    .select(`
      *,
      AppUser(
        email, 
        first_name, 
        last_name
      ),
      Chore(
        id,
        title
      )
    `)
    .eq('chore_id', choreId)
    .order('date_created', { ascending: false });

  if (error) {
    console.error('Error fetching chore threads:', error);
    throw error;
  }
  return data;
};

/**
 * Get thread by ID
 */
export const getThreadById = async (threadId) => {
  const { data, error } = await supabaseClient
    .from('Thread')
    .select(`
      *,
      AppUser(
        email, 
        first_name, 
        last_name
      ),
      Chore(
        id,
        title
      )
    `)
    .eq('id', threadId)
    .single();

  if (error) {
    console.error('Error fetching thread:', error);
    throw error;
  }
  return data;
};

// ============================================
// MESSAGE - GET METHODS
// ============================================

/**
 * Get all messages in a thread
 */
export const getThreadMessages = async (threadId) => {
  const { data, error } = await supabaseClient
    .from('Message')
    .select(`
      *,
      AppUser(
        email, 
        first_name, 
        last_name
      )
    `)
    .eq('thread_id', threadId)
    .order('date_sent', { ascending: true });

  if (error) {
    console.error('Error fetching thread messages:', error);
    throw error;
  }
  return data;
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Convert day names to bitmask for repeat_days
 * Usage: getDaysBitmask(['Mon', 'Wed', 'Fri']) => 21
 */
export const getDaysBitmask = (dayNames) => {
  const dayMap = {
    'Mon': 1,
    'Tue': 2,
    'Wed': 4,
    'Thu': 8,
    'Fri': 16,
    'Sat': 32,
    'Sun': 64
  };

  return dayNames.reduce((mask, day) => mask | (dayMap[day] || 0), 0);
};

/**
 * Convert bitmask to day names
 * Usage: getBitmaskDays(21) => ['Mon', 'Wed', 'Fri']
 */
export const getBitmaskDays = (bitmask) => {
  const days = [];
  const dayMap = {
    1: 'Mon',
    2: 'Tue',
    4: 'Wed',
    8: 'Thu',
    16: 'Fri',
    32: 'Sat',
    64: 'Sun'
  };

  Object.entries(dayMap).forEach(([bit, name]) => {
    if (bitmask & parseInt(bit)) {
      days.push(name);
    }
  });

  return days;
};

/**
 * Format user's full name
 */
export const formatUserName = (user) => {
  if (!user) return 'Unknown';
  return `${user.first_name} ${user.last_name}`.trim();
};

/**
 * Check if chore is overdue
 */
export const isChoreOverdue = (chore) => {
  if (!chore.due_date || chore.status !== 'incomplete') return false;
  return new Date(chore.due_date) < new Date();
};

// ============================================
// REALTIME SUBSCRIPTIONS
// ============================================

/**
 * Subscribe to chore changes
 */
export const subscribeToChores = (callback) => {
  return supabaseClient
    .channel('chores_changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'Chore'
      },
      callback
    )
    .subscribe();
};

/**
 * Subscribe to machine changes
 */
export const subscribeToMachines = (callback) => {
  return supabaseClient
    .channel('machines_changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'Machine'
      },
      callback
    )
    .subscribe();
};

/**
 * Subscribe to messages in a thread
 */
export const subscribeToThreadMessages = (threadId, callback) => {
  return supabaseClient
    .channel(`thread_${threadId}_messages`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'Message',
        filter: `thread_id=eq.${threadId}`
      },
      callback
    )
    .subscribe();
};