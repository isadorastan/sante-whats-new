export function toWhatsAppDigits(phone) {
  let digits = String(phone ?? '').replace(/\D/g, '')
  if (digits.startsWith('00')) digits = digits.slice(2)

  if (
    (digits.length === 12 || digits.length === 13) &&
    digits.startsWith('55')
  ) {
    return digits
  }

  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`
  }

  return digits
}

export function isValidWhatsAppPhone(phone) {
  const digits = toWhatsAppDigits(phone)
  return digits.length === 12 || digits.length === 13
}
