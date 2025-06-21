import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Photo = {
  id: string
  name: string
  description: string
  image_url: string
  created_at: string
  likes_count?: number
  category?: string
  tags?: string[]
}

export type PhotoComment = {
  id: string
  photo_id: string
  user_name: string
  comment: string
  created_at: string
}

export const HORROR_CATEGORIES = [
  { value: "general", label: "General", icon: "👻" },
  { value: "supernatural", label: "Sobrenatural", icon: "🔮" },
  { value: "gore", label: "Gore", icon: "🩸" },
  { value: "psychological", label: "Psicológico", icon: "🧠" },
  { value: "creatures", label: "Criaturas", icon: "👹" },
  { value: "haunted", label: "Embrujado", icon: "🏚️" },
  { value: "apocalyptic", label: "Apocalíptico", icon: "☠️" },
  { value: "occult", label: "Oculto", icon: "🕯️" },
]

// Generar un ID de sesión único para el usuario
export const getUserSession = () => {
  let sessionId = localStorage.getItem("horror-session-id")
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2)}`
    localStorage.setItem("horror-session-id", sessionId)
  }
  return sessionId
}
