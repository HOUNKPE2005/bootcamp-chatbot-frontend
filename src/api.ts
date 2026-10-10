// Thin typed wrappers around the FastAPI backend (proxied under /api by Vite).

export type Role = 'user' | 'assistant' | 'system-notification' | 'note'

export interface ConversationSummary {
  id: number
  created_at: string
  preview: string | null
}

export interface Message {
  seq: number
  role: Role
  content: string
  created_at: string
}

async function errorFrom(response: Response): Promise<Error> {
  // FastAPI errors look like {"detail": "..."}.
  const body = await response.json().catch(() => null)
  const detail = typeof body?.detail === 'string' ? body.detail : null
  return new Error(detail ?? `Erreur ${response.status}`)
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`/api${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    })
  } catch {
    throw new Error('Impossible de joindre le serveur.')
  }
  if (!response.ok) throw await errorFrom(response)
  return response.json() as Promise<T>
}

export function listConversations(): Promise<ConversationSummary[]> {
  return request('/conversations')
}

export async function createConversation(): Promise<number> {
  const { conversation_id } = await request<{ conversation_id: number }>('/conversations', {
    method: 'POST',
  })
  return conversation_id
}

export function getMessages(conversationId: number): Promise<Message[]> {
  return request(`/conversations/${conversationId}/messages`)
}

export function getModels(): Promise<string[]> {
  return request('/models')
}

export function addNote(conversationId: number, content: string): Promise<Message> {
  return request(`/conversations/${conversationId}/notes`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  })
}

interface StreamEvent {
  content?: string
  error?: string
  done?: boolean
  notification?: string | null
}

// Sends a message and reads the streamed answer (SSE lines "data: {...}").
// fetch + getReader() because EventSource can't do POST.
export async function streamMessage(
  conversationId: number,
  message: string,
  model: string,
  onDelta: (text: string) => void,
): Promise<{ notification: string | null }> {
  let response: Response
  try {
    response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversation_id: conversationId, message, model }),
    })
  } catch {
    throw new Error('Impossible de joindre le serveur.')
  }
  if (!response.ok) throw await errorFrom(response)
  if (!response.body) throw new Error('RÃ©ponse vide du serveur.')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let notification: string | null = null
  let done = false

  try {
    while (true) {
      const { value, done: finished } = await reader.read()
      if (finished) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? '' // the last piece may be an incomplete line
      for (const line of lines) {
        if (!line.startsWith('data:')) continue
        const evt = JSON.parse(line.slice(5).trim()) as StreamEvent
        if (evt.error) throw new Error(evt.error)
        if (evt.content) onDelta(evt.content)
        if (evt.done) {
          notification = evt.notification ?? null
          done = true
        }
      }
    }
  } catch (err) {
    if (err instanceof TypeError) throw new Error('La connexion a Ã©tÃ© interrompue.')
    throw err
  } finally {
    reader.cancel().catch(() => {})
  }
  if (!done) throw new Error('La rÃ©ponse a Ã©tÃ© interrompue.')
  return { notification }
}