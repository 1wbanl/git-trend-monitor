import { useCallback, useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { api } from '../lib/api'
import type { SourcesResponse } from '../lib/types'
import { useApp } from '../context/AppContext'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { ProjectDrawer } from './ProjectDrawer'
import { CommandPalette } from './CommandPalette'

export function AppShell() {
  const location = useLocation()
  const { toast } = useApp()
  const [sources, setSources] = useState<SourcesResponse | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  const refreshSources = useCallback(async () => {
    try {
      const response = await api.sources()
      setSources(response)
    } catch {
      // Status chrome degrades silently; page-level requests surface errors.
    }
  }, [])

  useEffect(() => {
    refreshSources()
    const onSync = () => refreshSources()
    window.addEventListener('gtm:sync', onSync)
    const timer = window.setInterval(refreshSources, 60_000)
    return () => {
      window.removeEventListener('gtm:sync', onSync)
      window.clearInterval(timer)
    }
  }, [refreshSources])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
    setMobileNavOpen(false)
  }, [location.pathname])

  const handleSync = async () => {
    if (syncing) return
    setSyncing(true)
    toast('正在连接 GitHub，拉取最新趋势快照…', 'info')
    try {
      const result = await api.sync()
      if (result.ok) {
        toast(
          `同步完成 · 扫描 ${result.scanned ?? 0} 个项目，新增 ${result.added ?? 0} / 更新 ${result.updated ?? 0}`
        )
        window.dispatchEvent(new Event('gtm:sync'))
        await refreshSources()
      } else {
        toast(result.message || result.error || '同步失败，请检查网络或 GitHub Token 配置', 'error')
        await refreshSources()
      }
    } catch (error) {
      toast(error instanceof Error ? error.message : '同步失败，请稍后重试', 'error')
      await refreshSources()
    } finally {
      setSyncing(false)
    }
  }

  const isAssistant = location.pathname === '/assistant'

  return (
    <div className="app-shell">
      <div className="ambient ambient-one" aria-hidden="true" />
      <div className="ambient ambient-two" aria-hidden="true" />
      <Sidebar sources={sources} mobileOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
      <div className="app-main">
        <TopBar
          sources={sources}
          syncing={syncing}
          onSync={handleSync}
          onOpenNav={() => setMobileNavOpen(true)}
        />
        <main className={`main-content ${isAssistant ? 'is-assistant' : ''}`}>
          <Outlet context={{ sources, refreshSources, handleSync, syncing }} />
        </main>
      </div>
      <ProjectDrawer />
      <CommandPalette />
    </div>
  )
}
