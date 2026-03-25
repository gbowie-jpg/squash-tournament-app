export type Database = {
  public: {
    Tables: {
      tournaments: {
        Row: {
          id: string;
          name: string;
          slug: string;
          venue: string | null;
          address: string | null;
          start_date: string;
          end_date: string | null;
          status: 'upcoming' | 'active' | 'completed';
          court_count: number;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          venue?: string | null;
          address?: string | null;
          start_date: string;
          end_date?: string | null;
          status?: 'upcoming' | 'active' | 'completed';
          court_count?: number;
          description?: string | null;
        };
        Update: Partial<Database['public']['Tables']['tournaments']['Insert']>;
      };
      courts: {
        Row: {
          id: string;
          tournament_id: string;
          name: string;
          sort_order: number;
          status: 'available' | 'in_use' | 'maintenance';
          created_at: string;
        };
        Insert: {
          id?: string;
          tournament_id: string;
          name: string;
          sort_order?: number;
          status?: 'available' | 'in_use' | 'maintenance';
        };
        Update: Partial<Database['public']['Tables']['courts']['Insert']>;
      };
      players: {
        Row: {
          id: string;
          tournament_id: string;
          name: string;
          seed: number | null;
          club: string | null;
          email: string | null;
          phone: string | null;
          draw: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tournament_id: string;
          name: string;
          seed?: number | null;
          club?: string | null;
          email?: string | null;
          phone?: string | null;
          draw?: string | null;
        };
        Update: Partial<Database['public']['Tables']['players']['Insert']>;
      };
      matches: {
        Row: {
          id: string;
          tournament_id: string;
          court_id: string | null;
          player1_id: string | null;
          player2_id: string | null;
          draw: string | null;
          round: string | null;
          match_number: number | null;
          status: 'scheduled' | 'on_deck' | 'in_progress' | 'completed' | 'walkover' | 'cancelled';
          scheduled_time: string | null;
          started_at: string | null;
          completed_at: string | null;
          scores: GameScore[];
          winner_id: string | null;
          notes: string | null;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tournament_id: string;
          court_id?: string | null;
          player1_id?: string | null;
          player2_id?: string | null;
          draw?: string | null;
          round?: string | null;
          match_number?: number | null;
          status?: 'scheduled' | 'on_deck' | 'in_progress' | 'completed' | 'walkover' | 'cancelled';
          scheduled_time?: string | null;
          scores?: GameScore[];
          winner_id?: string | null;
          notes?: string | null;
          sort_order?: number;
        };
        Update: Partial<Database['public']['Tables']['matches']['Insert']>;
      };
      announcements: {
        Row: {
          id: string;
          tournament_id: string;
          message: string;
          priority: 'normal' | 'urgent';
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tournament_id: string;
          message: string;
          priority?: 'normal' | 'urgent';
          created_by?: string | null;
        };
        Update: Partial<Database['public']['Tables']['announcements']['Insert']>;
      };
      organizers: {
        Row: {
          id: string;
          tournament_id: string;
          user_id: string;
          role: 'admin' | 'scorer';
          created_at: string;
        };
        Insert: {
          id?: string;
          tournament_id: string;
          user_id: string;
          role?: 'admin' | 'scorer';
        };
        Update: Partial<Database['public']['Tables']['organizers']['Insert']>;
      };
    };
  };
};

export type GameScore = { p1: number; p2: number };

// Convenience aliases
export type Tournament = Database['public']['Tables']['tournaments']['Row'];
export type Court = Database['public']['Tables']['courts']['Row'];
export type Player = Database['public']['Tables']['players']['Row'];
export type Match = Database['public']['Tables']['matches']['Row'];
export type Announcement = Database['public']['Tables']['announcements']['Row'];

// Match with joined player/court data
export type MatchWithDetails = Match & {
  player1: Player | null;
  player2: Player | null;
  court: Court | null;
};
