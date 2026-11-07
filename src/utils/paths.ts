function appBase(): string {
  const base = import.meta.env.BASE_URL || '/'
  return base.endsWith('/') ? base : `${base}/`
}

function pathName(pathname: string): string {
  return pathname.replace(/\/+$/, '') || '/'
}

export function isAlunoPath(pathname = window.location.pathname): boolean {
  return pathName(pathname).endsWith('/aluno')
}

export function isAdminPath(pathname = window.location.pathname): boolean {
  return pathName(pathname).endsWith('/admin')
}

export function isVendasPath(pathname = window.location.pathname): boolean {
  return pathName(pathname).endsWith('/vendas')
}

export function isLegacyCheckinPath(pathname = window.location.pathname): boolean {
  return pathName(pathname).endsWith('/checkin')
}

export function alunoHref(): string {
  return `${appBase()}aluno`
}

export function adminHref(): string {
  return `${appBase()}admin`
}

export function vendasHref(): string {
  return `${appBase()}vendas`
}
