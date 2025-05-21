export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      crypto_alerts: {
        Row: {
          id: string
          ticker: string
          price: number
          change_percent: number
          relative_volume: number
          alert_type: string
          created_at: string
        }
        Insert: {
          id?: string
          ticker: string
          price: number
          change_percent: number
          relative_volume: number
          alert_type: string
          created_at?: string
        }
        Update: {
          id?: string
          ticker?: string
          price?: number
          change_percent?: number
          relative_volume?: number
          alert_type?: string
          created_at?: string
        }
      }
    }
  }
}