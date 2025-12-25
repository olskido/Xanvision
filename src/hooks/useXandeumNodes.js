import { useEffect, useState, useCallback } from 'react'
import { getPodsWithStats } from '../utils/xandeumRpc.js'

const POLL_INTERVAL = 30000

export default function useXandeumNodes({ fallbackNodes = [] } = {}) {
  const [nodes, setNodes] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchNodes = useCallback(async (signal) => {
    try {
      const pods = await getPodsWithStats({ signal })

      setNodes(pods)
      setError(null)
      return pods

    } catch (err) {
      if (err.name === 'AbortError') return null

      setError(err)

      if (nodes.length === 0) {
        setNodes(fallbackNodes)
      }

      return null
    } finally {
      setIsLoading(false)
    }
  }, [fallbackNodes, nodes.length])

  useEffect(() => {
    let mounted = true
    const controller = new AbortController()

    async function load() {
      if (!mounted) return
      setIsLoading(true)

      try {
        await fetchNodes(controller.signal)
      } catch (err) {
        // Already handled
      }
    }

    load()
    const interval = setInterval(load, POLL_INTERVAL)

    return () => {
      mounted = false
      clearInterval(interval)
      controller.abort()
    }
  }, [fetchNodes])

  return {
    nodes: nodes.length > 0 ? nodes : fallbackNodes,
    isLoading,
    error,
    isSimulation: nodes.length === 0
  }
}
