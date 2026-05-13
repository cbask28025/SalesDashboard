'use client'

import { useMemo, useState, useTransition } from 'react'
import { Plus, X, Trash2, Send, Mail, CircleArrowRight } from 'lucide-react'
import { SAMPLE_LEAD_FOR_PREVIEW } from '../../../lib/email/templates'
import {
  createTemplate, updateTemplate, deleteTemplate, testSendTemplate,
} from './actions'

const MAX = 5
const MERGE_TAGS = ['first_name', 'last_name', 'district_name', 'state', 'title', 'sender_name']

function renderPreview(html, firstName) {
  const vars = {
    ...SAMPLE_LEAD_FOR_PREVIEW,
    first_name: firstName || SAMPLE_LEAD_FOR_PREVIEW.first_name,
    sender_name: 'Dad',
  }
  return (html || '').replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? '')
}

export default function PipelineEditor({ initialTemplates }) {
  const [templates, setTemplates] = useState(initialTemplates)
  const [selectedId, setSelectedId] = useState(initialTemplates[0]?.id || null)
  const [feedback, setFeedback] = useState(null)
  const [isPending, startTransition] = useTransition()

  const selected = useMemo(() => templates.find((t) => t.id === selectedId) || null, [templates, selectedId])
  const atLimit = templates.length >= MAX

  function patch(id, partial) {
    setTemplates((prev) => prev.map((t) => t.id === id ? { ...t, ...partial } : t))
  }

  function addAfter(afterId) {
    if (atLimit) {
      setFeedback({ type: 'err', message: `Pipeline is full (${MAX} max). Delete a step before adding.` })
      return
    }
    startTransition(async () => {
      const res = await createTemplate({ insertAfterId: afterId })
      if (!res.ok) return setFeedback({ type: 'err', message: res.error })
      const next = [...templates, res.template].sort((a, b) => a.position - b.position)
      setTemplates(next)
      setSelectedId(res.template.id)
      setFeedback({ type: 'ok', message: 'Step added — edit on the right' })
    })
  }

  function save(id) {
    const t = templates.find((x) => x.id === id)
    if (!t) return
    startTransition(async () => {
      const res = await updateTemplate(id, {
        name: t.name,
        subject_template: t.subject_template,
        body_template: t.body_template,
        delay_days: t.delay_days,
      })
      if (!res.ok) return setFeedback({ type: 'err', message: res.error })
      setFeedback({ type: 'ok', message: `Saved "${t.name}"` })
    })
  }

  function remove(id) {
    if (!confirm('Delete this step from the pipeline? Leads currently between this step and the next will skip it.')) return
    startTransition(async () => {
      const res = await deleteTemplate(id)
      if (!res.ok) return setFeedback({ type: 'err', message: res.error })
      const next = templates.filter((t) => t.id !== id)
      setTemplates(next)
      setSelectedId(next[0]?.id || null)
      setFeedback({ type: 'ok', message: 'Step removed' })
    })
  }

  return (
    <div className="pipeline-shell">
      {feedback && (
        <div className={`leads-feedback is-${feedback.type}`}>
          {feedback.message}
          <button onClick={() => setFeedback(null)}><X size={13} /></button>
        </div>
      )}

      <PipelineVisualizer
        templates={templates}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onAddAfter={addAfter}
        atLimit={atLimit}
      />

      {selected ? (
        <TemplateEditor
          key={selected.id}
          template={selected}
          isPending={isPending}
          onPatch={(p) => patch(selected.id, p)}
          onSave={() => save(selected.id)}
          onDelete={() => remove(selected.id)}
          onFeedback={setFeedback}
        />
      ) : (
        <div className="pipeline-empty">
          No templates yet. Click the <Plus size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> in the pipeline above to add the first email.
        </div>
      )}
    </div>
  )
}

function PipelineVisualizer({ templates, selectedId, onSelect, onAddAfter, atLimit }) {
  return (
    <div className="pipeline-visualizer">
      <div className="pipeline-node pipeline-node-cap">
        <CircleArrowRight size={16} />
        <span>Start</span>
      </div>

      <PlusGap onAdd={() => onAddAfter(null)} disabled={atLimit} />

      {templates.map((t, i) => (
        <div key={t.id} className="pipeline-step-wrap">
          <button
            type="button"
            className={`pipeline-node pipeline-node-step${selectedId === t.id ? ' is-selected' : ''}`}
            onClick={() => onSelect(t.id)}
          >
            <Mail size={14} />
            <strong>{t.name}</strong>
            <span className="pipeline-node-delay">{t.delay_days === 0 ? 'on entry' : `+${t.delay_days}d`}</span>
          </button>
          <PlusGap onAdd={() => onAddAfter(t.id)} disabled={atLimit} />
        </div>
      ))}

      <div className="pipeline-node pipeline-node-cap">
        <span>End</span>
      </div>
    </div>
  )
}

