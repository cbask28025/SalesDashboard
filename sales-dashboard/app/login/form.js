'use client'

import { useState } from 'react'

export default function LoginForm({ action, error }) {
  const [submitting, setSubmitting] = useState(false)

  return (
    <div className="login-shell">
      <form
        className="login-card"
        action={action}
        onSubmit={() => setSubmitting(true)}
      >
        <div className="login-brand">
          <h1>Choosing the Best</h1>
          <p>Sales Dashboard</p>
        </div>

        {error && <div className="login-error">{decodeURIComponent(error)}</div>}

        <label>
          Email
          <input name="email" type="email" required autoComplete="email" autoFocus />
        </label>

        <label>
          Password
          <input name="password" type="password" required autoComplete="current-password" />
        </label>

        <button type="submit" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
