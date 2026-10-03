import { useEffect, useRef, useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import type { Session, Student } from '../types'
import { StudentCard } from './StudentCard'

interface TimeSlotProps {
  id: string
  time: string
  dayLabel: string
  sessions: Session[]
  studentsById: Map<number, Student>
  students: Student[]
  isHourMark: boolean
  onAddStudent: (studentId: number) => void
  onRemoveStudent: (sessionId: number) => void
}

export function TimeSlot({
  id,
  time,
  dayLabel,
  sessions,
  studentsById,
  students,
  isHourMark,
  onAddStudent,
  onRemoveStudent,
}: TimeSlotProps) {
  const { setNodeRef, isOver } = useDroppable({ id })
  const [isAdding, setIsAdding] = useState(false)
  const [studentId, setStudentId] = useState('')
  const selectRef = useRef<HTMLSelectElement>(null)

  useEffect(() => {
    if (isAdding) selectRef.current?.focus()
  }, [isAdding])

  function submit() {
    if (!studentId) return
    onAddStudent(Number(studentId))
    setStudentId('')
    setIsAdding(false)
  }

  function cancel() {
    setStudentId('')
    setIsAdding(false)
  }

  return (
    <div
      ref={setNodeRef}
      className={`time-slot${isOver ? ' time-slot--over' : ''}${isHourMark ? ' time-slot--hour' : ''}${sessions.length > 0 ? ' time-slot--filled' : ''}${isAdding ? ' time-slot--adding' : ''}`}
      data-time={time}
    >
      <div className="time-slot__cards">
        {sessions.map((session) => {
          const student = studentsById.get(session.studentId)
          if (!student) return null
          return (
            <StudentCard
              key={session.id}
              session={session}
              student={student}
              onRemove={onRemoveStudent}
            />
          )
        })}
      </div>

      {isAdding ? (
        <form
          className="add-student"
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <select
            ref={selectRef}
            className="add-student__input"
            value={studentId}
            aria-label={`Adicionar aluno em ${dayLabel} ${time}`}
            onChange={(e) => setStudentId(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') cancel()
            }}
            onBlur={(e) => {
              const next = e.relatedTarget as Node | null
              if (e.currentTarget.form?.contains(next)) return
              cancel()
            }}
          >
            <option value="">Escolher aluno...</option>
            {students.map((student) => (
              <option key={student.id} value={student.id}>
                {student.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="add-student__submit"
            disabled={!studentId}
            onMouseDown={(e) => e.preventDefault()}
          >
            +
          </button>
        </form>
      ) : (
        <button
          type="button"
          className="time-slot__add"
          aria-label={`Adicionar aluno em ${dayLabel} ${time}`}
          onClick={() => setIsAdding(true)}
          disabled={students.length === 0}
          title={students.length === 0 ? 'Cadastre alunos primeiro' : undefined}
        >
          +
        </button>
      )}
    </div>
  )
}
