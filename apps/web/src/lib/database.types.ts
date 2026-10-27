export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      achievements: {
        Row: {
          bonus_points: number;
          code: string;
          description_en: string;
          description_nb: string;
          icon: string;
          is_secret: boolean;
          name_en: string;
          name_nb: string;
          rule: NonNullable<Json>;
          sort: number;
        };
        ComputedFields: never;
        Insert: {
          bonus_points?: number;
          code: string;
          description_en: string;
          description_nb: string;
          icon: string;
          is_secret?: boolean;
          name_en: string;
          name_nb: string;
          rule: NonNullable<Json>;
          sort?: number;
        };
        Update: {
          bonus_points?: number;
          code?: string;
          description_en?: string;
          description_nb?: string;
          icon?: string;
          is_secret?: boolean;
          name_en?: string;
          name_nb?: string;
          rule?: NonNullable<Json>;
          sort?: number;
        };
        Relationships: [];
      };
      assignments: {
        Row: {
          challenge_id: string;
          completed_at: string | null;
          created_at: string;
          id: string;
          member_id: string;
          points_awarded: number;
          replaces_id: string | null;
          season_id: string;
          slot: number;
          status: Database['public']['Enums']['assignment_status'];
          week_start: string;
        };
        ComputedFields: never;
        Insert: {
          challenge_id: string;
          completed_at?: string | null;
          created_at?: string;
          id?: string;
          member_id: string;
          points_awarded?: number;
          replaces_id?: string | null;
          season_id: string;
          slot: number;
          status?: Database['public']['Enums']['assignment_status'];
          week_start: string;
        };
        Update: {
          challenge_id?: string;
          completed_at?: string | null;
          created_at?: string;
          id?: string;
          member_id?: string;
          points_awarded?: number;
          replaces_id?: string | null;
          season_id?: string;
          slot?: number;
          status?: Database['public']['Enums']['assignment_status'];
          week_start?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'assignments_challenge_id_fkey';
            columns: ['challenge_id'];
            isOneToOne: false;
            referencedRelation: 'challenges';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'assignments_member_id_fkey';
            columns: ['member_id'];
            isOneToOne: false;
            referencedRelation: 'members';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'assignments_replaces_id_fkey';
            columns: ['replaces_id'];
            isOneToOne: false;
            referencedRelation: 'assignments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'assignments_season_id_fkey';
            columns: ['season_id'];
            isOneToOne: false;
            referencedRelation: 'seasons';
            referencedColumns: ['id'];
          },
        ];
      };
      audit_log: {
        Row: {
          action: string;
          actor: string | null;
          at: string;
          id: number;
          target: string | null;
          workplace_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          action: string;
          actor?: string | null;
          at?: string;
          id?: never;
          target?: string | null;
          workplace_id?: string | null;
        };
        Update: {
          action?: string;
          actor?: string | null;
          at?: string;
          id?: never;
          target?: string | null;
          workplace_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'audit_log_workplace_id_fkey';
            columns: ['workplace_id'];
            isOneToOne: false;
            referencedRelation: 'workplaces';
            referencedColumns: ['id'];
          },
        ];
      };
      catalog_templates: {
        Row: {
          body_en: string;
          body_nb: string;
          category: Database['public']['Enums']['challenge_category'];
          difficulty: number;
          id: number;
          points: number;
          title_en: string;
          title_nb: string;
        };
        ComputedFields: never;
        Insert: {
          body_en?: string;
          body_nb?: string;
          category: Database['public']['Enums']['challenge_category'];
          difficulty?: number;
          id?: never;
          points?: number;
          title_en: string;
          title_nb: string;
        };
        Update: {
          body_en?: string;
          body_nb?: string;
          category?: Database['public']['Enums']['challenge_category'];
          difficulty?: number;
          id?: never;
          points?: number;
          title_en?: string;
          title_nb?: string;
        };
        Relationships: [];
      };
      challenges: {
        Row: {
          archived_at: string | null;
          body_en: string;
          body_nb: string;
          category: Database['public']['Enums']['challenge_category'];
          created_at: string;
          created_by: string | null;
          difficulty: number;
          id: string;
          is_active: boolean;
          points: number;
          title_en: string;
          title_nb: string;
          updated_at: string;
          workplace_id: string;
        };
        ComputedFields: never;
        Insert: {
          archived_at?: string | null;
          body_en?: string;
          body_nb?: string;
          category: Database['public']['Enums']['challenge_category'];
          created_at?: string;
          created_by?: string | null;
          difficulty?: number;
          id?: string;
          is_active?: boolean;
          points?: number;
          title_en: string;
          title_nb: string;
          updated_at?: string;
          workplace_id: string;
        };
        Update: {
          archived_at?: string | null;
          body_en?: string;
          body_nb?: string;
          category?: Database['public']['Enums']['challenge_category'];
          created_at?: string;
          created_by?: string | null;
          difficulty?: number;
          id?: string;
          is_active?: boolean;
          points?: number;
          title_en?: string;
          title_nb?: string;
          updated_at?: string;
          workplace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'challenges_workplace_id_fkey';
            columns: ['workplace_id'];
            isOneToOne: false;
            referencedRelation: 'workplaces';
            referencedColumns: ['id'];
          },
        ];
      };
      invites: {
        Row: {
          code_hash: string;
          created_at: string;
          created_by: string | null;
          expires_at: string;
          id: string;
          max_uses: number;
          role: Database['public']['Enums']['member_role'];
          uses: number;
          workplace_id: string;
        };
        ComputedFields: never;
        Insert: {
          code_hash: string;
          created_at?: string;
          created_by?: string | null;
          expires_at: string;
          id?: string;
          max_uses?: number;
          role?: Database['public']['Enums']['member_role'];
          uses?: number;
          workplace_id: string;
        };
        Update: {
          code_hash?: string;
          created_at?: string;
          created_by?: string | null;
          expires_at?: string;
          id?: string;
          max_uses?: number;
          role?: Database['public']['Enums']['member_role'];
          uses?: number;
          workplace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'invites_workplace_id_fkey';
            columns: ['workplace_id'];
            isOneToOne: false;
            referencedRelation: 'workplaces';
            referencedColumns: ['id'];
          },
        ];
      };
      job_runs: {
        Row: {
          detail: NonNullable<Json>;
          finished_at: string | null;
          id: number;
          job: string;
          ok: boolean | null;
          started_at: string;
        };
        ComputedFields: never;
        Insert: {
          detail?: NonNullable<Json>;
          finished_at?: string | null;
          id?: never;
          job: string;
          ok?: boolean | null;
          started_at?: string;
        };
        Update: {
          detail?: NonNullable<Json>;
          finished_at?: string | null;
          id?: never;
          job?: string;
          ok?: boolean | null;
          started_at?: string;
        };
        Relationships: [];
      };
      member_achievements: {
        Row: {
          achievement_code: string;
          member_id: string;
          unlocked_at: string;
        };
        ComputedFields: never;
        Insert: {
          achievement_code: string;
          member_id: string;
          unlocked_at?: string;
        };
        Update: {
          achievement_code?: string;
          member_id?: string;
          unlocked_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'member_achievements_achievement_code_fkey';
            columns: ['achievement_code'];
            isOneToOne: false;
            referencedRelation: 'achievements';
            referencedColumns: ['code'];
          },
          {
            foreignKeyName: 'member_achievements_member_id_fkey';
            columns: ['member_id'];
            isOneToOne: false;
            referencedRelation: 'members';
            referencedColumns: ['id'];
          },
        ];
      };
      members: {
        Row: {
          avatar: NonNullable<Json>;
          farmer_name: string | null;
          id: string;
          joined_at: string;
          nisse_name: string | null;
          role: Database['public']['Enums']['member_role'];
          story: Database['public']['Enums']['story'];
          user_id: string;
          workplace_id: string;
        };
        ComputedFields: never;
        Insert: {
          avatar?: NonNullable<Json>;
          farmer_name?: string | null;
          id?: string;
          joined_at?: string;
          nisse_name?: string | null;
          role?: Database['public']['Enums']['member_role'];
          story?: Database['public']['Enums']['story'];
          user_id: string;
          workplace_id: string;
        };
        Update: {
          avatar?: NonNullable<Json>;
          farmer_name?: string | null;
          id?: string;
          joined_at?: string;
          nisse_name?: string | null;
          role?: Database['public']['Enums']['member_role'];
          story?: Database['public']['Enums']['story'];
          user_id?: string;
          workplace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'members_workplace_id_fkey';
            columns: ['workplace_id'];
            isOneToOne: false;
            referencedRelation: 'workplaces';
            referencedColumns: ['id'];
          },
        ];
      };
      platform_admins: {
        Row: {
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          user_id: string;
        };
        Update: {
          user_id?: string;
        };
        Relationships: [];
      };
      points_ledger: {
        Row: {
          achievement_code: string | null;
          assignment_id: string | null;
          created_at: string;
          delta: number;
          id: number;
          member_id: string;
          note: string | null;
          reason: Database['public']['Enums']['ledger_reason'];
          season_id: string;
          week_start: string;
        };
        ComputedFields: never;
        Insert: {
          achievement_code?: string | null;
          assignment_id?: string | null;
          created_at?: string;
          delta: number;
          id?: never;
          member_id: string;
          note?: string | null;
          reason: Database['public']['Enums']['ledger_reason'];
          season_id: string;
          week_start: string;
        };
        Update: {
          achievement_code?: string | null;
          assignment_id?: string | null;
          created_at?: string;
          delta?: number;
          id?: never;
          member_id?: string;
          note?: string | null;
          reason?: Database['public']['Enums']['ledger_reason'];
          season_id?: string;
          week_start?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'points_ledger_assignment_id_fkey';
            columns: ['assignment_id'];
            isOneToOne: false;
            referencedRelation: 'assignments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'points_ledger_member_id_fkey';
            columns: ['member_id'];
            isOneToOne: false;
            referencedRelation: 'members';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'points_ledger_season_id_fkey';
            columns: ['season_id'];
            isOneToOne: false;
            referencedRelation: 'seasons';
            referencedColumns: ['id'];
          },
        ];
      };
      seasons: {
        Row: {
          created_at: string;
          distribution_hour: number;
          ends_on: string;
          id: string;
          name: string;
          starts_on: string;
          status: Database['public']['Enums']['season_status'];
          workplace_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          distribution_hour?: number;
          ends_on: string;
          id?: string;
          name: string;
          starts_on: string;
          status?: Database['public']['Enums']['season_status'];
          workplace_id: string;
        };
        Update: {
          created_at?: string;
          distribution_hour?: number;
          ends_on?: string;
          id?: string;
          name?: string;
          starts_on?: string;
          status?: Database['public']['Enums']['season_status'];
          workplace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'seasons_workplace_id_fkey';
            columns: ['workplace_id'];
            isOneToOne: false;
            referencedRelation: 'workplaces';
            referencedColumns: ['id'];
          },
        ];
      };
      week_closures: {
        Row: {
          closed_at: string;
          week_start: string;
          workplace_id: string;
        };
        ComputedFields: never;
        Insert: {
          closed_at?: string;
          week_start: string;
          workplace_id: string;
        };
        Update: {
          closed_at?: string;
          week_start?: string;
          workplace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'week_closures_workplace_id_fkey';
            columns: ['workplace_id'];
            isOneToOne: false;
            referencedRelation: 'workplaces';
            referencedColumns: ['id'];
          },
        ];
      };
      workplaces: {
        Row: {
          allowed_email_domains: string[];
          created_at: string;
          id: string;
          name: string;
          slug: string;
          timezone: string;
        };
        ComputedFields: never;
        Insert: {
          allowed_email_domains?: string[];
          created_at?: string;
          id?: string;
          name: string;
          slug: string;
          timezone?: string;
        };
        Update: {
          allowed_email_domains?: string[];
          created_at?: string;
          id?: string;
          name?: string;
          slug?: string;
          timezone?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      admin_adjust_points: {
        Args: { p_delta: number; p_member: string; p_note: string };
        Returns: undefined;
      };
      admin_create_invite: {
        Args: { p_days?: number; p_role: Database['public']['Enums']['member_role'] };
        Returns: string;
      };
      admin_remove_member: { Args: { p_member: string }; Returns: undefined };
      admin_set_role: {
        Args: { p_member: string; p_role: Database['public']['Enums']['member_role'] };
        Returns: undefined;
      };
      admin_stats: { Args: Record<PropertyKey, never>; Returns: Json };
      admin_upsert_season: {
        Args: {
          p_ends: string;
          p_hour: number;
          p_id: string;
          p_name: string;
          p_starts: string;
          p_status: Database['public']['Enums']['season_status'];
        };
        Returns: string;
      };
      complete_assignment: { Args: { p_assignment: string }; Returns: Json };
      ensure_my_week: { Args: Record<PropertyKey, never>; Returns: Json };
      leaderboard: {
        Args: { p_scope?: string };
        Returns: {
          member_id: string;
          name: string;
          points: number;
          rank: number;
        }[];
      };
      me: { Args: Record<PropertyKey, never>; Returns: Json };
      platform_create_workplace: {
        Args: { p_allowed_domains?: string[]; p_name: string; p_slug: string };
        Returns: string;
      };
      platform_health: { Args: Record<PropertyKey, never>; Returns: string };
      redeem_invite: {
        Args: { p_code: string; p_name: string; p_story: Database['public']['Enums']['story'] };
        Returns: Json;
      };
      reroll_assignment: { Args: { p_assignment: string }; Returns: Json };
      skip_assignment: { Args: { p_assignment: string }; Returns: Json };
      taken_names: { Args: { p_code: string }; Returns: string[] };
      update_profile: {
        Args: { p_name?: string; p_story: Database['public']['Enums']['story'] };
        Returns: undefined;
      };
    };
    Enums: {
      assignment_status: 'open' | 'completed' | 'skipped' | 'rerolled';
      challenge_category: 'social' | 'kindness' | 'learning' | 'collaboration' | 'holiday_fun';
      ledger_reason: 'challenge' | 'full_week' | 'streak' | 'achievement' | 'admin_adjustment';
      member_role: 'player' | 'admin';
      season_status: 'draft' | 'active' | 'finished';
      story: 'gaarden' | 'laaven';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      assignment_status: ['open', 'completed', 'skipped', 'rerolled'],
      challenge_category: ['social', 'kindness', 'learning', 'collaboration', 'holiday_fun'],
      ledger_reason: ['challenge', 'full_week', 'streak', 'achievement', 'admin_adjustment'],
      member_role: ['player', 'admin'],
      season_status: ['draft', 'active', 'finished'],
      story: ['gaarden', 'laaven'],
    },
  },
} as const;
