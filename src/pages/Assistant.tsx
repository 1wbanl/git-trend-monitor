import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Copy,
  Database,
  MessageSquareText,
  Plus,
  Send,
  Sparkles,
  Square
} from 'lucide-react'
import { api, streamChat } from '../lib/api'
import { useApiData } from '../lib/useApiData'
import { useApp } from '../context/AppContext'
import type { ChatMessage, ChatSource } from '../lib/types'
import { compactCount, relativeTime, signedPct } from '../lib/format'
import { Markdown } from '../components/Markdown'
import { ProjectAvatar } from '../components/ui'

const STORAGE_KEY = 'git-trend-monitor.chat.v1'

const suggestions = [
  {
    label: '本地部署',
    title: '有哪些适合本地部署、同时支持 RAG 的开源项目？',
    detail: '在隐私与能力之间做选择',
    icon: Database
  },
  {
    label: '趋势判断',
    title: '最近一周增长最快的项目是哪个？背后有哪些信号？',
    detail: '让数据自己说明方向',
    icon: Sparkles
  },
  {
    label: '项目对比',
    title: '对比 Dify 和 n8n，我应该先深入研究哪一个？',
    detail: '从定位、能力与热度拆解',
    icon: MessageSquareText
  },
  {
    label: '概念追问',
    title: 'RAG 和 MCP 是什么？它们如何影响 Agent 工具链？',
    detail: '把概念放回真实项目',
    icon: ArrowUpRight
  }
]

const asidePrompts = [
  '哪些项目同时满足自托管和 RAG？',
  '这周智能体赛道的信号说明了什么？',
  '给我一个 3 个项目的入门研究清单。'
]

function loadStoredMessages(): ChatMessage[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (message) => message && (message.role === 'user' || message.role === 'assistant') && typeof message.content === 'string'
    )
  } catch {
    return []
  }
}

function MessageSources({
  sources,
  onOpen
}: {
  sources: ChatSource[]
  onOpen: (id: string) => void
}) {
  if (!sources.length) return null
  return (
    <div className="message-sources">
      <span className="message-sources-label">引用项目</span>
      <div className="message-source-chips">
        {sources.map((source) => (
          <button
            type="button"
            key={source.projectId}
            className="source-chip"
            onClick={() => onOpen(source.projectId)}
            title={`${source.fullName} · ${source.reason}`}
          >
            <span>[{source.index}]</span>
            {source.fullName}
          </button>
        ))}
      </div>
    </div>
  )
}

