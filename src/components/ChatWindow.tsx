import { useEffect, useRef, type FormEvent, type KeyboardEvent } from 'react'
import Markdown from 'react-markdown'
import type { Role } from '../api'

export interface ChatMessage {
  role: Role
  content: string
}

interface ChatWindowProps {
  messages: ChatMessage[]
  loading: boolean
  draft: string
  models: string[]
  model: string
  onModelChange: (value: string) => void
  onDraftChange: (value: string) => void
  onSend: () => void
  onNote: () => void
}

export default function ChatWindow({
  messages,
  loading,
  draft,
  models,
  model,
  onModelChange,
  onDraftChange,
  onSend,
  onNote,
}: ChatWindowProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  // Keep the latest message in view (no smooth animation while the answer streams in).
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: loading ? 'auto' : 'smooth' })
  }, [messages, loading])

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!loading && draft.trim()) onSend()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends, Shift+Enter inserts a new line.
    if (event.key === 'Enter' && !event.shiftKey) handleSubmit(event)
  }

  return (
    <section className="chat">
      <div className="messages">
        {messages.length === 0 && !loading && (
          <p className="muted center">Pose ta premiÃ¨re question Ã  Study Buddy.</p>
        )}
        {messages.map((m, i) => {
          if (m.role === 'system-notification') {
            return (
              <div key={i} className="notification">
                {m.content}
              </div>
            )
          }
          if (m.role === 'note') {
            return (
              <div key={i} className="bubble note">
                <span className="note-label">ðŸ“ Note perso Â· non envoyÃ©e Ã  l'IA</span>
                {m.content}
              </div>
            )
          }
          if (m.role === 'assistant') {
            return (
              <div key={i} className={`bubble assistant${m.content ? '' : ' typing'}`}>
                {m.content ? <Markdown>{m.content}</Markdown> : 'â€¦'}
              </div>
            )
          }
          return (
            <div key={i} className="bubble user">
              {m.content}
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>
      <div className="toolbar">
        <label>
          ModÃ¨le :{' '}
          <select value={model} onChange={(e) => onModelChange(e.target.value)} disabled={loading}>
            {models.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <form className="composer" onSubmit={handleSubmit}>
        <textarea
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ã‰cris ton messageâ€¦"
          rows={2}
          disabled={loading}
          autoFocus
        />
        <button type="button" className="secondary" onClick={onNote} disabled={loading || !draft.trim()}>
          Note
        </button>
        <button type="submit" disabled={loading || !draft.trim() || !model}>
          Envoyer
        </button>
      </form>
    </section>
  )
}