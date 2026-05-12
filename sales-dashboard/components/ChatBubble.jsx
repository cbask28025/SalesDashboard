'use client'

import { useState } from 'react'
import { MessageCircle, X } from 'lucide-react'

export default function ChatBubble() {
  const [open, setOpen] = useState(false)
  // Phase A stub — Claude tool-use chat wiring lands in Phase G.

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
        <button type="button" onClick={() => setOpen(false)} aria-label="Close assistant">
          <X size={16} />
        </button>
      </div>
      <div className="chat-bubble-body">
        <p className="chat-bubble-placeholder">
          The assistant is coming online in a future phase. Soon you'll be able to ask things like
          "Show my top 10 leads to call" or "Pause Sarah Johnson's sequence."
        </p>
      </div>
    </div>
  )
}
