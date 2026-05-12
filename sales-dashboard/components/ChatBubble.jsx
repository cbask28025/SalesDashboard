'use client'

import { useEffect, useRef, useState } from 'react'
import { MessageCircle, Send, X, Check } from 'lucide-react'

function newSessionId() {
  return crypto.randomUUID()
}

export default function ChatBubble() {
  const [open, setOpen] = useState(false)
  const [sessionId, setSessionId] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [pendingConfirmations, setPendingConfirmations] = useState([])
  const [autoResults, setAutoResults] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const scrollRef = useRef(null)

  useEffect(() => {
    if (open && !sessionId) {
      const sid = localStorage.getItem('v2-chat-session') || newSessionId()
      localStorage.setItem('v2-chat-session', sid)
      setSessionId(sid)
    }
  }, [open, sessionId])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, pendingConfirmations])

  async function sendMessage() {
    const text = input.trim()
    if (!text || busy) return
    setMessages((m) => [...m, { role: 'user', text }])
    setInput('')
    setError(null)
    setBusy(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, userMessage: text }),
      })
      const json = await res.json()
      if (!json.ok) { setError(json.error || 'Chat failed'); return }
      if (json.text) setMessages((m) => [...m, { role: 'assistant', text: json.text }])
      if (Array.isArray(json.pendingConfirmations) && json.pendingConfirmations.length > 0) {
        setPendingConfirmations(json.pendingConfirmations)
        setAutoResults(json.autoResults || [])
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function confirmAction(item, approved) {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/chat/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...item, approved }),
      })
      const json = await res.json()
      if (!json.ok) { setError(json.error || 'Confirm failed'); return }

      // Remove this confirmation; once all are resolved, send tool_results back.
      const remaining = pendingConfirmations.filter((p) => p.tool_use_id !== item.tool_use_id)
      const accumulated = [...autoResults, json.toolResult]
      setPendingConfirmations(remaining)
      setAutoResults(accumulated)

      if (remaining.length === 0) {
        const finalRes = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, toolResults: accumulated }),
        })
        const finalJson = await finalRes.json()
        if (finalJson.ok && finalJson.text) {
          setMessages((m) => [...m, { role: 'assistant', text: finalJson.text }])
        }
        setAutoResults([])
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  function newChat() {
    const sid = newSessionId()
    localStorage.setItem('v2-chat-session', sid)
    setSessionId(sid)
    setMessages([])
    setPendingConfirmations([])
    setAutoResults([])
  }

  if (!open) {
    return (
      <button
        type="button"
        className="chat-bubble-launcher"
        aria-label="Open assistant"
        onClick={() => setOpen(true)}
      >
        <MessageCircle size={22} strokeWidth={1.75} />
      </button>
    )
  }

  return (
    <div className="chat-bubble-panel" role="dialog" aria-label="AI assistant">
      <div className="chat-bubble-header">
        <strong>Assistant</strong>
        <div className="chat-bubble-controls">
          <button onClick={newChat} title="New chat">New</button>
          <button onClick={() => setOpen(false)} aria-label="Close"><X size={16} /></button>
        </div>
      </div>
      <div ref={scrollRef} className="chat-bubble-body">
        {messages.length === 0 && (
          <p className="chat-bubble-placeholder">
            Ask things like "Show my hot leads in Texas" or "Pause Sarah Johnson's sequence." Actions
            always confirm before they fire.
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`chat-msg is-${m.role}`}>
            {m.text}
          </div>
        ))}
        {pendingConfirmations.map((p) => (
          <div key={p.tool_use_id} className="chat-confirm">
            <strong>Confirm:</strong> {p.summary}
            <div className="chat-confirm-actions">
              <button onClick={() => confirmAction(p, true)} disabled={busy}>
                <Check size={13} /> Yes
              </button>
              <button onClick={() => confirmAction(p, false)} disabled={busy} className="chat-confirm-cancel">
                Cancel
              </button>
            </div>
          </div>
        ))}
        {error && <div className="chat-msg is-error">{error}</div>}
      </div>
      <div className="chat-bubble-input">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
          placeholder="Ask the assistant…"
          disabled={busy}
        />
        <button onClick={sendMessage} disabled={busy || !input.trim()} aria-label="Send">
          <Send size={16} />
        </button>
      </div>
    </div>
  )
}
