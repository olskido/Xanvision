import { Connection } from '@solana/web3.js'
import { XandeumClient } from '@xandeum/web3.js'

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n))
}

function hashString(s) {
  const str = String(s || '')
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function stableSphereCoords(id) {
  const h = hashString(id)
  const a = (h % 360) * (Math.PI / 180)
  const b = ((Math.floor(h / 360) % 180) - 90) * (Math.PI / 180)
  const lat = (b * 180) / Math.PI
  const lon = (a * 180) / Math.PI
  return { lat, lon }
}

function podJitterDegrees(podId) {
  if (!podId) return { dLat: 0, dLon: 0 }
  const h = hashString(podId)
  // Small bounded offsets to encourage visible clustering without collapsing nodes.
  const dLat = ((h % 21) - 10) * 0.4
  const dLon = (((Math.floor(h / 21) % 21) - 10) * 0.4)
  return { dLat, dLon }
}

function xyzFromLatLon(lat, lon, radius = 200) {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lon + 180) * (Math.PI / 180)
  return {
    x: radius * Math.sin(phi) * Math.cos(theta),
    y: radius * Math.cos(phi),
    z: radius * Math.sin(phi) * Math.sin(theta),
  }
}

async function prpcCall(url, method, params, signal) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params: params || [] }),
    signal,
  })

  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  if (data?.error) throw new Error(data.error?.message || 'RPC error')
  return data?.result
}

let _client = null
let _logged = false

export function getMunichConfig() {
  return {
    solanaRpcUrl: import.meta.env.VITE_XANDEUM_SOLANA_RPC_URL || '',
    pnodeRpcUrl: import.meta.env.VITE_XANDEUM_PNODE_RPC_URL || '',
  }
}

export function getXandeumClient() {
  if (_client) return _client

  const { solanaRpcUrl } = getMunichConfig()
  if (!solanaRpcUrl) return null

  const connection = new Connection(solanaRpcUrl)
  _client = new XandeumClient(connection)
  return _client
}

function normalizePNode(raw, index, podsIndex) {
  const id = raw?.id || raw?.node_id || raw?.pubkey || raw?.identity || `pnode_${index}`

  const perf = clamp(Number(raw?.performance_score ?? raw?.perf ?? 0), 0, 1)
  const health = perf >= 0.8 ? 'excellent' : perf >= 0.55 ? 'good' : 'warning'
  const uptime = perf * 100

  const usedGb = Number(raw?.used_storage ?? raw?.used_gb ?? raw?.used ?? raw?.storage_used ?? 0)
  const capacityGb = Number(raw?.total_capacity ?? raw?.capacity_gb ?? raw?.capacity ?? raw?.storage_capacity ?? 0)

  const peers = Number(raw?.peers ?? raw?.peer_count ?? 0)
  const region = raw?.region || raw?.continent || raw?.geo?.region || 'UNK'
  const country = raw?.country || raw?.geo?.country || raw?.location?.country

  const lat = Number.isFinite(Number(raw?.lat)) ? Number(raw.lat) : stableSphereCoords(id).lat
  const lon = Number.isFinite(Number(raw?.lon)) ? Number(raw.lon) : stableSphereCoords(id).lon
  const podId = podsIndex?.get(id) || null

  const { dLat, dLon } = podJitterDegrees(podId)
  const adjLat = clamp(lat + dLat, -89.9, 89.9)
  const adjLon = ((lon + dLon + 540) % 360) - 180
  const { x, y, z } = xyzFromLatLon(adjLat, adjLon)

  return {
    id,
    x,
    y,
    z,
    lat: adjLat,
    lon: adjLon,
    uptime,
    storage: usedGb,
    capacityGb,
    peers,
    health,
    region,
    country,
    podId,
    performance_score: perf,
  }
}

export async function fetchPNodeNetworkData({ signal, pnodeRpcUrl } = {}) {
  const cfg = getMunichConfig()
  const url = pnodeRpcUrl || cfg.pnodeRpcUrl
  if (!url) {
    return { nodes: [], storageStats: null, pods: [] }
  }

  // Initialize SDK (Solana-side) primarily to satisfy Xandeum SDK usage and future extensions.
  // pNode primitives are fetched from the Munich pNode RPC.
  try {
    const client = getXandeumClient()
    if (client && !_logged) {
      console.info('Xandeum Munich SDK connected to pNode prototype.')
      _logged = true
    }
  } catch {
    // ignore; we still can attempt pNode RPC calls
  }

  try {
    const [rawNodes, storageStats, pods] = await Promise.all([
      prpcCall(url, 'get_nodes', [], signal),
      prpcCall(url, 'get_storage_stats', [], signal),
      prpcCall(url, 'get_pods', [], signal),
    ])

    const podIndex = new Map()
    if (Array.isArray(pods)) {
      pods.forEach((p) => {
        const pid = p?.id || p?.pod_id || p?.name || null
        const members = p?.nodes || p?.members || p?.pnode_ids || []
        if (!pid) return
        if (Array.isArray(members)) {
          members.forEach((m) => {
            const nid = typeof m === 'string' ? m : m?.id || m?.node_id || m?.pubkey
            if (nid) podIndex.set(nid, pid)
          })
        }
      })
    }

    const nodes = Array.isArray(rawNodes)
      ? rawNodes.map((n, i) => normalizePNode(n, i, podIndex))
      : []

    // Reorder nodes by pod to encourage clustered adjacency in the topology renderer.
    nodes.sort((a, b) => {
      const pa = a.podId || ''
      const pb = b.podId || ''
      if (pa < pb) return -1
      if (pa > pb) return 1
      return String(a.id).localeCompare(String(b.id))
    })

    return { nodes, storageStats: storageStats || null, pods: Array.isArray(pods) ? pods : [] }
  } catch (err) {
    return { nodes: [], storageStats: null, pods: [], error: err }
  }
}
