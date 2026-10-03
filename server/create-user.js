import './loadEnv.js'
import { supabase } from './db.js'

const email = process.argv[2]?.trim()
const password = process.argv.slice(3).join(' ')

if (!email || !password) {
  console.error('Uso: node server/create-user.js <email> <senha>')
  process.exit(1)
}

if (!supabase) {
  console.error('Defina SUPABASE_URL e SUPABASE_SECRET_KEY em server/.env')
  process.exit(1)
}

const { error } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
})

if (error) {
  if (/already been registered|already exists/i.test(error.message)) {
    console.error(`Usuário "${email}" já existe`)
  } else {
    console.error(error.message)
  }
  process.exit(1)
}

console.log(`Usuário ${email} criado`)
