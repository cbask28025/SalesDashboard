'use client'

import { useState, useMemo, useTransition } from 'react'
import { Plus, X, Check, Trash2, ArrowRight } from 'lucide-react'
import {
  DndContext, useSensor, useSensors, PointerSensor, KeyboardSensor, closestCorners,
} from '@dnd-kit/core'
import { useDroppable, useDraggable } from '@dnd-kit/core'
import { format } from 'date-fns'
import { moveTask, dismissTask, createTask, updateTask } from './actions'
import { fullName } from '../../../lib/format'

const COLUMNS = [
  { id: 'suggested', label: 'Suggested', help: 'AI-proposed — approve to keep' },
  { id: 'todo', label: 'To Do' },
  { id: 'done', label: 'Done' },
]

const SOURCE_LABEL = {
  manual: 'Manual',
  ai_reply: 'AI · from reply',
  ai_chat: 'AI · from chat',
  call_outcome: 'Call outcome',
}

export default function TaskBoard({ initialTasks }) {
  const [tasks, setTasks] = useState(initialTasks)
  const [showNew, setShowNew] = useState(false)
  const [collapsedDone, setCollapsedDone] = useState(true)
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor))

  const byColumn = useMemo(() => {
    const out = { suggested: [], todo: [], done: [] }
    for (const t of tasks) {
      if (out[t.status]) out[t.status].push(t)
    }
    return out
  }, [tasks])

  function handleDragEnd(event) {
    const { active, over } = event
    if (!over) return
    const taskId = active.id
    const newStatus = over.id
    if (!['suggested', 'todo', 'done'].includes(newStatus)) return

    const task = tasks.find((t) => t.id === taskId)
    if (!task || task.status === newStatus) return

    setTasks((prev) => prev.map((t) => t.id === taskId ? {
      ...t,
      status: newStatus,
      completed_at: newStatus === 'done' ? new Date().toISOString() : null,
    } : t))

    startTransition(async () => {
      const res = await moveTask(taskId, newStatus)
      if (!res.ok) setFeedback({ type: 'err', message: res.error })
    })
  }

  function dismiss(taskId) {
    if (!confirm('Delete this task?')) return
    setTasks((prev) => prev.filter((t) => t.id !== taskId))
    startTransition(async () => {
      const res = await dismissTask(taskId)
      if (!res.ok) setFeedback({ type: 'err', message: res.error })
    })
  }

  function quickAction(taskId, newStatus) {
    setTasks((prev) => prev.map((t) => t.id === taskId ? {
      ...t,
      status: newStatus,
      completed_at: newStatus === 'done' ? new Date().toISOString() : null,
    } : t))
    startTransition(async () => {
      const res = await moveTask(taskId, newStatus)
      if (!res.ok) setFeedback({ type: 'err', message: res.error })
    })
  }

  return (
    <div className="task-board-shell">
      <div className="task-board-controls">
        <button className="task-add-btn" onClick={() => setShowNew(true)}>
          <Plus size={14} /> New task
        </button>
        <label className="task-board-toggle">
          <input
            type="checkbox"
            checked={!collapsedDone}
            onChange={(e) => setCollapsedDone(!e.target.checked)}
          />
          Show Done column
        </label>
      </div>

      {feedback && <div className={`leads-feedback is-${feedback.type}`}>{feedback.message}</div>}

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
        <div className="task-board">
          {COLUMNS.filter((c) => !(c.id === 'done' && collapsedDone)).map((col) => (
            <TaskColumn key={col.id} column={col} tasks={byColumn[col.id]}>
              {byColumn[col.id].map((t) => (
                <TaskCard
                  key={t.id}
                  task={t}
                  onAction={quickAction}
                  onDelete={() => dismiss(t.id)}
                  isPending={isPending}
                />
              ))}
            </TaskColumn>
          ))}
          {collapsedDone && (
            <button className="task-done-collapsed" onClick={() => setCollapsedDone(false)}>
              Done ({byColumn.done.length}) <ArrowRight size={14} />
            </button>
          )}
        </div>
      </DndContext>

      {showNew && (
        <NewTaskModal
          onClose={() => setShowNew(false)}
          onCreated={(task) => {
            setTasks((prev) => [{ ...task, v2_leads: null }, ...prev])
            setShowNew(false)
          }}
        />
      )}
    </div>
  )
}

function TaskColumn({ column, tasks, children }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id })
  return (
    <div ref={setNodeRef} className={`task-column${isOver ? ' is-over' : ''}`}>
      <header>
        <h4>{column.label}</h4>
        <span className="task-column-count">{tasks.length}</span>
      </header>
      {column.help && <p className="task-column-help">{column.help}</p>}
      <div className="task-column-body">
        {children}
        {tasks.length === 0 && <div className="task-column-empty">Empty</div>}
      </div>
    </div>
  )
}

function TaskCard({ task, onAction, onDelete, isPending }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id })
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, opacity: isDragging ? 0.6 : 1 }
    : undefined

  const lead = task.v2_leads
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="task-card">
      <header className="task-card-header">
        <strong>{task.title}</strong>
        {task.source && <span className="task-source">{SOURCE_LABEL[task.source] || task.source}</span>}
      </header>
      {lead && (
        <p className="task-card-lead">{fullName(lead)}{lead.district_name ? ` · ${lead.district_name}` : ''}</p>
      )}
      {task.description && <p className="task-card-desc">{task.description}</p>}
      <footer className="task-card-footer">
        {task.due_date && <span>Due {format(new Date(task.due_date), 'MMM d')}</span>}
        <div className="task-card-actions">
          {task.status === 'suggested' && (
            <>
              <button onPointerDown={(e) => e.stopPropagation()} onClick={() => onAction(task.id, 'todo')} disabled={isPending} title="Approve">
                <Check size={13} />
              </button>
              <button onPointerDown={(e) => e.stopPropagation()} onClick={onDelete} disabled={isPending} title="Dismiss">
                <X size={13} />
              </button>
            </>
          )}
          {task.status === 'todo' && (
            <>
              <button onPointerDown={(e) => e.stopPropagation()} onClick={() => onAction(task.id, 'done')} disabled={isPending} title="Mark done">
                <Check size={13} />
              </button>
              <button onPointerDown={(e) => e.stopPropagation()} onClick={onDelete} disabled={isPending} title="Delete">
                <Trash2 size={13} />
              </button>
            </>
          )}
          {task.status === 'done' && (
            <button onPointerDown={(e) => e.stopPropagation()} onClick={onDelete} disabled={isPending} title="Delete">
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </footer>
    </div>
  )
}

function NewTaskModal({ onClose, onCreated }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [error, setError] = useState(null)
  const [isPending, startTransition] = useTransition()

  function submit() {
    if (!title.trim()) return setError('Title required')
    startTransition(async () => {
      const res = await createTask({ title, description, due_date: dueDate || null })
      if (!res.ok) return setError(res.error || 'Failed')
      onCreated(res.task)
    })
  }

  return (
    <div className="task-modal-overlay" onClick={onClose}>
      <div className="task-modal" onClick={(e) => e.stopPropagation()}>
        <header>
          <h3>New task</h3>
          <button onClick={onClose}><X size={16} /></button>
        </header>
        <label>Title<input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus /></label>
        <label>Description<textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} /></label>
        <label>Due date<input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></label>
        {error && <div className="leads-feedback is-err">{error}</div>}
        <div className="task-modal-actions">
          <button className="upload-btn-primary" onClick={submit} disabled={isPending}>{isPending ? 'Creating…' : 'Create'}</button>
          <button className="upload-btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  )
}
