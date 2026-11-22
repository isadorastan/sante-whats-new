export interface StickerContent {
  timeLabel: 'Horário'
  time: string
  durationLabel: 'Tempo'
  duration: string
  chips: string[]
  brand: 'SANTÉ'
}

const FONT = "'Barlow Condensed', sans-serif"
const WIDTH = 900
const SCALE = 2
const PAD_X = 64
const PAD_Y = 48
const LABEL_SIZE = 30
const VALUE_SIZE = 112
const LABEL_GAP = 4
const BLOCK_GAP = 38
const CHIP_SIZE = 36
const CHIP_PAD_X = 22
const CHIP_PAD_Y = 10
const CHIP_GAP = 14
const CHIP_ROW_GAP = 12
const CHIP_BLOCK_GAP = 44
const BRAND_SIZE = 56
const BRAND_GAP = 56
const BRAND_TRACK = 8
const LABEL_TRACK = 4
const MAX_CHIP_ROW = WIDTH - PAD_X * 2

interface ChipBox {
  text: string
  width: number
}

interface StickerLayout {
  width: number
  height: number
  rows: ChipBox[][]
}

export function formatWorkoutMinutes(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return ''
  const total = Math.round(minutes)
  if (total <= 0) return ''
  const hours = Math.floor(total / 60)
  const rest = total % 60
  if (hours === 0) return `${rest} min`
  if (rest === 0) return `${hours}h`
  return `${hours}h ${rest}m`
}

export function stickerContent(input: {
  time: string
  minutes: number
  chips: string[]
}): StickerContent | null {
  const time = input.time.trim()
  const duration = formatWorkoutMinutes(input.minutes)
  if (!time || !duration) return null
  return {
    timeLabel: 'Horário',
    time,
    durationLabel: 'Tempo',
    duration,
    chips: input.chips.map((item) => item.trim()).filter(Boolean),
    brand: 'SANTÉ',
  }
}

export function stickerFilename(date: string): string {
  return `sante-treino-${date}.png`
}

function font(weight: number, size: number): string {
  return `${weight} ${size}px ${FONT}`
}

function textWidth(ctx: CanvasRenderingContext2D, text: string, tracking: number): number {
  const chars = [...text]
  if (chars.length === 0) return 0
  const letters = chars.reduce((sum, char) => sum + ctx.measureText(char).width, 0)
  return letters + tracking * (chars.length - 1)
}

function fillTracked(
  ctx: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  y: number,
  tracking: number,
) {
  const chars = [...text]
  let x = centerX - textWidth(ctx, text, tracking) / 2
  ctx.textAlign = 'left'
  for (const char of chars) {
    ctx.fillText(char, x, y)
    x += ctx.measureText(char).width + tracking
  }
}

function chipRows(ctx: CanvasRenderingContext2D, chips: string[]): ChipBox[][] {
  ctx.font = font(700, CHIP_SIZE)
  const boxes = chips.map((text) => ({
    text,
    width: Math.ceil(ctx.measureText(text).width) + CHIP_PAD_X * 2,
  }))
  const rows: ChipBox[][] = []
  let row: ChipBox[] = []
  let rowWidth = 0
  for (const chip of boxes) {
    const needed = row.length === 0 ? chip.width : rowWidth + CHIP_GAP + chip.width
    if (row.length > 0 && needed > MAX_CHIP_ROW) {
      rows.push(row)
      row = [chip]
      rowWidth = chip.width
    } else {
      row.push(chip)
      rowWidth = needed
    }
  }
  if (row.length > 0) rows.push(row)
  return rows
}

function measureLayout(ctx: CanvasRenderingContext2D, content: StickerContent): StickerLayout {
  const rows = chipRows(ctx, content.chips)
  const chipHeight =
    rows.length === 0
      ? 0
      : CHIP_BLOCK_GAP +
        rows.length * (CHIP_SIZE + CHIP_PAD_Y * 2) +
        (rows.length - 1) * CHIP_ROW_GAP
  const block = LABEL_SIZE + LABEL_GAP + VALUE_SIZE
  return {
    width: WIDTH,
    height: PAD_Y + block + BLOCK_GAP + block + chipHeight + BRAND_GAP + BRAND_SIZE + PAD_Y,
    rows,
  }
}

