// ponytail: placeholder until `pnpm db:types` runs against linked Supabase project.
// Generated types should replace manual casts in PortfolioProvider and views.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
