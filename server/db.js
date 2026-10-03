import './loadEnv.js'
import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
// Nova API key (sb_secret_...) — service_role JWT ainda aceito como fallback
const key =
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.warn(
    '[db] SUPABASE_URL / SUPABASE_SECRET_KEY missing — CRUD de alunos/agenda indisponível',
  )
}

export const supabase =
  url && key
    ? createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null

export function requireDb(res) {
  if (!supabase) {
    res.status(503).json({
      error:
        'Supabase não configurado. Defina SUPABASE_URL e SUPABASE_SECRET_KEY em server/.env',
    })
    return null
  }
  return supabase
}

export function mapStudent(row) {
  return {
    id: Number(row.id),
    name: row.name,
    phone: row.phone ?? '',
    weeklyClasses: Number(row.weekly_classes),
    planValue: Number(row.plan_value),
    color: row.color,
  }
}

export function mapSession(row) {
  return {
    id: Number(row.id),
    studentId: Number(row.student_id),
    day: row.day,
    time: row.time,
    durationMinutes: Number(row.duration_minutes),
  }
}
