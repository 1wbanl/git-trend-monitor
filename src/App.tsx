import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppProvider } from './context/AppContext'
import { AppShell } from './components/AppShell'
import OverviewPage from './pages/Overview'
import TrendsPage from './pages/Trends'
import LibraryPage from './pages/Library'
import AlertsPage from './pages/Alerts'
import AssistantPage from './pages/Assistant'
import SourcesPage from './pages/Sources'

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<OverviewPage />} />
            <Route path="trends" element={<TrendsPage />} />
            <Route path="library" element={<LibraryPage />} />
            <Route path="alerts" element={<AlertsPage />} />
            <Route path="assistant" element={<AssistantPage />} />
            <Route path="sources" element={<SourcesPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </AppProvider>
    </BrowserRouter>
  )
}