function AssistantMessage({
  message,
  onOpenProject,
  onCopy
}: {
  message: ChatMessage
  onOpenProject: (id: string) => void
  onCopy: (content: string) => void
}) {
  const [copied, setCopied] = useState(false)
  const isStreaming = message.streaming
  const modeLabel =
    message.meta?.mode === 'remote'
      ? `${message.meta.provider} · ${message.meta.model}`
      : message.meta?.mode === 'local-fallback'
        ? '本地 RAG · 自动回退'
        : message.meta
          ? '本地 RAG · 未外发数据'
          : '正在生成'

  return (
    <div className="chat-message assistant-message">
      <div className="assistant-avatar">
        <Sparkles size={16} />
      </div>
      <div className="message-body">
        <div className="message-head">
          <strong>Git Trend AI</strong>
          <span className="mode-badge">
            <span className="mode-dot" />
            {modeLabel}
          </span>
          <span className="message-time">{relativeTime(message.createdAt)}</span>
        </div>
        <div className="assistant-bubble">
          {message.content ? (
            <Markdown content={message.content} />
          ) : (
            <div className="thinking-row">
              <span className="thinking-dots"><i /><i /><i /></span>
              正在检索项目知识库…
            </div>
          )}
          {isStreaming && message.content && <span className="stream-caret" />}
        </div>
        {message.sources && message.sources.length > 0 && (
          <MessageSources sources={message.sources} onOpen={onOpenProject} />
        )}
        {!isStreaming && message.content && (
          <div className="message-actions">
            <button
              type="button"
              onClick={() => {
                onCopy(message.content)
                setCopied(true)
                window.setTimeout(() => setCopied(false), 1600)
              }}
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? '已复制' : '复制回答'}
            </button>
            <span className="message-grounding">
              <span className="status-orb" />
              基于 {message.sources?.length || 0} 个项目知识卡
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

export default function AssistantPage() {
  const { toast, openProject, pendingPrompt, consumePendingPrompt } = useApp()
  const [messages, setMessages] = useState<ChatMessage[]>(loadStoredMessages)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [streamStatus, setStreamStatus] = useState('正在检索知识库…')
  const [streamError, setStreamError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const pendingHandled = useRef<string | null>(null)

  const { data: sourcesData } = useApiData(() => api.sources(), [])
  const lastAssistant = [...messages].reverse().find((message) => message.role === 'assistant')
  const activeSources = lastAssistant?.sources || []
  const activeMeta = lastAssistant?.meta
  const isEmpty = messages.length === 0
  const currentMode =
    activeMeta?.mode ||
    (sourcesData?.ai.mode === 'remote' ? 'remote' : 'local')

  useEffect(() => {
    const node = scrollRef.current
    if (!node) return
    node.scrollTop = node.scrollHeight
  }, [messages, busy])

  useEffect(() => {
    if (!inputRef.current) return
    inputRef.current.style.height = 'auto'
    inputRef.current.style.height = `${Math.min(148, Math.max(28, inputRef.current.scrollHeight))}px`
  }, [input])

  useEffect(() => {
    if (busy) return
    const persistable = messages
      .filter((message) => message.content && !message.streaming)
      .slice(-24)
    try {
      if (persistable.length) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(persistable))
      else window.localStorage.removeItem(STORAGE_KEY)
    } catch {
      // Storage may be unavailable; the chat still works in memory.
    }
  }, [messages, busy])

  const sendMessage = useCallback(
    async (rawText: string) => {
      const text = rawText.trim()
      if (!text || busy) return
      setStreamError(null)
      setInput('')
      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: text,
        createdAt: new Date().toISOString()
      }
      const assistantId = `assistant-${Date.now()}`
      const placeholder: ChatMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        createdAt: new Date().toISOString(),
        streaming: true
      }
      const history = messages
        .filter((message) => message.content && !message.streaming)
        .slice(-6)
        .map((message) => ({ role: message.role, content: message.content }))

      setMessages((current) => [...current, userMessage, placeholder])
      setBusy(true)
      setStreamStatus('正在检索项目知识库…')
      const controller = new AbortController()
      abortRef.current = controller
      let failed = false

      try {
        await streamChat({
          message: text,
          history,
          signal: controller.signal,
          onEvent: (event) => {
            if (event.type === 'retrieving') {
              setStreamStatus(event.message)
            } else if (event.type === 'meta') {
              setStreamStatus('正在组织回答与引用…')
              setMessages((current) =>
                current.map((message) =>
                  message.id === assistantId
                    ? {
                        ...message,
                        sources: event.meta.sources,
                        meta: {
                          mode: event.meta.mode,
                          provider: event.meta.provider,
                          model: event.meta.model
                        }
                      }
                    : message
                )
              )
            } else if (event.type === 'delta') {
              setMessages((current) =>
                current.map((message) =>
                  message.id === assistantId
                    ? { ...message, content: message.content + event.text }
                    : message
                )
              )
            } else if (event.type === 'done') {
              setMessages((current) =>
                current.map((message) =>
                  message.id === assistantId ? { ...message, streaming: false } : message
                )
              )
            } else if (event.type === 'error') {
              failed = true
              setStreamError(event.message)
              setMessages((current) =>
                current.map((message) =>
                  message.id === assistantId
                    ? {
                        ...message,
                        content:
                          message.content ||
                          '抱歉，这次回答没有顺利生成。知识库仍然在线，可以再试一次，或者把问题问得更具体一些。',
                        streaming: false
                      }
                    : message
                )
              )
            }
          }
        })
        if (!failed) {
          setMessages((current) =>
            current.map((message) =>
              message.id === assistantId ? { ...message, streaming: false } : message
            )
          )
        }
      } catch (error) {
        const aborted = error instanceof DOMException && error.name === 'AbortError'
        if (aborted) {
          setMessages((current) =>
            current.map((message) =>
              message.id === assistantId
                ? {
                    ...message,
                    content: message.content
                      ? `${message.content}\n\n> 已停止生成。`
                      : '> 已停止生成。',
                    streaming: false
                  }
                : message
            )
          )
          toast('已停止本次回答', 'info')
        } else {
          const message = error instanceof Error ? error.message : 'AI 服务暂时不可用'
          setStreamError(message)
          setMessages((current) =>
            current.map((item) =>
              item.id === assistantId
                ? {
                    ...item,
                    content:
                      item.content ||
                      '抱歉，这次没有连接到研究助手。请稍后再试，或前往数据源检查 AI 配置。',
                    streaming: false
                  }
                : item
            )
          )
        }
      } finally {
        setBusy(false)
        abortRef.current = null
        window.setTimeout(() => inputRef.current?.focus(), 60)
      }
    },
    [busy, messages, toast]
  )

  useEffect(() => {
    if (!pendingPrompt) {
      pendingHandled.current = null
      return
    }
    if (pendingHandled.current === pendingPrompt || busy) return
    pendingHandled.current = pendingPrompt
    const prompt = consumePendingPrompt()
    if (prompt) sendMessage(prompt)
  }, [pendingPrompt, busy, consumePendingPrompt, sendMessage])

  const stopGeneration = () => {
    abortRef.current?.abort()
  }

  const newChat = () => {
    if (busy) {
      toast('请先停止当前回答，再新建会话', 'info')
      return
    }
    setMessages([])
    setStreamError(null)
    setInput('')
    window.localStorage.removeItem(STORAGE_KEY)
    window.setTimeout(() => inputRef.current?.focus(), 60)
  }

  const copyAnswer = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content)
      toast('回答已复制到剪贴板')
    } catch {
      toast('复制失败，请手动选择文本', 'error')
    }
  }

  const kb = sourcesData?.rag
  const ai = sourcesData?.ai
  const providerLabel =
    currentMode === 'remote' && activeMeta
      ? `${activeMeta.provider} / ${activeMeta.model}`
      : ai?.mode === 'remote'
        ? `${ai.provider} / ${ai.model}`
        : '本地 RAG · BM25'

  return (
    <div className="assistant-page">
      <header className="assistant-page-head">
        <div>
          <div className="page-eyebrow">
            <span className="eyebrow-pip" />
            RESEARCH ASSISTANT · RAG ENABLED
          </div>
          <div className="assistant-title-row">
            <h1>AI 研究助手</h1>
            <span className={`assistant-status ${currentMode === 'remote' ? 'is-remote' : 'is-local'}`}>
              <span />
              {currentMode === 'remote' ? '远程模型已连接' : '本地知识库模式'}
            </span>
          </div>
        </div>
        <div className="assistant-head-actions">
          <span className="provider-pill">{providerLabel}</span>
          <button type="button" className="button button-secondary button-small" onClick={newChat}>
            <Plus size={14} />
            新建会话
          </button>
        </div>
      </header>

      <div className="assistant-layout">
        <section className="chat-panel">
          <div className="chat-panel-top">
            <div className="chat-panel-title">
              <span className="ai-orb-small">
                <Sparkles size={14} />
              </span>
              <div>
                <strong>趋势研究对话</strong>
                <span>{kb ? `知识库已索引 ${kb.documents} 个片段` : '正在读取知识库…'}</span>
              </div>
            </div>
            <span className="chat-top-note">
              <span className="status-orb" />
              {busy ? '生成中' : '随时可以开始'}
            </span>
          </div>

          <div className="chat-scroll" ref={scrollRef}>
            {isEmpty ? (
              <div className="chat-empty">
                <div className="assistant-hero-orb" aria-hidden="true">
                  <span className="hero-orb-core"><Sparkles size={24} /></span>
                  <span className="hero-orb-ring ring-a" />
                  <span className="hero-orb-ring ring-b" />
                  <span className="hero-orb-ring ring-c" />
                  <span className="hero-node hero-node-a" />
                  <span className="hero-node hero-node-b" />
                  <span className="hero-node hero-node-c" />
                </div>
                <span className="chat-empty-kicker">GROUNDED IN {kb?.documents || 0} KNOWLEDGE CHUNKS</span>
                <h2>问一个只有你的趋势库，<br />才能回答的问题。</h2>
                <p>
                  我会先检索项目摘要、能力标签与趋势快照，再生成带引用的回答。
                  {ai?.mode === 'remote' ? ' 当前已连接远程模型。' : ' 当前使用本地检索，不会把项目数据发往外部。'}
                </p>

                <div className="suggestion-grid">
                  {suggestions.map((suggestion) => {
                    const Icon = suggestion.icon
                    return (
                      <button
                        type="button"
                        className="suggestion-card"
                        key={suggestion.title}
                        onClick={() => sendMessage(suggestion.title)}
                      >
                        <span className="suggestion-icon"><Icon size={16} /></span>
                        <span className="suggestion-copy">
                          <small>{suggestion.label}</small>
                          <strong>{suggestion.title}</strong>
                          <span>{suggestion.detail}</span>
                        </span>
                        <ArrowUpRight size={14} className="suggestion-arrow" />
                      </button>
                    )
                  })}
                </div>

                <div className="chat-empty-meta">
                  <span><Database size={12} /> {kb?.projects || 0} 个项目</span>
                  <span>{kb?.method || 'BM25 检索'}</span>
                  <span>回答附带来源引用</span>
                  <Link to="/sources">管理知识库 <ArrowRight size={12} /></Link>
                </div>
              </div>
            ) : (
              <div className="message-list">
                {messages.map((message) =>
                  message.role === 'user' ? (
                    <div className="chat-message user-message" key={message.id}>
                      <div className="user-bubble">{message.content}</div>
                      <div className="user-avatar">LT</div>
                    </div>
                  ) : (
                    <AssistantMessage
                      key={message.id}
                      message={message}
                      onOpenProject={openProject}
                      onCopy={copyAnswer}
                    />
                  )
                )}
                {busy && !messages.some((message) => message.streaming && message.content) && (
                  <div className="stream-status">
                    <span className="thinking-dots"><i /><i /><i /></span>
                    {streamStatus}
                  </div>
                )}
                {streamError && (
                  <div className="chat-error-banner">
                    <span>{streamError}</span>
                    <button type="button" onClick={() => setStreamError(null)}>知道了</button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="chat-composer-wrap">
            <div className="chat-composer">
              <textarea
                ref={inputRef}
                value={input}
                rows={1}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                    event.preventDefault()
                    sendMessage(input)
                  }
                }}
                placeholder="问一个关于开源趋势、项目选型或技术方向的问题…"
                aria-label="向 AI 研究助手提问"
              />
              <div className="composer-bottom">
                <div className="composer-context">
                  <span className="rag-badge"><Sparkles size={11} /> RAG</span>
                  <span>{kb ? `${kb.documents} 个知识片段已就绪` : '知识库索引中'}</span>
                  <span className="composer-divider" />
                  <span>Enter 发送 · Shift + Enter 换行</span>
                </div>
                {busy ? (
                  <button
                    type="button"
                    className="composer-send is-stop"
                    onClick={stopGeneration}
                    aria-label="停止生成"
                    title="停止生成"
                  >
                    <Square size={13} fill="currentColor" />
                  </button>
                ) : (
                  <button
                    type="button"
                    className="composer-send"
                    onClick={() => sendMessage(input)}
                    disabled={!input.trim()}
                    aria-label="发送问题"
                  >
                    <Send size={16} />
                  </button>
                )}
              </div>
            </div>
            <p className="composer-disclaimer">
              回答基于 Git Trend Monitor 的项目知识库与趋势快照，不构成投资建议。
            </p>
          </div>
        </section>

        <aside className="chat-aside">
          <section className="aside-card knowledge-card">
            <div className="aside-card-head">
              <span className="panel-kicker light">KNOWLEDGE BASE</span>
              <span className="aside-live"><span /> ONLINE</span>
            </div>
            <div className="knowledge-stats">
              <div>
                <strong>{kb?.documents || '—'}</strong>
                <span>知识片段</span>
              </div>
              <div>
                <strong>{kb?.projects || '—'}</strong>
                <span>项目</span>
              </div>
              <div>
                <strong>{kb?.terms ? compactCount(kb.terms) : '—'}</strong>
                <span>检索词</span>
              </div>
            </div>
            <div className="knowledge-method">
              <span>{kb?.method || 'BM25 · 中英双语分词'}</span>
              {kb?.builtAt && <span>更新于 {relativeTime(kb.builtAt)}</span>}
            </div>
            <Link to="/sources" className="aside-link">
              查看索引与数据源 <ArrowRight size={13} />
            </Link>
          </section>

          <section className="aside-card context-card">
            <div className="aside-card-head">
              <span className="panel-kicker light">RETRIEVED CONTEXT</span>
              {activeSources.length > 0 && <span className="aside-count">{activeSources.length}</span>}
            </div>
            {activeSources.length ? (
              <div className="context-list">
                {activeSources.map((source) => (
                  <button
                    type="button"
                    className="context-item"
                    key={source.projectId}
                    onClick={() => openProject(source.projectId)}
                  >
                    <span className="context-index">[{source.index}]</span>
                    <ProjectAvatar name={source.name} owner={source.owner} size={28} />
                    <span className="context-copy">
                      <strong>{source.name}</strong>
                      <span>{source.category} · {compactCount(source.stars)} ★</span>
                    </span>
                    <span className="context-growth">{signedPct(source.weeklyGrowthPct)}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="context-empty">
                <span><MessageSquareText size={16} /></span>
                <p>提出问题后，本次检索到的项目会在这里列出，并对应回答中的编号引用。</p>
              </div>
            )}
          </section>

          <section className="aside-card prompt-card">
            <div className="aside-card-head">
              <span className="panel-kicker light">TRY ASKING</span>
            </div>
            <div className="aside-prompt-list">
              {asidePrompts.map((prompt) => (
                <button type="button" key={prompt} onClick={() => sendMessage(prompt)}>
                  <span>{prompt}</span>
                  <ArrowRight size={13} />
                </button>
              ))}
            </div>
          </section>

          <div className="aside-note">
            <span className="status-orb" />
            <span>
              {busy
                ? '正在读取检索上下文…'
                : ai?.mode === 'remote'
                  ? '远程模型仅在生成阶段接收检索上下文'
                  : '所有检索与生成均在本地完成'}
            </span>
          </div>
        </aside>
      </div>
    </div>
  )
}
