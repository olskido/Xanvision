import { useEffect, useMemo, useState } from 'react'
import { getPodsWithStats } from '../../utils/xandeumRpc.js'
import '../../components/TechwizPage/TechwizPage.css'

function num(v, fallback = 0) {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : fallback
}

function normalizePerf(v) {
  const n = num(v, 0)
  if (n > 1.5) return Math.max(0, Math.min(1, n / 100))
  return Math.max(0, Math.min(1, n))
}

function capacityGbFromPod(p) {
  const raw = p?.total_capacity_gb ?? p?.total_capacity ?? p?.capacityGb ?? p?.capacity_gb
  const n = num(raw, 0)
  if (n > 1e9) return n / (1024 * 1024 * 1024)
  return n
}

function podIdFromPod(p) {
  return p?.pod_id || p?.podId || p?.pod || 'UNK'
}

function pnodeIdFromPod(p) {
  return p?.pnode_id || p?.pnodeId || p?.pnode_ids?.[0] || p?.id || p?.address || p?.pubkey || ''
}

function normalizeRegion(v) {
  const s = String(v || '').trim().toUpperCase()
  if (!s) return 'Other'
  if (s === 'NA' || s.includes('NORTH AMERICA') || s.includes('AMERICA')) return 'North America'
  if (s === 'EU' || s.includes('EUROPE')) return 'Europe'
  if (s === 'AS' || s.includes('ASIA')) return 'Asia'
  if (s === 'AF' || s.includes('AFRICA')) return 'Africa'
  if (s === 'SA' || s.includes('SOUTH AMERICA')) return 'South America'
  return 'Other'
}

function providerFromPod(p) {
  return (
    p?.provider ||
    p?.hosting_provider ||
    p?.host ||
    p?.isp ||
    p?.org ||
    p?.organization ||
    p?.asn_org ||
    ''
  )
}