function PlusGap({ onAdd, disabled }) {
  return (
    <button
      type="button"
      className="pipeline-plus"
      onClick={onAdd}
      disabled={disabled}
      aria-label="Add email step here"
    >
      <Plus size={14} />
    </button>
  )
}

function TemplateEditor({ template, onPatch, onSave, onDelete, onFeedback, isPending }) {
  const [previewFirstName, setPreviewFirstName] = useState('Sarah')
  const [testEmail, setTestEmail] = useState('')
  const [testName, setTestName] = useState('Sarah')

  function insertMergeTag(tag) {
    const tagStr = `{${tag}}`
    const textarea = document.getElementById('pipeline-body-editor')
    if (!textarea) {
      onPatch({ body_template: (template.body_template || '') + tagStr })
      return
    }
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const body = template.body_template || ''
    const next = body.slice(0, start) + tagStr + body.slice(end)
    onPatch({ body_template: next })
    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(start + tagStr.length, start + tagStr.length)
    }, 0)
  }

  function doTestSend() {
    if (!testEmail.trim()) return onFeedback({ type: 'err', message: 'Enter an email for the test send' })
    onFeedback({ type: 'ok', message: 'Sending test…' })
    testSendTemplate({ templateId: template.id, toEmail: testEmail.trim(), firstName: testName.trim() })
      .then((res) => {
        if (res.ok) onFeedback({ type: 'ok', message: `Test sent to ${res.sentTo}` })
        else onFeedback({ type: 'err', message: res.error || 'Test send failed' })
      })
  }

  const previewSubject = (template.subject_template || '').replace(/\{(\w+)\}/g, (_, key) => {
    const vars = { ...SAMPLE_LEAD_FOR_PREVIEW, first_name: previewFirstName || 'Sarah', sender_name: 'Dad' }
    return vars[key] ?? ''
  })
  const previewBody = renderPreview(template.body_template, previewFirstName)

  return (
    <div className="pipeline-editor">
      <div className="pipeline-editor-fields">
        <div className="pipeline-editor-row">
          <label>
            Step name
            <input
              type="text"
              value={template.name}
              onChange={(e) => onPatch({ name: e.target.value })}
            />
          </label>
          <label>
            Send X days after previous email
            <input
              type="number"
              min={0}
              max={60}
              value={template.delay_days}
              onChange={(e) => onPatch({ delay_days: parseInt(e.target.value || '0', 10) })}
            />
          </label>
        </div>

        <label className="pipeline-editor-full">
          Subject
          <input
            type="text"
            value={template.subject_template}
            onChange={(e) => onPatch({ subject_template: e.target.value })}
          />
        </label>

        <div className="pipeline-editor-merge-tags">
          <span>Insert merge tag:</span>
          {MERGE_TAGS.map((tag) => (
            <button key={tag} type="button" onClick={() => insertMergeTag(tag)}>
              {'{'}{tag}{'}'}
            </button>
          ))}
        </div>

        <label className="pipeline-editor-full">
          Body (HTML)
          <textarea
            id="pipeline-body-editor"
            rows={14}
            spellCheck={false}
            value={template.body_template}
            onChange={(e) => onPatch({ body_template: e.target.value })}
          />
        </label>

        <div className="pipeline-editor-actions">
          <button className="upload-btn-primary" onClick={onSave} disabled={isPending}>
            {isPending ? 'Saving…' : 'Save changes'}
          </button>
          <button className="upload-btn-secondary pipeline-danger" onClick={onDelete} disabled={isPending}>
            <Trash2 size={13} /> Delete step
          </button>
        </div>
      </div>

      <div className="pipeline-preview">
        <div className="pipeline-preview-header">
          <h4>Preview</h4>
          <label>
            Preview as:
            <input
              type="text"
              value={previewFirstName}
              onChange={(e) => setPreviewFirstName(e.target.value)}
              placeholder="First name"
            />
          </label>
        </div>

        <div className="pipeline-preview-meta">
          <div><strong>To:</strong> {previewFirstName || 'Sarah'} Johnson &lt;sarah.j@atlantapublic.org&gt;</div>
          <div><strong>Subject:</strong> {previewSubject}</div>
        </div>

        <iframe
          className="pipeline-preview-iframe"
          title="Email preview"
          srcDoc={previewBody}
          sandbox=""
        />

        <div className="pipeline-test-send">
          <h5>Send a test copy</h5>
          <p>Sends to the address below without tracking pixel or click rewriting — so you can validate the look + merge tags + that real links open correctly.</p>
          <div className="pipeline-test-row">
            <input
              type="text"
              placeholder="Your name (used as {first_name})"
              value={testName}
              onChange={(e) => setTestName(e.target.value)}
            />
            <input
              type="email"
              placeholder="your-email@example.com"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
            />
            <button className="upload-btn-primary" onClick={doTestSend} disabled={isPending || !testEmail}>
              <Send size={13} /> Test send
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
