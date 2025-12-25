function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n))
}

export function formatStorage(storageGb) {
  const gb = Number(storageGb) || 0
  if (gb >= 1024) return `${(gb / 1024).toFixed(2)} TB`
  return `${gb.toFixed(0)} GB`
}

export function shortenNodeId(id) {
  const s = String(id || '')
  if (s.length <= 12) return s
  return `${s.slice(0, 6)}…${s.slice(-4)}`
}

export function healthMeta(health) {
  if (health === 'excellent') {
    return { label: 'Excellent', key: 'excellent', colorClass: 'nc-health-excellent' }
  }
  if (health === 'good') {
    return { label: 'Good', key: 'good', colorClass: 'nc-health-good' }
  }
  return { label: 'Weak', key: 'warning', colorClass: 'nc-health-weak' }
}

export function computeNodeHeuristics(node) {
  const meta = healthMeta(node?.health)

  const uptime = clamp(Number(node?.uptime) || 0, 0, 100)
  const peers = clamp(Number(node?.peers) || 0, 0, 30)
  const storageGb = clamp(Number(node?.storage_used_gb) || Number(node?.storage) || 0, 0, 1000000)

  // Heuristic max per-node storage target for visualization
  const capacityGb = clamp(Number(node?.capacityGb) || Number(node?.total_capacity_gb) || 1000, 1, 1000000)
  const utilization = clamp(storageGb / capacityGb, 0, 1)

  const peerScore = (peers / 30) * 100
  const utilizationScore = (1 - utilization) * 100

  const compositeScore = clamp(uptime * 0.65 + utilizationScore * 0.2 + peerScore * 0.15, 0, 100)

  const reliability =
    uptime > 98 && meta.key !== 'warning' ? 'High' : uptime > 92 && meta.key !== 'warning' ? 'Medium' : 'Low'

  const risk = meta.key === 'warning' || uptime < 88 ? 'High' : utilization > 0.8 ? 'Medium' : 'Low'

  const explain = {
    healthScore: `Health Score is a heuristic: 65% uptime, 20% headroom (lower storage utilization), 15% peer connectivity. Uptime=${uptime.toFixed(1)}%, Utilization=${Math.round(utilization * 100)}%, Peers=${peers}.`,
    reliability: `Storage Reliability is a heuristic derived from uptime and health band. Higher uptime and non-weak health increases reliability. Uptime=${uptime.toFixed(1)}%, Band=${meta.label}.`,
    risk: `Risk is a heuristic: Weak health or uptime < 88% raises risk; high utilization (>80%) raises risk. Uptime=${uptime.toFixed(1)}%, Utilization=${Math.round(utilization * 100)}%, Band=${meta.label}.`,
  }

  return {
    meta,
    uptime,
    peers,
    storageGb,
    capacityGb,
    utilization,
    compositeScore,
    reliability,
    risk,
    explain,
  }
}

export function riskRank(risk) {
  if (risk === 'High') return 3
  if (risk === 'Medium') return 2
  return 1
}
