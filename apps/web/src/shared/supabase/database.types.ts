export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      article_instruments: {
        Row: {
          article_id: string
          confidence: number
          created_at: string
          instrument_id: string
          match_method: string
        }
        Insert: {
          article_id: string
          confidence: number
          created_at?: string
          instrument_id: string
          match_method?: string
        }
        Update: {
          article_id?: string
          confidence?: number
          created_at?: string
          instrument_id?: string
          match_method?: string
        }
        Relationships: [
          {
            foreignKeyName: "article_instruments_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "article_instruments_instrument_id_fkey"
            columns: ["instrument_id"]
            isOneToOne: false
            referencedRelation: "instruments"
            referencedColumns: ["id"]
          },
        ]
      }
      articles: {
        Row: {
          canonical_article_id: string | null
          content_hash: string
          created_at: string
          embedding: string | null
          id: string
          ingested_at: string
          published_at: string
          raw_content: string | null
          source: string
          title: string
          updated_at: string
          url: string
        }
        Insert: {
          canonical_article_id?: string | null
          content_hash: string
          created_at?: string
          embedding?: string | null
          id?: string
          ingested_at?: string
          published_at: string
          raw_content?: string | null
          source: string
          title: string
          updated_at?: string
          url: string
        }
        Update: {
          canonical_article_id?: string | null
          content_hash?: string
          created_at?: string
          embedding?: string | null
          id?: string
          ingested_at?: string
          published_at?: string
          raw_content?: string | null
          source?: string
          title?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "articles_canonical_article_id_fkey"
            columns: ["canonical_article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
        ]
      }
      digests: {
        Row: {
          generated_at: string
          id: string
          payload: Json
          period: Database["public"]["Enums"]["digest_period"]
          period_start: string
          user_id: string
        }
        Insert: {
          generated_at?: string
          id?: string
          payload: Json
          period: Database["public"]["Enums"]["digest_period"]
          period_start: string
          user_id: string
        }
        Update: {
          generated_at?: string
          id?: string
          payload?: Json
          period?: Database["public"]["Enums"]["digest_period"]
          period_start?: string
          user_id?: string
        }
        Relationships: []
      }
      feeds: {
        Row: {
          active: boolean
          created_at: string
          id: string
          macro_bucket: string
          source: string
          updated_at: string
          url: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          macro_bucket: string
          source: string
          updated_at?: string
          url: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          macro_bucket?: string
          source?: string
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      instruments: {
        Row: {
          active: boolean
          created_at: string
          id: string
          isin: string | null
          macro_bucket: string | null
          name: string
          ticker: string
          type: Database["public"]["Enums"]["instrument_type"]
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          isin?: string | null
          macro_bucket?: string | null
          name: string
          ticker: string
          type: Database["public"]["Enums"]["instrument_type"]
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          isin?: string | null
          macro_bucket?: string | null
          name?: string
          ticker?: string
          type?: Database["public"]["Enums"]["instrument_type"]
          updated_at?: string
        }
        Relationships: []
      }
      portfolio_positions: {
        Row: {
          cost_basis: number | null
          created_at: string
          id: string
          instrument_id: string
          quantity: number
          updated_at: string
          user_id: string
        }
        Insert: {
          cost_basis?: number | null
          created_at?: string
          id?: string
          instrument_id: string
          quantity: number
          updated_at?: string
          user_id: string
        }
        Update: {
          cost_basis?: number | null
          created_at?: string
          id?: string
          instrument_id?: string
          quantity?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_positions_instrument_id_fkey"
            columns: ["instrument_id"]
            isOneToOne: false
            referencedRelation: "instruments"
            referencedColumns: ["id"]
          },
        ]
      }
      summaries: {
        Row: {
          article_id: string
          confidence: number | null
          generated_at: string
          id: string
          input_tokens: number | null
          instruments_mentioned: string[]
          model: string
          output_tokens: number | null
          prompt_version: string
          summary_text: string | null
          tonality: Database["public"]["Enums"]["tonality"]
        }
        Insert: {
          article_id: string
          confidence?: number | null
          generated_at?: string
          id?: string
          input_tokens?: number | null
          instruments_mentioned?: string[]
          model: string
          output_tokens?: number | null
          prompt_version?: string
          summary_text?: string | null
          tonality: Database["public"]["Enums"]["tonality"]
        }
        Update: {
          article_id?: string
          confidence?: number | null
          generated_at?: string
          id?: string
          input_tokens?: number | null
          instruments_mentioned?: string[]
          model?: string
          output_tokens?: number | null
          prompt_version?: string
          summary_text?: string | null
          tonality?: Database["public"]["Enums"]["tonality"]
        }
        Relationships: [
          {
            foreignKeyName: "summaries_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      match_articles: {
        Args: { match_count?: number; query_embedding: string; since: string }
        Returns: {
          distance: number
          id: string
        }[]
      }
    }
    Enums: {
      digest_period: "daily" | "weekly"
      instrument_type: "stock" | "etf"
      tonality: "bullish" | "neutral" | "bearish"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      digest_period: ["daily", "weekly"],
      instrument_type: ["stock", "etf"],
      tonality: ["bullish", "neutral", "bearish"],
    },
  },
} as const

