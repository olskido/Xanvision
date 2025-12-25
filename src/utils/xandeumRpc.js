const DEFAULT_TIMEOUT_MS = 10000
const API_BASE_URL = '/api/xandeum'

function isAbortError(err) {
  if (!err) return false
  if (err?.name === 'AbortError') return true
  if (err?.code === 'ABORT_ERR') return true
  return false
}

export function getRpcBaseUrl() {
  return API_BASE_URL
}

function withTimeout(signal, timeoutMs) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  const onAbort = () => controller.abort()
  signal?.addEventListener?.('abort', onAbort)

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timeout)
      signal?.removeEventListener?.('abort', onAbort)
    },
  }
}

async function httpGet(path, { baseUrl = API_BASE_URL, timeoutMs = DEFAULT_TIMEOUT_MS, signal } = {}) {
  const url = `${baseUrl}${path}`
  const t = withTimeout(signal, timeoutMs)

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: t.signal,
    })

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`)
    }

    return await res.json()
  } catch (err) {
    if (isAbortError(err) || t.signal.aborted) return null
    throw err
  } finally {
    t.cleanup()
  }
}

function num(v, fallback = 0) {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : fallback
}

function normalizePod(raw) {
  const obj = raw && typeof raw === 'object' ? raw : {}

  const storageUsedBytes = num(obj?.storage_used, 0)
  const storageUsedMb = storageUsedBytes / (1024 * 1024)
  const storageUsedGb = storageUsedBytes / (1024 * 1024 * 1024)

  const uptimeRaw = obj?.uptime ?? obj?.uptime_percent ?? obj?.uptimePct ?? obj?.performance_score
  const uptimePercent = Math.max(0, Math.min(100, num(uptimeRaw, 0)))

  return {
    ...obj,
    storage_used: storageUsedBytes,
    storage_used_mb: storageUsedMb,
    storage_used_gb: storageUsedGb,
    uptime_percent: uptimePercent,
    uptime: obj?.uptime != null ? num(obj.uptime, 0) : obj?.uptime,
    capacityGb: obj?.capacityGb != null ? num(obj.capacityGb, 0) : obj?.capacityGb,
    storage: obj?.storage != null ? num(obj.storage, 0) : obj?.storage,
    peers: obj?.peers != null ? num(obj.peers, 0) : obj?.peers,
  }
}

function normalizePodsResponse(payload) {
  if (!payload) return []
  if (Array.isArray(payload)) return payload.map(normalizePod)
  if (Array.isArray(payload?.pods)) return payload.pods.map(normalizePod)
  if (Array.isArray(payload?.result)) return payload.result.map(normalizePod)
  return []
}

/**
 * Fetch all pods with their statistics from the proxy server
 */
export async function getPodsWithStats(options = {}) {
  try {
    const response = await httpGet('/pods', {
      baseUrl: options.baseUrl || API_BASE_URL,
      timeoutMs: options.timeoutMs || DEFAULT_TIMEOUT_MS,
      signal: options.signal,
    })

    if (!response) return []
    if (response?.success === false) return []

    return normalizePodsResponse(response)
  } catch (err) {
    if (isAbortError(err) || options?.signal?.aborted) return []
    return []
  }
}

function aggregateTotalStorage(pods) {
  const arr = Array.isArray(pods) ? pods : []
  const totalStorageGb = arr.reduce((sum, p) => sum + (num(p?.capacityGb, 0) || num(p?.storage, 0)), 0)
  const totalStorageTb = totalStorageGb / 1000
  return { totalStorageGb, totalStorageTb }
}

function aggregateAvgUptime(pods) {
  const arr = Array.isArray(pods) ? pods : []
  if (!arr.length) return 0
  return arr.reduce((sum, p) => sum + num(p?.uptime_percent ?? p?.uptime, 0), 0) / arr.length
}

function aggregateRegions(pods) {
  const arr = Array.isArray(pods) ? pods : []
  return arr.reduce((acc, p) => {
    const r = p?.region || 'UNK'
    acc[r] = (acc[r] || 0) + 1
    return acc
  }, {})
}

function aggregateWarnings(pods) {
  const arr = Array.isArray(pods) ? pods : []
  return arr.reduce((acc, p) => acc + (p?.health === 'warning' ? 1 : 0), 0)
}

/**
 * Fetch network statistics (aggregated from pods data)
 */
export async function getNetworkStats(options = {}) {
  try {
    // First try the dedicated network-stats endpoint
    const response = await httpGet('/network-stats', {
      baseUrl: options.baseUrl || API_BASE_URL,
      timeoutMs: options.timeoutMs || DEFAULT_TIMEOUT_MS,
      signal: options.signal,
    })

    if (response?.success && response?.stats) {
      const storageTb = response.stats.totalStorageTb || (response.stats.totalStorageGb || 0) / 1000
      return {
        nodes: response.stats.totalNodes || 0,
        totalNodes: response.stats.totalNodes || 0,
        activeNodes: response.stats.activeNodes || 0,
        totalStorageTb: storageTb,
        total_storage_tb: storageTb,
        total_storage_gb: response.stats.totalStorageGb || 0,
        avgUptime: response.stats.avgUptime || 0,
        avg_uptime: response.stats.avgUptime || 0,
        warnings: response.stats.warnings || 0,
        regionCounts: response.stats.regionCounts || {},
      }
    }
  } catch (err) { }

  // Fallback: compute stats from pods data
  const pods = await getPodsWithStats(options)
  const { totalStorageGb, totalStorageTb } = aggregateTotalStorage(pods)
  const avgUptime = aggregateAvgUptime(pods)
  const warnings = aggregateWarnings(pods)
  const regionCounts = aggregateRegions(pods)

  return {
    nodes: pods.length,
    totalNodes: pods.length,
    activeNodes: pods.length,
    totalStorageTb: totalStorageTb,
    total_storage_tb: totalStorageTb,
    total_storage_gb: totalStorageGb,
    avgUptime,
    avg_uptime: avgUptime,
    warnings,
    regionCounts,
  }
}

/**
 * Fetch details for a specific node
 */
export async function getNodeDetails(nodeId, options = {}) {
  if (!nodeId) throw new Error('Missing nodeId')

  try {
    // Get all pods and find the one with matching ID
    const pods = await getPodsWithStats(options)
    const node = pods.find(
      (p) =>
        p?.id === nodeId ||
        p?.node_id === nodeId ||
        p?.pnode_id === nodeId ||
        p?.pubkey === nodeId ||
        p?.pod_id === nodeId ||
        p?.address === nodeId,
    )

    if (!node) {
      throw new Error(`Node ${nodeId} not found`)
    }

    return node
  } catch (err) {
    if (isAbortError(err) || options?.signal?.aborted) return null
    throw err
  }
}