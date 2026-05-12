'use client'

import { useState, useRef, useTransition } from 'react'
import Papa from 'papaparse'
import { UploadCloud, X, FileText, CheckCircle2, AlertCircle } from 'lucide-react'
import { autoMap, applyMapping, TARGET_FIELDS } from '../../../lib/csv/auto-map'
import { commitImport } from './actions'

const FIELD_LABELS = {
  email: 'Email',
  first_name: 'First Name',
  last_name: 'Last Name',
  phone: 'Phone',
  title: 'Title',
  district_name: 'District / School',
  state: 'State',
}

export default function UploadForm() {
  const [dragActive, setDragActive] = useState(false)
  const [file, setFile] = useState(null)
  const [headers, setHeaders] = useState([])
  const [rows, setRows] = useState([])
  const [mapping, setMapping] = useState({})
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [isPending, startTransition] = useTransition()
  const fileInputRef = useRef(null)

  async function handleFile(f) {
    setError(null)
    setResult(null)
    if (!f.name.toLowerCase().endsWith('.csv')) {
      setError('Please upload a .csv file')
      return
    }
    setFile(f)
    Papa.parse(f, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
      complete: (parsed) => {
        const hdrs = parsed.meta.fields || []
        const data = parsed.data || []
        setHeaders(hdrs)
        setRows(data)
        setMapping(autoMap(hdrs, data))
      },
      error: (err) => setError('Parse failed: ' + err.message),
    })
  }

  function setMappingFor(field, column) {
    setMapping((prev) => ({
      ...prev,
      [field]: { column: column || null, confidence: prev[field]?.confidence ?? 0 },
    }))
  }

  function reset() {
    setFile(null)
    setHeaders([])
    setRows([])
    setMapping({})
    setResult(null)
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function submit() {
    if (!file) return
    if (!mapping.email?.column) {
      setError('Email column must be mapped before importing')
      return
    }
    const mapped = applyMapping(rows, mapping)
    startTransition(async () => {
      const res = await commitImport({ filename: file.name, rows: mapped })
      if (!res.ok) setError(res.error || 'Import failed')
      else setResult(res)
    })
  }

  if (result) {
    return (
      <div className="upload-result-card">
        <div className="upload-result-icon">
          <CheckCircle2 size={36} strokeWidth={1.5} />
        </div>
        <h3>Import complete</h3>
        <div className="upload-result-stats">
          <div>
            <strong>{result.added}</strong>
            <span>added</span>
          </div>
          <div>
            <strong>{result.duplicates}</strong>
            <span>duplicates</span>
          </div>
          <div>
            <strong>{result.invalid}</strong>
            <span>invalid</span>
          </div>
        </div>
        <button className="upload-btn-primary" onClick={reset}>
          Upload another
        </button>
      </div>
    )
  }

  return (
    <div className="upload-flow">
      {!file && (
        <div
          className={`upload-zone${dragActive ? ' is-active' : ''}`}
          onDragEnter={(e) => { e.preventDefault(); setDragActive(true) }}
          onDragLeave={(e) => { e.preventDefault(); setDragActive(false) }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            setDragActive(false)
            if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0])
          }}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            style={{ display: 'none' }}
            onChange={(e) => e.target.files[0] && handleFile(e.target.files[0])}
          />
          <UploadCloud size={36} strokeWidth={1.5} />
          <p className="upload-zone-title">Drag & drop a CSV here</p>
          <p className="upload-zone-sub">or click to browse</p>
        </div>
      )}

      {error && (
        <div className="upload-error">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {file && rows.length > 0 && (
        <>
          <div className="upload-file-row">
            <div className="upload-file-info">
              <FileText size={18} />
              <strong>{file.name}</strong>
              <span className="upload-row-count">{rows.length} rows · {headers.length} columns</span>
            </div>
            <button className="upload-icon-btn" onClick={reset} aria-label="Clear">
              <X size={16} />
            </button>
          </div>

          <section className="upload-section">
            <h3>Column mapping</h3>
            <p className="upload-section-sub">
              We auto-detected columns by value pattern. Adjust any that look wrong.
            </p>
            <div className="upload-mapping-grid">
              {TARGET_FIELDS.map((field) => {
                const m = mapping[field] || {}
                return (
                  <label key={field} className="upload-mapping-field">
                    <span className="upload-mapping-label">
                      {FIELD_LABELS[field]}
                      {field === 'email' && <em> required</em>}
                    </span>
                    <select
                      value={m.column || ''}
                      onChange={(e) => setMappingFor(field, e.target.value)}
                    >
                      <option value="">— none —</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                    {m.column && m.confidence > 0 && (
                      <span className="upload-mapping-confidence">
                        {Math.round(m.confidence * 100)}% match
                      </span>
                    )}
                  </label>
                )
              })}
            </div>
          </section>

          <section className="upload-section">
            <h3>Preview (first 5 rows after mapping)</h3>
            <div className="upload-preview-table-wrap">
              <table className="upload-preview-table">
                <thead>
                  <tr>
                    {TARGET_FIELDS.map((f) => (
                      <th key={f}>{FIELD_LABELS[f]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {applyMapping(rows.slice(0, 5), mapping).map((r, i) => (
                    <tr key={i}>
                      {TARGET_FIELDS.map((f) => (
                        <td key={f}>{r[f] || <span className="upload-cell-empty">—</span>}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="upload-actions">
            <button
              className="upload-btn-primary"
              onClick={submit}
              disabled={isPending || !mapping.email?.column}
            >
              {isPending ? 'Importing…' : `Import ${rows.length} leads`}
            </button>
            <button className="upload-btn-secondary" onClick={reset} disabled={isPending}>
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  )
}
