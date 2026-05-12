'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '../../../lib/supabase/server'

const VALID_STATUSES = new Set(['suggested', 'todo', 'done'])

export async function moveTask(taskId, newStatus) {
  if (!VALID_STATUSES.has(newStatus)) return { ok: false, error: 'Invalid status' }
  const supabase = createClient()
  const patch = { status: newStatus }
  if (newStatus === 'done') patch.completed_at = new Date().toISOString()
  else if (newStatus === 'todo') patch.completed_at = null
  const { error } = await supabase.from('v2_tasks').update(patch).eq('id', taskId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/tasks')
  return { ok: true }
}

export async function dismissTask(taskId) {
  const supabase = createClient()
  const { error } = await supabase
    .from('v2_tasks')
    .delete()
    .eq('id', taskId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/tasks')
  return { ok: true }
}

export async function createTask({ title, description, due_date, lead_id }) {
  if (!title?.trim()) return { ok: false, error: 'Title required' }
  const supabase = createClient()
  const { data, error } = await supabase
    .from('v2_tasks')
    .insert({
      title: title.trim(),
      description: description?.trim() || null,
      due_date: due_date || null,
      lead_id: lead_id || null,
      status: 'todo',
      source: 'manual',
    })
    .select()
    .single()
  if (error) return { ok: false, error: error.message }
  revalidatePath('/tasks')
  return { ok: true, task: data }
}

export async function updateTask(taskId, patch) {
  const allowed = {}
  if (typeof patch.title === 'string') allowed.title = patch.title.trim()
  if ('description' in patch) allowed.description = patch.description?.trim() || null
  if ('due_date' in patch) allowed.due_date = patch.due_date || null
  const supabase = createClient()
  const { error } = await supabase.from('v2_tasks').update(allowed).eq('id', taskId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/tasks')
  return { ok: true }
}
