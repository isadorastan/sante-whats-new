import type { CSSProperties, MouseEvent } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import type { Session, Student } from '../types'

interface StudentCardProps {
  session: Session
  student: Student
  isDraggingOverlay?: boolean
  onRemove?: (sessionId: number) => void
}

export function StudentCard({
  session,
  student,
  isDraggingOverlay,
  onRemove,
}: StudentCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: session.id,
      data: { session },
    })

  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging && !isDraggingOverlay ? 0.35 : 1,
    borderLeftColor: student.color,
    ['--card-accent' as string]: student.color,
  }

  function handleRemove(event: MouseEvent) {
    event.preventDefault()
    event.stopPropagation()
    onRemove?.(session.id)
  }

  return (
    <div
      ref={isDraggingOverlay ? undefined : setNodeRef}
      className={`student-card${isDraggingOverlay ? ' student-card--overlay' : ''}${isDragging && !isDraggingOverlay ? ' student-card--ghost' : ''}`}
      style={style}
    >
      <button
        type="button"
        className="student-card__drag"
        aria-label={`Mover ${student.name}`}
        {...(isDraggingOverlay ? {} : { ...listeners, ...attributes })}
      >
        <span className="student-card__name">{student.name}</span>
      </button>
      {!isDraggingOverlay && onRemove ? (
        <button
          type="button"
          className="student-card__remove"
          aria-label={`Remover ${student.name} deste horário`}
          onClick={handleRemove}
          onPointerDown={(e) => e.stopPropagation()}
        >
          ×
        </button>
      ) : null}
    </div>
  )
}
