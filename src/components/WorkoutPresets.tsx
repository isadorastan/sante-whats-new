import { useState, type FormEvent } from 'react'
import type { WorkoutPresetGroup } from '../utils/workoutPresets'

interface WorkoutPresetsProps {
  groups: WorkoutPresetGroup[]
  onChange: (groups: WorkoutPresetGroup[]) => void
  onInsert: (item: string) => void
}

export function WorkoutPresets({ groups, onChange, onInsert }: WorkoutPresetsProps) {
  const [drafts, setDrafts] = useState<Record<string, string>>({})

  function removeItem(groupId: string, index: number) {
    onChange(
      groups.map((group) =>
        group.id === groupId
          ? { ...group, items: group.items.filter((_, itemIndex) => itemIndex !== index) }
          : group,
      ),
    )
  }

  function addItem(event: FormEvent, groupId: string) {
    event.preventDefault()
    const name = (drafts[groupId] ?? '').trim()
    if (!name) return
    onChange(
      groups.map((group) => {
        if (group.id !== groupId) return group
        const exists = group.items.some((item) => item.toLowerCase() === name.toLowerCase())
        return exists ? group : { ...group, items: [...group.items, name] }
      }),
    )
    setDrafts((current) => ({ ...current, [groupId]: '' }))
  }

  return (
    <div className="workout-presets">
      {groups.map((group) => (
        <section key={group.id} aria-label={group.title}>
          <h3 className="workout-presets__title">{group.title}</h3>
          <div className="workout-presets__items">
            {group.items.map((item, index) => (
              <span key={`${group.id}-${item}`} className="workout-chip">
                <button type="button" onClick={() => onInsert(item)}>
                  {item}
                </button>
                <button
                  type="button"
                  aria-label={`Remover ${item}`}
                  onClick={() => removeItem(group.id, index)}
                >
                  ×
                </button>
              </span>
            ))}
            <form className="workout-presets__add" onSubmit={(event) => addItem(event, group.id)}>
              <input
                className="students-form__input"
                aria-label={`Novo item em ${group.title}`}
                value={drafts[group.id] ?? ''}
                onChange={(event) =>
                  setDrafts((current) => ({ ...current, [group.id]: event.target.value }))
                }
              />
              <button className="btn" type="submit">
                Adicionar
              </button>
            </form>
          </div>
        </section>
      ))}
    </div>
  )
}
