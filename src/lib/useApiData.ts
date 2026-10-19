import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DependencyList
} from 'react'

export function useApiData<T>(loader: () => Promise<T>, deps: DependencyList = []) {
  const loaderRef = useRef(loader)
  loaderRef.current = loader
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestId = useRef(0)

  const load = useCallback(
    async (silent = false) => {
      const current = ++requestId.current
      if (silent) setRefreshing(true)
      else if (!data) setLoading(true)
      setError(null)
      try {
        const response = await loaderRef.current()
        if (current === requestId.current) setData(response)
      } catch (err) {
        if (current === requestId.current) {
          setError(err instanceof Error ? err.message : '加载失败，请稍后重试')
        }
      } finally {
        if (current === requestId.current) {
          setLoading(false)
          setRefreshing(false)
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    deps
  )

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const onSync = () => load(true)
    window.addEventListener('gtm:sync', onSync)
    return () => window.removeEventListener('gtm:sync', onSync)
  }, [load])

  return {
    data,
    loading,
    refreshing,
    error,
    reload: () => load(true)
  }
}
