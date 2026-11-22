import { expect, it } from 'vitest'
import {
  drawShareSticker,
  formatWorkoutMinutes,
  stickerContent,
  stickerFilename,
  type StickerContent,
} from './shareSticker'

it('formata o tempo da figurinha', () => {
  expect(formatWorkoutMinutes(45)).toBe('45 min')
  expect(formatWorkoutMinutes(70)).toBe('1h 10m')
  expect(formatWorkoutMinutes(60)).toBe('1h')
  expect(formatWorkoutMinutes(0)).toBe('')
  expect(formatWorkoutMinutes(-5)).toBe('')
})

it('lista horário, tempo e chips do resumo', () => {
  expect(stickerContent({ time: '18:00', minutes: 70, chips: ['snatch', ' corda '] })).toEqual({
    timeLabel: 'Horário',
    time: '18:00',
    durationLabel: 'Tempo',
    duration: '1h 10m',
    chips: ['snatch', 'corda'],
    brand: 'SANTÉ',
  })
  expect(stickerContent({ time: '07:00', minutes: 45, chips: ['  '] })).toEqual({
    timeLabel: 'Horário',
    time: '07:00',
    durationLabel: 'Tempo',
    duration: '45 min',
    chips: [],
    brand: 'SANTÉ',
  })
  expect(stickerContent({ time: '18:00', minutes: 0, chips: ['snatch'] })).toBeNull()
  expect(stickerContent({ time: '  ', minutes: 45, chips: [] })).toBeNull()
})

it('nomeia o arquivo com a data da aula', () => {
  expect(stickerFilename('2026-11-03')).toBe('sante-treino-2026-11-03.png')
})

it('desenha horário, tempo, chips e a marca em branco, sem pintar o fundo', () => {
  const content: StickerContent = {
    timeLabel: 'Horário',
    time: '18:00',
    durationLabel: 'Tempo',
    duration: '1h 10m',
    chips: ['snatch', 'corda'],
    brand: 'SANTÉ',
  }
  const drawn: string[] = []
  let strokes = 0
  let filled = false
  const ctx = {
    font: '',
    fillStyle: '',
    strokeStyle: '',
    shadowColor: '',
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    textBaseline: 'top',
    textAlign: 'left',
    lineWidth: 1,
    measureText: (text: string) => ({ width: text.length * 18 }),
    fillText: (text: string) => drawn.push(text),
    beginPath: () => {},
    roundRect: () => {},
    save: () => {},
    restore: () => {},
    stroke: () => {
      strokes += 1
    },
    clearRect: () => {},
    fillRect: () => {
      filled = true
    },
    setTransform: () => {},
  }
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ctx,
  } as unknown as HTMLCanvasElement

  drawShareSticker(canvas, content)

  const pieces = ['HORÁRIO', '18:00', 'TEMPO', '1h 10m', 'snatch', 'corda', 'SANTÉ']
  expect(drawn.join('')).toBe(pieces.map((piece) => piece + piece).join(''))
  expect(strokes).toBe(4)
  expect(ctx.fillStyle).toBe('#ffffff')
  expect(ctx.strokeStyle).toBe('#ffffff')
  expect(filled).toBe(false)
  expect(canvas.width).toBe(1800)
  expect(canvas.height).toBeGreaterThan(0)
})