export default function Analytics() {
  const [pods, setPods] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [pulseOn, setPulseOn] = useState(false)

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()

    const load = async () => {
      setLoading(true)
      setError(null)

      try {
        const data = await getPodsWithStats({ signal: controller.signal })
        if (cancelled) return
        setPods(Array.isArray(data) ? data : [])
      } catch (err) {
        if (cancelled) return
        setError(err)
        setPods([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [])

  useEffect(() => {
    const id = setInterval(() => setPulseOn((v) => !v), 30000)
    return () => clearInterval(id)
  }, [])

  const metrics = useMemo(() => {
    const unique = new Set()
    pods.forEach((p) => {
      const id = pnodeIdFromPod(p)
      if (id) unique.add(id)
    })

    const totalPnodes = unique.size

    const totalStorageGb = pods.reduce((sum, p) => sum + capacityGbFromPod(p), 0)
    const totalStorageTb = totalStorageGb / 1000
    const totalStoragePb = totalStorageTb / 1000

    const avgPerf = pods.length
      ? pods.reduce((sum, p) => sum + normalizePerf(p?.performance_score ?? p?.uptime_percent ?? p?.uptime), 0) / pods.length
      : 0

    const avgHealthPercent = avgPerf * 100

    const stake = num(import.meta.env.VITE_XANDEUM_STAKE, 1)
    const stoInc = totalPnodes * totalStorageGb * avgPerf * stake

    const shardReads = Math.round(totalPnodes * Math.max(0, totalStorageGb) * Math.max(0, avgPerf) * 0.25)
    const shardWrites = Math.round(shardReads * 0.42)

    const byPod = new Map()
    pods.forEach((p) => {
      const pid = podIdFromPod(p)
      byPod.set(pid, (byPod.get(pid) || 0) + 1)
    })

    const podDistribution = Array.from(byPod.entries()).sort((a, b) => b[1] - a[1])

    const regionCountsMap = new Map()
    pods.forEach((p) => {
      const r = normalizeRegion(p?.region)
      regionCountsMap.set(r, (regionCountsMap.get(r) || 0) + 1)
    })
    const regionDistribution = Array.from(regionCountsMap.entries()).sort((a, b) => b[1] - a[1])

    const providerCountsMap = new Map()
    pods.forEach((p) => {
      const rawProvider = providerFromPod(p)
      const label = rawProvider ? String(rawProvider).trim() : ''
      if (!label) return
      providerCountsMap.set(label, (providerCountsMap.get(label) || 0) + 1)
    })
    const providerDistribution = Array.from(providerCountsMap.entries()).sort((a, b) => b[1] - a[1])
    const providerFallback = [
      ['Contabo', 60],
      ['Netcup', 20],
      ['Hetzner', 10],
      ['Other', 10],
    ]

    return {
      totalPnodes,
      totalStorageGb,
      totalStorageTb,
      totalStoragePb,
      avgPerf,
      avgHealthPercent,
      stake,
      stoInc,
      shardReads,
      shardWrites,
      podDistribution,
      regionDistribution,
      providerDistribution,
      providerFallback,
    }
  }, [pods])

  const storageLabel = useMemo(() => {
    if (metrics.totalStoragePb >= 1) return `${metrics.totalStoragePb.toFixed(2)} PB`
    return `${metrics.totalStorageTb.toFixed(2)} TB`
  }, [metrics.totalStoragePb, metrics.totalStorageTb])

  return (
    <div className="tw-root analytics-page">
      <header className="tw-header">
        <div>
          <div className="tw-title">ANALYTICS</div>
          <div className="tw-sub">Network-level pNode intelligence • Deterministic aggregates • pRPC-backed</div>
          <div className="tw-legend">
            <span className="tw-legend-item" title="Metrics are derived from the live pNode/pod dataset.">
              🧱 Data Source: Xandeum pRPC
            </span>
          </div>
        </div>

        <div className="tw-controls">
          <div className="tw-filterblock">
            <div className="tw-filterlabel">STATUS</div>
            <div className="tw-list-sub">{loading ? 'Loading…' : error ? 'RPC unavailable (fallback active).' : 'Live'}</div>
            <div className="tw-list-sub">Live Pulse: {pulseOn ? '●' : '○'}</div>
          </div>
        </div>
      </header>

      <div className="tw-grid">
        {metrics.avgHealthPercent < 90 ? (
          <section className="tw-card" style={{ gridColumn: '1 / -1' }}>
            <div className="tw-card-title">CRITICAL ALERT</div>
            <div className="tw-list-sub">Average Network Health is below 90% ({metrics.avgHealthPercent.toFixed(1)}%).</div>
          </section>
        ) : null}

        <section className="tw-card">
          <div className="tw-card-title">TOTAL NETWORK PNODES</div>
          <div className="tw-metric">
            <span className="tw-k">Unique pNode IDs</span>
            <span className="tw-v">{metrics.totalPnodes}</span>
          </div>
          <div className="tw-list-sub">Data Source: Xandeum pRPC</div>
        </section>

        <section className="tw-card">
          <div className="tw-card-title">AGGREGATE STORAGE</div>
          <div className="tw-metric">
            <span className="tw-k">Total Capacity</span>
            <span className="tw-v">{storageLabel}</span>
          </div>
          <div className="tw-list-sub">Data Source: Xandeum pRPC</div>
        </section>

        <section className="tw-card">
          <div className="tw-card-title">PERFORMANCE SCORE</div>
          <div className="tw-metric">
            <span className="tw-k">Uptime/Reliability (0.0–1.0)</span>
            <span className="tw-v">{metrics.avgPerf.toFixed(3)}</span>
          </div>
          <div className="tw-list-sub">Data Source: Xandeum pRPC</div>
        </section>

        <section className="tw-card">
          <div className="tw-card-title">STORAGE OPERATIONS (SHARDS)</div>
          <div className="tw-metric">
            <span className="tw-k">Shard Reads</span>
            <span className="tw-v">{metrics.shardReads.toLocaleString()}</span>
          </div>
          <div className="tw-metric">
            <span className="tw-k">Shard Writes</span>
            <span className="tw-v">{metrics.shardWrites.toLocaleString()}</span>
          </div>
          <div className="tw-list-sub">Estimated from live totals (Munich Release placeholder)</div>
        </section>

        <section className="tw-card">
          <div className="tw-card-title">STOINC ESTIMATOR</div>
          <div className="tw-metric">
            <span className="tw-k">Stake</span>
            <span className="tw-v">{metrics.stake}</span>
          </div>
          <div className="tw-metric">
            <span className="tw-k">Estimated Epoch Rewards</span>
            <span className="tw-v">{Math.round(metrics.stoInc).toLocaleString()}</span>
          </div>
          <div className="tw-list-sub">Data Source: Xandeum pRPC</div>
        </section>

        <section className="tw-card">
          <div className="tw-card-title">NETWORK REVENUE</div>
          <div className="tw-metric">
            <span className="tw-k">Estimated STOINC (Storage Income)</span>
            <span className="tw-v">{Math.round(metrics.stoInc).toLocaleString()}</span>
          </div>
          <div className="tw-list-sub">
            Formula: pNodes × GB × Performance × Stake
          </div>
        </section>

        <section className="tw-card">
          <div className="tw-card-title">POD DISTRIBUTION</div>
          <div className="tw-list-sub">pNodes grouped by pod_id (decentralization indicator)</div>
          <div className="tw-list-body" style={{ marginTop: 8 }}>
            {metrics.podDistribution.length ? (
              metrics.podDistribution.slice(0, 12).map(([k, v]) => (
                <div key={k} className="tw-metric">
                  <span className="tw-k">{k}</span>
                  <span className="tw-v">{v}</span>
                </div>
              ))
            ) : (
              <div className="tw-list-sub">No pods available.</div>
            )}
          </div>
          <div className="tw-list-sub" style={{ marginTop: 10 }}>Data Source: Xandeum pRPC</div>
        </section>

        <section className="tw-card">
          <div className="tw-card-title">REGIONAL DISTRIBUTION</div>
          <div className="tw-list-sub">Region-only view (Munich Release)</div>
          <div className="tw-list-body" style={{ marginTop: 8 }}>
            {metrics.regionDistribution.length ? (
              metrics.regionDistribution.map(([k, v]) => (
                <div key={k} className="tw-metric">
                  <span className="tw-k">{k}</span>
                  <span className="tw-v">{v}</span>
                </div>
              ))
            ) : (
              <div className="tw-list-sub">No region data available.</div>
            )}
          </div>
          <div className="tw-list-sub" style={{ marginTop: 10 }}>Data Source: Xandeum pRPC</div>
        </section>

        <section className="tw-card">
          <div className="tw-card-title">ISP HEALTH</div>
          <div className="tw-list-sub">Hosting concentration (decentralization indicator)</div>
          <div className="tw-list-body" style={{ marginTop: 8 }}>
            {(metrics.providerDistribution.length ? metrics.providerDistribution.slice(0, 6) : metrics.providerFallback).map(([k, v]) => (
              <div key={k} className="tw-metric">
                <span className="tw-k">{k}</span>
                <span className="tw-v">{typeof v === 'number' ? v.toString() : String(v)}</span>
              </div>
            ))}
          </div>
          <div className="tw-list-sub" style={{ marginTop: 10 }}>
            {metrics.providerDistribution.length ? 'Data Source: Xandeum pRPC' : 'Mock distribution (provider field unavailable)'}
          </div>
        </section>

        <section className="tw-card">
          <div className="tw-card-title">DATASET</div>
          <div className="tw-metric">
            <span className="tw-k">Pods Loaded</span>
            <span className="tw-v">{pods.length}</span>
          </div>
          <div className="tw-list-sub">Data Source: Xandeum pRPC</div>
        </section>
      </div>
    </div>
  )
}
