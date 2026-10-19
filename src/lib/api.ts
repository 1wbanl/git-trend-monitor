import type {
  AlertsResponse,
  AlertRule,
  ChatMessage,
  ChatMeta,
  Overview,
  ProjectDetailResponse,
  ProjectsResponse,
  SourcesResponse
} from './types'

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {})
    }
  })
  if (!response.ok) {
    let message = `请求失败（${response.status}）`
    try {
      const body = await response.json()
      if (body?.error) message = body.error
    } catch {
      // Keep the default message when the response is not JSON.
    }
    throw new Error(message)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export interface ProjectQuery {
  query?: string
  category?: string
  language?: string
  tracked?: string
  sort?: string
}

export const api = {
  overview(): Promise<Overview> {
    return request('/api/overview')
  },
  projects(query: ProjectQuery = {}): Promise<ProjectsResponse> {
    const params = new URLSearchParams()
    Object.entries(query).forEach(([key, value]) => {
      if (value && value !== 'all') params.set(key, String(value))
    })
    return request(`/api/projects?${params.toString()}`)
  },
  project(id: string): Promise<ProjectDetailResponse> {
    return request(`/api/projects/${encodeURIComponent(id)}`)
  },
  updateProject(
    id: string,
    payload: { tracked?: boolean; status?: string | null; tags?: string[]; note?: string }
  ): Promise<{ ok: boolean; project: ProjectDetailResponse['project'] }> {
    return request(`/api/projects/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    })
  },
  alerts(): Promise<AlertsResponse> {
    return request('/api/alerts')
  },
  createAlert(payload: {
    name: string
    description: string
    metric: string
    operator: string
    threshold: number
    window: string
    scope: string
    channels: string[]
  }): Promise<{ ok: boolean; rule: AlertRule }> {
    return request('/api/alerts', { method: 'POST', body: JSON.stringify(payload) })
  },
  updateAlert(id: string, payload: { enabled?: boolean; name?: string; description?: string }): Promise<{ ok: boolean; rule: AlertRule }> {
    return request(`/api/alerts/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    })
  },
  deleteAlert(id: string): Promise<{ ok: boolean }> {
    return request(`/api/alerts/${encodeURIComponent(id)}`, { method: 'DELETE' })
  },
  markEventsRead(ids?: string[]): Promise<{ ok: boolean }> {
    return request('/api/alerts/events/read', {
      method: 'POST',
      body: JSON.stringify(ids ? { ids } : {})
    })
  },
  sources(): Promise<SourcesResponse> {
    return request('/api/sources')
  },
  sync(): Promise<{
    ok: boolean
    added?: number
    updated?: number
    scanned?: number
    duration?: number
    error?: string
    busy?: boolean
    message?: string
  }> {
    return request('/api/sync', { method: 'POST', body: '{}' })
  },
  updateSettings(payload: { autoSync?: boolean; intervalMinutes?: number }): Promise<{ ok: boolean; github: SourcesResponse['github'] }> {
    return request('/api/settings', {
      method: 'PATCH',
      body: JSON.stringify(payload)
    })
  },
  reindex(): Promise<{ ok: boolean; stats: SourcesResponse['rag'] }> {
    return request('/api/rag/reindex', { method: 'POST', body: '{}' })
  },
  search(query: string): Promise<{
    items: { id: string; fullName: string; category: string; stars: number; languageColor: string }[]
  }> {
    return request(`/api/search?q=${encodeURIComponent(query)}`)
  },
  ask(projectId: string): Promise<{ prompt: string }> {
    return request(`/api/projects/${encodeURIComponent(projectId)}/ask`, { method: 'POST', body: '{}' })
  }
}

export type StreamEvent =
  | { type: 'retrieving'; message: string }
  | { type: 'meta'; meta: ChatMeta }
  | { type: 'delta'; text: string }
  | { type: 'done'; conversationId: string }
  | { type: 'error'; message: string }

export async function streamChat(options: {
  message: string
  history: Pick<ChatMessage, 'role' | 'content'>[]
  signal?: AbortSignal
  onEvent: (event: StreamEvent) => void
}): Promise<void> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: options.message, history: options.history }),
    signal: options.signal
  })

  if (!response.ok || !response.body) {
    let message = 'AI 服务暂时不可用，请稍后再试。'
    try {
      const payload = await response.json()
      if (payload?.error) message = payload.error
    } catch {
      // Ignore non-JSON errors.
    }
    throw new Error(message)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  const dispatch = (rawEvent: string) => {
    let eventName = 'message'
    const dataLines: string[] = []
    for (const line of rawEvent.split('\n')) {
      if (line.startsWith('event:')) eventName = line.slice(6).trim()
      if (line.startsWith('data:')) dataLines.push(line.slice(5).trim())
    }
    if (!dataLines.length) return
    let data: Record<string, unknown>
    try {
      data = JSON.parse(dataLines.join('\n'))
    } catch {
      return
    }
    if (eventName === 'retrieving') {
      options.onEvent({ type: 'retrieving', message: String(data.message || '') })
    } else if (eventName === 'meta') {
      options.onEvent({ type: 'meta', meta: data as unknown as ChatMeta })
    } else if (eventName === 'delta') {
      options.onEvent({ type: 'delta', text: String(data.text || '') })
    } else if (eventName === 'done') {
      options.onEvent({ type: 'done', conversationId: String(data.conversationId || '') })
    } else if (eventName === 'error') {
      options.onEvent({ type: 'error', message: String(data.message || '生成失败') })
    }
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const chunks = buffer.split('\n\n')
    buffer = chunks.pop() || ''
    for (const chunk of chunks) {
      if (chunk.trim()) dispatch(chunk)
    }
  }
  if (buffer.trim()) dispatch(buffer)
}
