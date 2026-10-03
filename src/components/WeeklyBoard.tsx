import { useMemo, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  pointerWithin,
  rectIntersection,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import type { DayOfWeek, IntervalMinutes, Session, Student } from '../types'
import { DAYS } from '../types'
import type { SessionInput, SessionUpdate } from '../api/data'
import { generateTimeSlots, parseSlotId, slotId } from '../utils/time'
import { TimeSlot } from './TimeSlot'
import { StudentCard } from './StudentCard'

interface WeeklyBoardProps {
  students: Student[]
  sessions: Session[]
  interval: IntervalMinutes
  visibleDays: DayOfWeek[]
  onCreateSession: (input: SessionInput) => Promise<Session>
  onUpdateSession: (id: number, input: SessionUpdate) => Promise<Session>
  onDeleteSession: (id: number) => Promise<void>
  onError?: (message: string | null) => void
}

const START_HOUR = 6
const END_HOUR = 21

const collisionDetection: CollisionDetection = (args) => {
  const pointerHits = pointerWithin(args)
  if (pointerHits.length > 0) return pointerHits
  return rectIntersection(args)
}

export function WeeklyBoard({
  students,
  sessions,
  interval,
  visibleDays,
  onCreateSession,
  onUpdateSession,
  onDeleteSession,
  onError,
}: WeeklyBoardProps) {
  const [activeId, setActiveId] = useState<number | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  )

  const days = useMemo(
    () => DAYS.filter((day) => visibleDays.includes(day.id)),
    [visibleDays],
  )

  const boardStyle = {
    ['--day-count' as string]: String(days.length),
  }

  const timeSlots = useMemo(
    () => generateTimeSlots(START_HOUR, END_HOUR, interval),
    [interval],
  )

  const studentsById = useMemo(() => {
    const map = new Map<number, Student>()
    for (const student of students) map.set(student.id, student)
    return map
  }, [students])

  const sortedStudents = useMemo(
    () => [...students].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [students],
  )

  const sessionsBySlot = useMemo(() => {
    const map = new Map<string, Session[]>()
    for (const session of sessions) {
      const key = slotId(session.day, session.time)
      const list = map.get(key) ?? []
      list.push(session)
      map.set(key, list)
    }
    return map
  }, [sessions])

  async function handleAddStudent(
    day: DayOfWeek,
    time: string,
    studentId: number,
  ) {
    onError?.(null)
    try {
      await onCreateSession({
        studentId,
        day,
        time,
        durationMinutes: 45,
      })
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Falha ao adicionar aula')
    }
  }

  async function handleRemoveStudent(sessionId: number) {
    onError?.(null)
    try {
      await onDeleteSession(sessionId)
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Falha ao remover aula')
    }
  }

  const activeSession = activeId
    ? (sessions.find((s) => s.id === activeId) ?? null)
    : null
  const activeStudent = activeSession
    ? (studentsById.get(activeSession.studentId) ?? null)
    : null

  function handleDragStart(event: DragStartEvent) {
    setActiveId(Number(event.active.id))
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveId(null)
    const { active, over } = event
    if (!over) return

    const overId = String(over.id)
    const sessionId = Number(active.id)
    if (!Number.isInteger(sessionId) || overId === String(sessionId)) return

    let target = parseSlotId(overId)
    if (!target) {
      const overSessionId = Number(overId)
      const overSession = Number.isInteger(overSessionId)
        ? sessions.find((s) => s.id === overSessionId)
        : undefined
      if (overSession) {
        target = { day: overSession.day, time: overSession.time }
      }
    }
    if (!target) return

    const current = sessions.find((s) => s.id === sessionId)
    if (
      current &&
      current.day === target.day &&
      current.time === target.time
    ) {
      return
    }

    onError?.(null)
    try {
      await onUpdateSession(sessionId, {
        day: target.day as DayOfWeek,
        time: target.time,
      })
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Falha ao mover aula')
    }
  }

  function handleDragCancel() {
    setActiveId(null)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragEnd={(e) => void handleDragEnd(e)}
      onDragCancel={handleDragCancel}
    >
      <div className="weekly-board" style={boardStyle}>
        <div className="weekly-board__header">
          <div className="weekly-board__corner" aria-hidden />
          {days.map((day) => {
            const count = sessions.filter((s) => s.day === day.id).length
            return (
              <div key={day.id} className="weekly-board__day-head">
                <span className="weekly-board__day-label">{day.label}</span>
                <span className="weekly-board__day-count">
                  {count} {count === 1 ? 'aula' : 'aulas'}
                </span>
              </div>
            )
          })}
        </div>

        <div className="weekly-board__body">
          {timeSlots.map((time) => (
            <div
              key={time}
              className={`weekly-board__row${time.endsWith(':00') ? ' weekly-board__row--hour' : ''}`}
            >
              <div
                className={`weekly-board__time-label${time.endsWith(':00') ? ' weekly-board__time-label--hour' : ''}`}
              >
                {time}
              </div>
              {days.map((day) => {
                const id = slotId(day.id, time)
                return (
                  <TimeSlot
                    key={id}
                    id={id}
                    time={time}
                    dayLabel={day.label}
                    sessions={sessionsBySlot.get(id) ?? []}
                    studentsById={studentsById}
                    students={sortedStudents}
                    isHourMark={time.endsWith(':00')}
                    onAddStudent={(studentId) =>
                      void handleAddStudent(day.id, time, studentId)
                    }
                    onRemoveStudent={(sessionId) =>
                      void handleRemoveStudent(sessionId)
                    }
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeSession && activeStudent ? (
          <StudentCard
            session={activeSession}
            student={activeStudent}
            isDraggingOverlay
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
