import { useEffect, useMemo, useState } from 'react'
import { getNetworkStats, getRpcBaseUrl } from '../../utils/xandeumRpc.js'
import './NetworkStatsSidebar.css'

export default function NetworkStatsSidebar({
  nodes,
  storageStats,
  isSimulation,
  onToggleExplorer,
  explorerOpen,
}) {
  const [operatorsOpen, setOperatorsOpen] = useState(false)
  const [filesystemOpen, setFilesystemOpen] = useState(false)

  const [rpcStats, setRpcStats] = useState(null)
  const [rpcLoading, setRpcLoading] = useState(false)
  const [rpcError, setRpcError] = useState(null)

  const rpcBaseUrl = useMemo(() => getRpcBaseUrl() || '', [])

  const stats = useMemo(() => {
    const totalStorageGb = nodes.reduce(
      (sum, n) => sum + (Number(n.capacityGb) || Number(n.storage) || 0),
      0,
    )
    const avgUptime = nodes.length
      ? nodes.reduce((sum, n) => sum + (Number(n.uptime) || 0), 0) / nodes.length
      : 0
    const warnings = nodes.filter((n) => n.health === 'warning').length

    const regionCounts = nodes.reduce((acc, n) => {
      const r = n.region || 'UNK'
      acc[r] = (acc[r] || 0) + 1
      return acc
    }, {})

    return {
      nodes: nodes.length,
      totalStorageTb: totalStorageGb / 1000,
      avgUptime,
      warnings,
      regionCounts,
    }
  }, [nodes])

  useEffect(() => {
    if (!rpcBaseUrl) return

    let cancelled = false
    const controller = new AbortController()

    const fetchStats = async () => {
      setRpcLoading(true)
      setRpcError(null)

      try {
        const data = await getNetworkStats({ baseUrl: rpcBaseUrl, signal: controller.signal })
        if (cancelled) return
        setRpcStats(data)
        setRpcLoading(false)
      } catch (err) {
        if (cancelled) return
        setRpcError(err)
        setRpcStats(null)
        setRpcLoading(false)
      }
    }

    fetchStats()
    const interval = setInterval(fetchStats, 30000)

    return () => {
      cancelled = true
      clearInterval(interval)
      controller.abort()
    }
  }, [rpcBaseUrl])

  const effectiveStats = useMemo(() => {
    if (storageStats && typeof storageStats === 'object') {
      const totalNodes = Number(storageStats.totalNodes ?? storageStats.nodes ?? storageStats.total_nodes)
      const totalStorageTb = Number(
        storageStats.totalStorageTb ?? storageStats.total_storage_tb ?? storageStats.totalStorage,
      )

      const hasAny = Number.isFinite(totalNodes) || Number.isFinite(totalStorageTb)
      if (hasAny) {
        return {
          nodes: Number.isFinite(totalNodes) ? totalNodes : stats.nodes,
          totalStorageTb: Number.isFinite(totalStorageTb) ? totalStorageTb : stats.totalStorageTb,
          avgUptime: stats.avgUptime,
          warnings: stats.warnings,
          regionCounts: stats.regionCounts,
        }
      }
    }

    // Prefer RPC /stats if it matches expected shape; otherwise fall back to derived stats.
    if (rpcStats && typeof rpcStats === 'object') {
      const totalNodes = Number(rpcStats.totalNodes ?? rpcStats.nodes ?? rpcStats.total_nodes)
      const activeNodes = Number(rpcStats.activeNodes ?? rpcStats.active_nodes)
      const totalStorage = Number(rpcStats.totalStorage ?? rpcStats.total_storage ?? rpcStats.totalStorageTb)

      const hasAny = Number.isFinite(totalNodes) || Number.isFinite(activeNodes) || Number.isFinite(totalStorage)
      if (hasAny) {
        return {
          nodes: Number.isFinite(activeNodes) ? activeNodes : Number.isFinite(totalNodes) ? totalNodes : stats.nodes,
          totalStorageTb: Number.isFinite(totalStorage) ? totalStorage : stats.totalStorageTb,
          avgUptime: Number.isFinite(Number(rpcStats.avgUptime ?? rpcStats.avg_uptime))
            ? Number(rpcStats.avgUptime ?? rpcStats.avg_uptime)
            : stats.avgUptime,
          warnings: Number.isFinite(Number(rpcStats.warnings ?? rpcStats.warningCount))
            ? Number(rpcStats.warnings ?? rpcStats.warningCount)
            : stats.warnings,
          regionCounts: stats.regionCounts,
        }
      }
    }

    return stats
  }, [rpcStats, stats, storageStats])

  const filesystem = useMemo(() => {
    // Mocked summary derived from node storage; replace when real pNode FS metrics exist.
    const totalSpace = Math.round(stats.totalStorageTb * 1000)
    const usedSpace = Math.round(totalSpace * 0.58)
    const freeSpace = Math.max(0, totalSpace - usedSpace)
    return { totalSpace, usedSpace, freeSpace }
  }, [stats.totalStorageTb])

  const operators = useMemo(() => {
    const health = stats.warnings > 6 ? 'Degraded' : stats.warnings > 0 ? 'Watch' : 'Good'
    const operatorsCount = 10
    const issues = stats.warnings
    return { health, operators: operatorsCount, issues }
  }, [stats.warnings])

  return (
    <aside className="xv-sidebar" aria-label="Network stats">
      <div className="xv-sidebar-head">
        <div className="xv-sidebar-title">NETWORK STATS</div>
        <div className={isSimulation ? 'xv-pill xv-pill-yellow' : 'xv-pill xv-pill-green'}>
          {isSimulation ? 'SIM' : 'LIVE'}
        </div>
      </div>

      <div className="xv-sidebar-block">
        <div className="xv-sidebar-row">
          <span className="xv-k">Nodes</span>
          <span className="xv-v">{effectiveStats.nodes}</span>
        </div>
        <div className="xv-sidebar-row">
          <span className="xv-k">Total Storage</span>
          <span className="xv-v">{effectiveStats.totalStorageTb.toFixed(1)} TB</span>
        </div>
        <div className="xv-sidebar-row">
          <span className="xv-k">Avg Uptime</span>
          <span className="xv-v">{effectiveStats.avgUptime.toFixed(1)}%</span>
        </div>
        <div className="xv-sidebar-row">
          <span className="xv-k">Warnings</span>
          <span className={effectiveStats.warnings ? 'xv-v xv-orange' : 'xv-v'}>{effectiveStats.warnings}</span>
        </div>
      </div>

      <div className="xv-sidebar-block">
        <div className="xv-sidebar-subtitle">REGIONS</div>
        <div className="xv-region-grid">
          {Object.entries(effectiveStats.regionCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 6)
            .map(([k, v]) => (
              <div key={k} className="xv-region-chip">
                <span className="xv-region-k">{k}</span>
                <span className="xv-region-v">{v}</span>
              </div>
            ))}
        </div>
      </div>

      <div className="xv-sidebar-actions">
        <button type="button" className="xv-sidebtn" onClick={onToggleExplorer}>
          {explorerOpen ? 'CLOSE EXPLORER' : 'OPEN EXPLORER'}
        </button>
      </div>

      <div className="xv-sidebar-accordion">
        <button
          type="button"
          className="xv-acc-btn"
          onClick={() => setOperatorsOpen((v) => !v)}
        >
          OPERATORS DASHBOARD
          <span className="xv-acc-state">{operatorsOpen ? '−' : '+'}</span>
        </button>
        {operatorsOpen ? (
          <div className="xv-acc-body">
            <div className="xv-sidebar-row">
              <span className="xv-k">Network Health</span>
              <span className="xv-v">{operators.health}</span>
            </div>
            <div className="xv-sidebar-row">
              <span className="xv-k">Active Operators</span>
              <span className="xv-v">{operators.operators}</span>
            </div>
            <div className="xv-sidebar-row">
              <span className="xv-k">Critical Issues</span>
              <span className={operators.issues ? 'xv-v xv-orange' : 'xv-v'}>{operators.issues}</span>
            </div>
          </div>
        ) : null}

        <button
          type="button"
          className="xv-acc-btn"
          onClick={() => setFilesystemOpen((v) => !v)}
        >
          FILESYSTEM ANALYTICS
          <span className="xv-acc-state">{filesystemOpen ? '−' : '+'}</span>
        </button>
        {filesystemOpen ? (
          <div className="xv-acc-body">
            <div className="xv-sidebar-row">
              <span className="xv-k">Total Space</span>
              <span className="xv-v">{filesystem.totalSpace} GB</span>
            </div>
            <div className="xv-sidebar-row">
              <span className="xv-k">Used Space</span>
              <span className="xv-v">{filesystem.usedSpace} GB</span>
            </div>
            <div className="xv-sidebar-row">
              <span className="xv-k">Free Space</span>
              <span className="xv-v">{filesystem.freeSpace} GB</span>
            </div>
          </div>
        ) : null}
      </div>

      <div className="xv-sidebar-foot">
        {rpcLoading ? 'Fetching RPC stats…' : rpcError ? 'RPC stats unavailable (fallback active).' : 'Real-time view updates automatically.'}
      </div>
    </aside>
  )
}
