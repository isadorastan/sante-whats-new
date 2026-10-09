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

function asDate(value) {
  if (!value) return null
  return String(value).slice(0, 10)
}

export function mapStudent(row) {
  return {
    id: Number(row.id),
    name: row.name,
    phone: row.phone ?? '',
    weeklyClasses: Number(row.weekly_classes),
    planValue: Number(row.plan_value),
    color: row.color,
    status: row.status ?? 'ativo',
    startedOn: asDate(row.started_on),
    endedOn: asDate(row.ended_on),
    billingDay:
      row.billing_day === null || row.billing_day === undefined
        ? null
        : Number(row.billing_day),
    customPrice: Boolean(row.custom_price),
  }
}

export function mapPlanPrice(row) {
  return {
    weeklyClasses: Number(row.weekly_classes),
    amount: Number(row.amount),
  }
}

export function mapPayment(row) {
  return {
    id: Number(row.id),
    studentId: Number(row.student_id),
    competence: String(row.competence).slice(0, 7),
    amount: Number(row.amount),
    dueOn: asDate(row.due_on),
    paidOn: asDate(row.paid_on),
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