function ink(ctx: CanvasRenderingContext2D, draw: () => void) {
  ctx.save()
  ctx.fillStyle = 'rgba(0, 0, 0, 0.78)'
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.78)'
  ctx.shadowColor = 'rgba(0, 0, 0, 0.9)'
  ctx.shadowBlur = 16
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = 2
  draw()
  ctx.restore()
  ctx.save()
  ctx.fillStyle = '#ffffff'
  ctx.strokeStyle = '#ffffff'
  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = 0
  draw()
  ctx.restore()
}

function drawStat(
  ctx: CanvasRenderingContext2D,
  label: string,
  value: string,
  y: number,
  width: number,
): number {
  ctx.font = font(600, LABEL_SIZE)
  ink(ctx, () => fillTracked(ctx, label.toLocaleUpperCase('pt-BR'), width / 2, y, LABEL_TRACK))
  y += LABEL_SIZE + LABEL_GAP
  ctx.font = font(700, VALUE_SIZE)
  ctx.textAlign = 'center'
  ink(ctx, () => ctx.fillText(value, width / 2, y))
  return y + VALUE_SIZE
}

export function drawShareSticker(canvas: HTMLCanvasElement, content: StickerContent) {
  const measureCtx = canvas.getContext('2d')
  if (!measureCtx) return
  const layout = measureLayout(measureCtx, content)
  canvas.width = layout.width * SCALE
  canvas.height = layout.height * SCALE
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0)
  ctx.clearRect(0, 0, layout.width, layout.height)
  ctx.fillStyle = '#ffffff'
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 2.5
  ctx.textBaseline = 'top'

  let y = PAD_Y
  y = drawStat(ctx, content.timeLabel, content.time, y, layout.width)
  y += BLOCK_GAP
  y = drawStat(ctx, content.durationLabel, content.duration, y, layout.width)

  if (layout.rows.length > 0) {
    y += CHIP_BLOCK_GAP
    const chipHeight = CHIP_SIZE + CHIP_PAD_Y * 2
    ctx.font = font(700, CHIP_SIZE)
    ctx.textBaseline = 'middle'
    for (const row of layout.rows) {
      const rowWidth =
        row.reduce((sum, chip) => sum + chip.width, 0) + CHIP_GAP * (row.length - 1)
      let x = (layout.width - rowWidth) / 2
      for (const chip of row) {
        const left = x
        ink(ctx, () => {
          ctx.beginPath()
          ctx.roundRect(left, y, chip.width, chipHeight, chipHeight / 2)
          ctx.stroke()
          ctx.textAlign = 'center'
          ctx.fillText(chip.text, left + chip.width / 2, y + chipHeight / 2)
        })
        x += chip.width + CHIP_GAP
      }
      y += chipHeight + CHIP_ROW_GAP
    }
    y -= CHIP_ROW_GAP
    ctx.textBaseline = 'top'
  }

  y += BRAND_GAP
  ctx.font = font(700, BRAND_SIZE)
  ink(ctx, () => fillTracked(ctx, content.brand, layout.width / 2, y, BRAND_TRACK))
}

async function loadStickerFont() {
  if (!document.fonts?.load) return
  const faces = [600, 700].flatMap((weight) =>
    [LABEL_SIZE, VALUE_SIZE, CHIP_SIZE, BRAND_SIZE].map((size) =>
      document.fonts.load(font(weight, size)),
    ),
  )
  await Promise.allSettled(faces)
}

export async function downloadShareSticker(content: StickerContent, filename: string) {
  await loadStickerFont()
  const canvas = document.createElement('canvas')
  drawShareSticker(canvas, content)
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((result) => resolve(result), 'image/png')
  })
  if (!blob) return
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
