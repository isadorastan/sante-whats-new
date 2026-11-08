export interface WorkoutPresetGroup {
  id: string
  title: string
  items: string[]
}

export const DEFAULT_WORKOUT_PRESETS: WorkoutPresetGroup[] = [
  {
    id: 'aquecimento',
    title: 'Aquecimento',
    items: [
      'Hollow Hold / Hollow Body',
      'Hollow Rock',
      'Arch Hold / Superman',
      'Arch Rock',
      'Plank (Prancha)',
      'Cat-Cow (Gato-Vaca)',
      'Scapular Pull-ups / Scapular Push-ups',
      'Pass Through',
      "World's Greatest Stretch",
      'Inchworm',
      'Glute Bridge',
      'Bird-Dog',
      'Good Morning',
      'Kip Swings',
    ],
  },
  {
    id: 'formatos',
    title: 'Wods e formatos',
    items: [
      'WOD',
      'AMRAP',
      'EMOM',
      'FOR TIME',
      'TABATA',
      'BUY-IN/CASH-OUT',
      'TIME CAP',
      'RX',
      'SCALED',
    ],
  },
  {
    id: 'lpo',
    title: 'LPO',
    items: ['SNATCH', 'CLEAN', 'JERK', 'CLEAN AND JERK'],
  },
  {
    id: 'modificadores',
    title: 'Modificadores',
    items: ['POWER', 'SQUAT', 'HANG', 'PUSH PRESS', 'PUSH JERK', 'SPLIT JERK'],
  },
  {
    id: 'forca',
    title: 'Força',
    items: [
      'DEADLIFT',
      'BACK SQUAT',
      'FRONT SQUAT',
      'OVERHEAD SQUAT (OHS)',
      'THRUSTER',
      'KETTLEBELL SWING',
      'Dumbbell Snatch / DB Thruster',
    ],
  },
  {
    id: 'ginastica',
    title: 'Ginástica',
    items: [
      'Pull-up',
      'Chest to Bar (C2B)',
      'Toes to Bar (T2B)',
      'Bar Muscle-up',
      'Ring Muscle-up',
      'Handstand Push-up (HSPU)',
      'Handstand Walk (HSW)',
      'Push-up / Diamond Push-up',
      'Pistol',
      'Air Squat',
      'Rope Climb',
      'Burpee',
    ],
  },
  {
    id: 'cardio',
    title: 'Monoestrutural, cardio e condicionamento',
    items: [
      'Double Unders (DU)',
      'Single Unders (SU)',
      'Rowing (Row)',
      'Assault Bike / Echo Bike',
      'Corrida',
      'SkiErg',
      'Box Jump / Box Jump Over',
      'Wall Ball Shot (WBS)',
      'Sled Push / Sled Pull',
    ],
  },
]

const STORAGE_KEY = 'sante-workout-presets-v1'

function isGroup(value: unknown): value is WorkoutPresetGroup {
  if (!value || typeof value !== 'object') return false
  const group = value as WorkoutPresetGroup
  return (
    typeof group.id === 'string' &&
    typeof group.title === 'string' &&
    Array.isArray(group.items) &&
    group.items.every((item) => typeof item === 'string')
  )
}

export function loadWorkoutPresets(): WorkoutPresetGroup[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_WORKOUT_PRESETS
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed) || !parsed.every(isGroup) || parsed.length === 0) {
      return DEFAULT_WORKOUT_PRESETS
    }
    return parsed
  } catch {
    return DEFAULT_WORKOUT_PRESETS
  }
}

export function saveWorkoutPresets(groups: WorkoutPresetGroup[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(groups))
}
