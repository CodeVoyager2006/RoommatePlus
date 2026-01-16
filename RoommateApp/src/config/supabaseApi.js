import { supabaseClient } from './supabaseClient';

/**
 * Fetch all chores with their assignments
 * Returns chores grouped by roommate
 */
export async function fetchChores() {
  try {
    // Get all chores with their assignments
    const { data: chores, error: choresError } = await supabaseClient
      .from('chores')
      .select(`
        *,
        chore_assignments (
          user_id,
          users (
            id,
            username
          )
        )
      `)
      .order('due_date', { ascending: true });

    if (choresError) throw choresError;

    // Get all users to create roommate structure
    const { data: users, error: usersError } = await supabaseClient
      .from('users')
      .select('*');

    if (usersError) throw usersError;

    // Transform data to match existing component structure
    const roommatesMap = new Map();
    
    // Initialize all users
    users.forEach(user => {
      roommatesMap.set(user.id, {
        name: user.username,
        chores: []
      });
    });

    // Group chores by assigned users
    chores.forEach(chore => {
      const choreData = {
        id: chore.id,
        title: chore.title,
        dueDate: chore.due_date,
        description: chore.description || '',
        peopleAssigned: chore.chore_assignments?.map(a => a.users.username) || [],
        repeatDays: chore.repeat_days || []
      };

      // Add chore to each assigned user
      chore.chore_assignments?.forEach(assignment => {
        const userId = assignment.user_id;
        if (roommatesMap.has(userId)) {
          roommatesMap.get(userId).chores.push(choreData);
        }
      });
    });

    // Convert map to array
    return Array.from(roommatesMap.values());
  } catch (error) {
    console.error('Error fetching chores:', error);
    throw error;
  }
}

/**
 * Fetch all machines
 * Returns array of machine objects
 */
export async function fetchMachines() {
  try {
    const { data, error } = await supabaseClient
      .from('machines')
      .select(`
        *,
        users (
          username
        )
      `)
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Transform to match component structure
    return data.map(machine => ({
      id: machine.id,
      name: machine.name,
      image: machine.image_url || null,
      status: machine.is_occupied ? 'busy' : 'available',
      occupiedBy: machine.is_occupied ? (machine.users?.username || '') : ''
    }));
  } catch (error) {
    console.error('Error fetching machines:', error);
    throw error;
  }
}

/**
 * Fetch all users (for roommate selection, etc.)
 */
export async function fetchUsers() {
  try {
    const { data, error } = await supabaseClient
      .from('users')
      .select('*')
      .order('username', { ascending: true });

    if (error) throw error;

    return data.map(user => ({
      id: user.id,
      name: user.username
    }));
  } catch (error) {
    console.error('Error fetching users:', error);
    throw error;
  }
}

/**
 * Fetch current user session
 */
export async function getCurrentUser() {
  try {
    const { data: { session }, error } = await supabaseClient.auth.getSession();
    
    if (error) throw error;
    if (!session) return null;

    // Get user details from users table
    const { data: userData, error: userError } = await supabaseClient
      .from('users')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (userError) throw userError;

    return {
      id: userData.id,
      name: userData.username,
      email: userData.email,
      points: userData.points || 0,
      streak: userData.streak || 0
    };
  } catch (error) {
    console.error('Error fetching current user:', error);
    throw error;
  }
}

/**
 * Fetch user profile with stats
 */
export async function fetchUserProfile(userId) {
  try {
    const { data, error } = await supabaseClient
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) throw error;

    return {
      id: data.id,
      name: data.username,
      email: data.email,
      points: data.points || 0,
      streak: data.streak || 0
    };
  } catch (error) {
    console.error('Error fetching user profile:', error);
    throw error;
  }
}