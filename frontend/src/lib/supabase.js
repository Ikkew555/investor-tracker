import { createClient } from '@supabase/supabase-js';

// Initialize the Supabase client — credentials must come from environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing required environment variables: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in .env');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Authentication functions
export const auth = {
  // Sign up with email and password
  signUp: async (email, password, userData) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: userData // Additional user data like first_name, last_name
      }
    });
    return { data, error };
  },

  // Sign in with email and password
  signIn: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    return { data, error };
  },

  // Sign in with Google OAuth
  signInWithGoogle: async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    });
    return { data, error };
  },

  // Sign out the current user
  signOut: async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  },

  // Get the current user session
  getSession: async () => {
    const { data, error } = await supabase.auth.getSession();
    return { data, error };
  },

  // Get the current user
  getUser: async () => {
    const { data, error } = await supabase.auth.getUser();
    return { data, error };
  },

  // Update the current user profile
  updateProfile: async (userData) => {
    const { data, error } = await supabase.auth.updateUser({
      data: userData
    });
    return { data, error };
  }
};

// User profile functions
export const profiles = {
  // Get a user's profile
  getProfile: async (userId) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    return { data, error };
  },

  // Update a user's profile
  updateProfile: async (userId, updates) => {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId);
    return { data, error };
  }
};

// Securities functions
export const securities = {
  // Search for securities
  searchSecurities: async (query) => {
    const { data, error } = await supabase
      .from('securities')
      .select('*')
      .ilike('symbol', `%${query}%`)
      .or(`name.ilike.%${query}%`)
      .limit(20);
    return { data, error };
  },

  // Get a security by ID
  getSecurity: async (id) => {
    const { data, error } = await supabase
      .from('securities')
      .select('*')
      .eq('id', id)
      .single();
    return { data, error };
  },

  // Add a new security
  addSecurity: async (security) => {
    const { data, error } = await supabase
      .from('securities')
      .insert(security);
    return { data, error };
  }
};

// Activities functions
export const activities = {
  // Get all activities for a user
  getActivities: async (userId) => {
    const { data, error } = await supabase
      .from('activities')
      .select(`
        *,
        securities:security_id (*)
      `)
      .eq('user_id', userId)
      .order('date', { ascending: false });
    return { data, error };
  },

  // Add a new activity
  addActivity: async (activity) => {
    const { data, error } = await supabase
      .from('activities')
      .insert(activity);
    return { data, error };
  },

  // Update an activity
  updateActivity: async (activityId, updates) => {
    const { data, error } = await supabase
      .from('activities')
      .update(updates)
      .eq('id', activityId);
    return { data, error };
  },

  // Delete an activity
  deleteActivity: async (activityId) => {
    const { error } = await supabase
      .from('activities')
      .delete()
      .eq('id', activityId);
    return { error };
  },

  // Import activities from CSV data
  importActivities: async (userId, activitiesData) => {
    // Add user_id to each activity
    const activitiesWithUserId = activitiesData.map(activity => ({
      ...activity,
      user_id: userId
    }));
    
    const { data, error } = await supabase
      .from('activities')
      .insert(activitiesWithUserId);
    return { data, error };
  }
};

// Brokers functions
export const brokers = {
  // Get all brokers for a user
  getBrokers: async (userId) => {
    const { data, error } = await supabase
      .from('brokers')
      .select('*')
      .eq('user_id', userId);
    return { data, error };
  },
  
  // Add a new broker
  addBroker: async (broker) => {
    const { data, error } = await supabase
      .from('brokers')
      .insert(broker);
    return { data, error };
  },
  
  // Update a broker
  updateBroker: async (brokerId, updates) => {
    const { data, error } = await supabase
      .from('brokers')
      .update(updates)
      .eq('id', brokerId);
    return { data, error };
  },
  
  // Delete a broker
  deleteBroker: async (brokerId) => {
    const { error } = await supabase
      .from('brokers')
      .delete()
      .eq('id', brokerId);
    return { error };
  }
};

// User settings functions
export const settings = {
  // Get user settings
  getSettings: async (userId) => {
    const { data, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', userId)
      .single();
    return { data, error };
  },
  
  // Update user settings
  updateSettings: async (userId, updates) => {
    // Check if settings exist first
    const { data: existingSettings } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (existingSettings) {
      // Update existing settings
      const { data, error } = await supabase
        .from('user_settings')
        .update(updates)
        .eq('user_id', userId);
      return { data, error };
    } else {
      // Insert new settings
      const { data, error } = await supabase
        .from('user_settings')
        .insert({ user_id: userId, ...updates });
      return { data, error };
    }
  }
};

export default supabase;