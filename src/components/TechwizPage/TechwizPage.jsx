import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import SimulationIndicator from '../SimulationIndicator/SimulationIndicator.jsx'
import NodeCard from '../NodeCard/NodeCard.jsx'
import TimeTravelFilter from '../TimeTravelFilter/TimeTravelFilter.jsx'
import useXandeumNodes from '../../hooks/useXandeumNodes.js'
import { computeNodeHeuristics, riskRank } from '../../utils/techwizHeuristics.js'
import './TechwizPage.css'

function strengthFromNode(node) {
  // Map existing model to strength bands
  if (node.health === 'excellent') return 'high'
  if (node.health === 'good') return 'medium'
  return 'low'
}

function normalizeHealthFilter(v) {
  if (v === 'excellent') return 'excellent'
  if (v === 'good') return 'good'
  if (v === 'warning') return 'warning'
  return 'all'
}

function labelForRegion(region) {
  // Treat region as a continent label already (NA/EU/ASIA/SA/AF)
  return region || 'UNK'
}

function labelForCountryOrRegion(node) {
  return (
    node?.country ||
    node?.location?.country ||
    node?.geo?.country ||
    labelForRegion(node?.region) ||
    'Unknown'
  )
}

export default function TechwizPage({ fallbackNodes }) {
  const [timeRange, setTimeRange] = useState('1h')
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 20

  const [showScrollTop, setShowScrollTop] = useState(false)

  const [healthFilter, setHealthFilter] = useState('all')
  const [regionFilter, setRegionFilter] = useState('all')

  const location = useLocation()
  const [sortBy, setSortBy] = useState('score')
  const [searchTerm, setSearchTerm] = useState(() => {
    const params = new URLSearchParams(location.search)
    return params.get('search') || ''
  })

  const { nodes, isSimulation } = useXandeumNodes({ fallbackNodes })

  useEffect(() => {
    if (typeof document === 'undefined') return
    const el = document.querySelector('.tw-root')
    if (!el) return

    const onScroll = () => {
      setShowScrollTop(el.scrollTop > 500)
    }

    onScroll()
    el.addEventListener('scroll', onScroll, { passive: true })

    // Scroll to top on mount
    window.scrollTo(0, 0)
    el.scrollTop = 0

    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  const derived = useMemo(() => {
    const totalStorageGb = nodes.reduce(
      (sum, n) => sum + (Number(n.capacityGb) || Number(n.storage) || 0),
      0,
    )
    const avgUptime = nodes.length
      ? nodes.reduce((sum, n) => sum + (Number(n.uptime) || 0), 0) / nodes.length
      : 0

    const withStrength = nodes.map((n) => ({ ...n, strength: strengthFromNode(n) }))
    const counts = {
      high: withStrength.filter((n) => n.strength === 'high').length,
      medium: withStrength.filter((n) => n.strength === 'medium').length,
      low: withStrength.filter((n) => n.strength === 'low').length,
    }

    const criticalIssues = counts.low
    const status = criticalIssues > 6 ? 'Degraded' : criticalIssues > 0 ? 'Watch' : 'Good'

    return {
      totalStorageTb: totalStorageGb / 1000,
      avgUptime,
      withStrength,
      counts,
      status,
      criticalIssues,
    }
  }, [nodes])

  const regionOptions = useMemo(() => {
    const regions = new Set()
    nodes.forEach((n) => regions.add(labelForRegion(n.region)))
    return ['all', ...Array.from(regions).sort()]
  }, [nodes])

  const filteredNodes = useMemo(() => {
    const hf = normalizeHealthFilter(healthFilter)
    const rf = regionFilter
    const search = searchTerm.toLowerCase().trim()

    return nodes
      .filter((n) => (hf === 'all' ? true : n.health === hf))
      .filter((n) => (rf === 'all' ? true : labelForRegion(n.region) === rf))
      .filter((n) => {
        if (!search) return true
        const id = (n.id || '').toLowerCase()
        const region = (n.region || '').toLowerCase()
        const country = (n.country || '').toLowerCase()
        return id.includes(search) || region.includes(search) || country.includes(search)
      })
  }, [healthFilter, nodes, regionFilter, searchTerm])

  const sortedNodes = useMemo(() => {
    const arr = [...filteredNodes]
    if (sortBy === 'uptime') {
      arr.sort((a, b) => (Number(b.uptime) || 0) - (Number(a.uptime) || 0))
      return arr
    }
    if (sortBy === 'utilization') {
      arr.sort((a, b) => {
        const ua = computeNodeHeuristics(a).utilization
        const ub = computeNodeHeuristics(b).utilization
        return ub - ua
      })
      return arr
    }
    if (sortBy === 'risk') {
      arr.sort((a, b) => {
        const ra = riskRank(computeNodeHeuristics(a).risk)
        const rb = riskRank(computeNodeHeuristics(b).risk)
        return rb - ra
      })
      return arr
    }

    // default: score
    arr.sort((a, b) => computeNodeHeuristics(b).compositeScore - computeNodeHeuristics(a).compositeScore)
    return arr
  }, [filteredNodes, sortBy])

  const pageCount = useMemo(() => {
    return Math.max(1, Math.ceil(sortedNodes.length / PAGE_SIZE))
  }, [sortedNodes.length])

  const pagedNodes = useMemo(() => {
    const clampedPage = Math.min(Math.max(1, page), pageCount)
    const start = (clampedPage - 1) * PAGE_SIZE
    return sortedNodes.slice(start, start + PAGE_SIZE)
  }, [page, pageCount, sortedNodes])

  useEffect(() => {
    // eslint-disable-next-line
    setPage(1)
  }, [healthFilter, regionFilter, sortBy, timeRange])

  useEffect(() => {
    // eslint-disable-next-line
    if (page > pageCount) setPage(pageCount)
  }, [page, pageCount])

  const aggregates = useMemo(() => {
    // Aggregates are affected by the timeRange selector (heuristic weighting)
    // but do NOT impact the base dataset / time travel.
    const timeWeight = timeRange === '1h' ? 1 : timeRange === '6h' ? 0.98 : timeRange === '24h' ? 0.96 : 0.93
    const avgUptime = filteredNodes.length
      ? (filteredNodes.reduce((sum, n) => sum + (Number(n.uptime) || 0), 0) / filteredNodes.length) * timeWeight
      : 0

    const totalStorageGb = filteredNodes.reduce(
      (sum, n) => sum + (Number(n.capacityGb) || Number(n.storage) || 0),
      0,
    )

    const scores = filteredNodes.map((n) => {
      const uptime = Number(n.uptime) || 0
      const storage = Number(n.storage) || 0
      const capacity = Math.max(1, Number(n.capacityGb) || 1000)
      const utilization = Math.min(1, storage / capacity)
      const utilScore = (1 - utilization) * 100
      const score = uptime * 0.7 + utilScore * 0.3
      return Math.max(0, Math.min(100, score))
    })
    const compositeScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0

    // Storage reliability indicator: combines uptime and warning rate.
    const warnings = filteredNodes.filter((n) => n.health === 'warning').length
    const warningRate = filteredNodes.length ? warnings / filteredNodes.length : 0
    const reliabilityIndex = Math.max(0, Math.min(100, avgUptime - warningRate * 30))

    const risk = warningRate > 0.2 || avgUptime < 90 ? 'High' : warningRate > 0.08 || avgUptime < 95 ? 'Medium' : 'Low'

    return {
      avgUptime,
      totalStorageTb: totalStorageGb / 1000,
      compositeScore,
      reliabilityIndex,
      risk,
      warnings,
    }
  }, [filteredNodes, timeRange])

  const countryDistribution = useMemo(() => {
    const counts = new Map()
    filteredNodes.forEach((n) => {
      const key = labelForCountryOrRegion(n)
      counts.set(key, (counts.get(key) || 0) + 1)
    })

    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])
  }, [filteredNodes])

  return (
    <div className="tw-root">
      <SimulationIndicator visible={isSimulation} />

      <header className="tw-header">
        <div>
          <div className="tw-title">PNODES</div>
          <div className="tw-sub">Stake-style pNode cards • Storage-first decisions • No explorer clutter</div>
          <div className="tw-legend">
            <span className="tw-legend-item" title="Direct pNode attributes sourced from Xandeum RPC / protocol data.">🧱 Protocol (RPC)</span>
            <span className="tw-legend-item" title="Derived analytics are Explorer heuristics computed client-side for decision support.">🧠 Derived (Heuristic)</span>
          </div>
        </div>

        <div className="tw-controls">
          <div className="tw-search-wrap">
            <input
              type="text"
              className="tw-search-input"
              placeholder="Search ID, Region..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <TimeTravelFilter value={timeRange} onChange={setTimeRange} />

          <div className="tw-filterblock">
            <div className="tw-filterlabel">HEALTH</div>
            <div className="tw-healthrow">
              <button
                type="button"
                className={healthFilter === 'all' ? 'tw-hbtn tw-hbtn-active' : 'tw-hbtn'}
                onClick={() => setHealthFilter('all')}
              >
                ALL
              </button>
              <button
                type="button"
                className={healthFilter === 'excellent' ? 'tw-hbtn tw-hbtn-green tw-hbtn-active' : 'tw-hbtn tw-hbtn-green'}
                onClick={() => setHealthFilter('excellent')}
              >
                EXCELLENT
              </button>
              <button
                type="button"
                className={healthFilter === 'good' ? 'tw-hbtn tw-hbtn-blue tw-hbtn-active' : 'tw-hbtn tw-hbtn-blue'}
                onClick={() => setHealthFilter('good')}
              >
                GOOD
              </button>
              <button
                type="button"
                className={healthFilter === 'warning' ? 'tw-hbtn tw-hbtn-red tw-hbtn-active' : 'tw-hbtn tw-hbtn-red'}
                onClick={() => setHealthFilter('warning')}
              >
                WEAK
              </button>
            </div>
          </div>

          <div className="tw-filterblock">
            <div className="tw-filterlabel">REGION</div>
            <select
              className="tw-select"
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value)}
            >
              {regionOptions.map((r) => (
                <option key={r} value={r}>
                  {r === 'all' ? 'ALL' : r}
                </option>
              ))}
            </select>
          </div>

          <div className="tw-filterblock">
            <div className="tw-filterlabel">SORT BY</div>
            <select className="tw-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="score">HEALTH SCORE (DESC)</option>
              <option value="uptime">UPTIME (DESC)</option>
              <option value="utilization">STORAGE UTILIZATION (DESC)</option>
              <option value="risk">RISK (HIGH→LOW)</option>
            </select>
          </div>
        </div>
      </header>

      <div className="tw-grid tw-grid-4">
        <section className="tw-card">
          <div className="tw-card-title">AGGREGATES</div>
          <div className="tw-metric">
            <span className="tw-k">Filtered pNodes</span>
            <span className="tw-v">{filteredNodes.length}</span>
          </div>
          <div className="tw-metric">
            <span className="tw-k">Avg Uptime (time-weighted)</span>
            <span className="tw-v">{aggregates.avgUptime.toFixed(1)}%</span>
          </div>
          <div className="tw-metric">
            <span className="tw-k">Total Storage</span>
            <span className="tw-v">{aggregates.totalStorageTb.toFixed(2)} TB</span>
          </div>
        </section>

        <section className="tw-card">
          <div className="tw-card-title">DERIVED ANALYTICS (HEURISTIC)</div>
          <div className="tw-metric">
            <span className="tw-k">
              Composite Health Score
              <span
                className="tw-info"
                title="Heuristic metric: mixes uptime and storage headroom; used to quickly compare node quality."
              >
                ⓘ
              </span>
            </span>
            <span className="tw-v">{Math.round(aggregates.compositeScore)}/100</span>
          </div>
          <div className="tw-metric">
            <span className="tw-k">
              Storage Reliability
              <span
                className="tw-info"
                title="Heuristic metric: derived from time-weighted uptime and warning rate (weak nodes reduce reliability)."
              >
                ⓘ
              </span>
            </span>
            <span className="tw-v">{Math.round(aggregates.reliabilityIndex)}/100</span>
          </div>
          <div className="tw-metric">
            <span className="tw-k">
              Risk
              <span
                className="tw-info"
                title="Heuristic badge: combines warning rate and average uptime; used for decision-oriented triage."
              >
                ⓘ
              </span>
            </span>
            <span className={aggregates.risk === 'Low' ? 'tw-v tw-green' : aggregates.risk === 'Medium' ? 'tw-v tw-yellow' : 'tw-v tw-red'}>
              {aggregates.risk}
            </span>
          </div>
        </section>

        <section className="tw-card">
          <div className="tw-card-title">NETWORK SNAPSHOT</div>
          <div className="tw-metric">
            <span className="tw-k">Overall Status</span>
            <span className={derived.status === 'Good' ? 'tw-v tw-green' : derived.status === 'Watch' ? 'tw-v tw-yellow' : 'tw-v tw-red'}>
              {derived.status}
            </span>
          </div>
          <div className="tw-metric">
            <span className="tw-k">Warnings (filtered)</span>
            <span className={aggregates.warnings ? 'tw-v tw-red' : 'tw-v'}>{aggregates.warnings}</span>
          </div>
          <div className="tw-metric">
            <span className="tw-k">Time Range</span>
            <span className="tw-v">{timeRange}</span>
          </div>
        </section>

        <section className="tw-card">
          <div className="tw-card-title">COUNTRY DISTRIBUTION</div>
          <div className="tw-list-sub">Best-available label: country → location → region.</div>
          <div className="tw-list-body" style={{ marginTop: 8 }}>
            {countryDistribution.length ? (
              countryDistribution.slice(0, 10).map(([k, v]) => (
                <div key={k} className="tw-metric">
                  <span className="tw-k">{k}</span>
                  <span className="tw-v">{v}</span>
                </div>
              ))
            ) : (
              <div className="tw-list-sub">No pNodes in current filter scope.</div>
            )}
          </div>
        </section>
      </div>

      <section className="tw-nodegrid-wrap">
        <div className="tw-nodegrid-head">
          <div className="tw-card-title">PNODES</div>
          <div className="tw-list-sub">Cards are storage-first. Health colors are consistent across all indicators.</div>
        </div>

        <div className="tw-nodegrid">
          {pagedNodes.map((node, index) => (
            <NodeCard key={`${node.id || node.pubkey || index}-${index}`} node={node} />
          ))}
        </div>

        {pageCount > 1 ? (
          <div className="tw-pagination">
            {(() => {
              const range = []
              const delta = 1 // Number of pages to show around current page

              // Always show first page
              range.push(1)

              // Calculate start and end of the window around current page
              let start = Math.max(2, page - delta)
              let end = Math.min(pageCount - 1, page + delta)

              // Add ellipsis before window if needed
              if (start > 2) {
                range.push('...')
              }

              // Add pages in the window
              for (let i = start; i <= end; i++) {
                range.push(i)
              }

              // Add ellipsis after window if needed
              if (end < pageCount - 1) {
                range.push('...')
              }

              // Always show last page if not already added
              if (pageCount > 1) {
                range.push(pageCount)
              }

              return (
                <>
                  <button
                    type="button"
                    className="tw-hbtn tw-next-btn"
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    aria-label="Previous Page"
                  >
                    &lt; Prev
                  </button>

                  {range.map((p, i) => (
                    p === '...' ? (
                      <span key={`ellipsis-${i}`} className="tw-pagination-ellipsis">...</span>
                    ) : (
                      <button
                        key={p}
                        type="button"
                        className={p === page ? 'tw-hbtn tw-hbtn-active' : 'tw-hbtn'}
                        onClick={() => setPage(p)}
                        aria-label={`Page ${p}`}
                      >
                        {p}
                      </button>
                    )
                  ))}

                  <button
                    type="button"
                    className="tw-hbtn tw-next-btn"
                    onClick={() => setPage(Math.min(pageCount, page + 1))}
                    disabled={page === pageCount}
                    aria-label="Next Page"
                  >
                    Next &gt;
                  </button>
                </>
              )
            })()}
          </div>
        ) : null}
      </section>

      {showScrollTop ? (
        <button
          type="button"
          className="tw-scrolltop"
          aria-label="Scroll to top"
          onClick={() => {
            const el = document.querySelector('.tw-root')
            if (el) {
              el.scrollTo({ top: 0, behavior: 'smooth' })
            }
          }}
        >
          ↑ TOP
        </button>
      ) : null}
    </div>
  )
}
