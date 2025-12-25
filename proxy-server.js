import express from 'express'
import fetch from 'node-fetch'
import cors from 'cors'

const app = express()

// CRITICAL: CORS must be FIRST middleware
app.use(cors({
    origin: '*', // Allow all origins (or specify 'http://localhost:5173')
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept']
}))

app.use(express.json())

const RPC_URL = 'http://192.190.136.28:6000/rpc'
const TIMEOUT_MS = 15000

// Cache for pods data to avoid duplicate RPC calls
let podsCache = {
    data: null,
    timestamp: 0,
    ttl: 30000 // 30 seconds cache (increased for geo lookup)
}

// IP Geolocation Cache
const regionCache = new Map()

async function resolveRegions(pods) {
    const ipsToResolve = new Set()

    // Identify IPs that need resolution
    for (const pod of pods) {
        if (pod.region !== 'Unknown' && pod.region) continue

        const ip = pod.address ? pod.address.split(':')[0] : null
        if (!ip) continue

        if (regionCache.has(ip)) {
            const cached = regionCache.get(ip)
            pod.region = cached.regionName || cached.country || 'Unknown'
            pod.country = cached.country || 'Unknown'
            pod.lat = cached.lat
            pod.lon = cached.lon
        } else {
            ipsToResolve.add(ip)
        }
    }

    const uniqueIps = Array.from(ipsToResolve)
    if (uniqueIps.length === 0) return

    console.log(`[GEO] Resolving ${uniqueIps.length} new IPs...`)

    // Batch requests (max 100 per batch)
    const batches = []
    while (uniqueIps.length > 0) {
        batches.push(uniqueIps.splice(0, 100))
    }

    for (const batch of batches) {
        try {
            // ip-api batch endpoint expects array of objects or strings
            // We use objects to request specific fields
            const body = batch.map(query => ({ query, fields: 'status,message,country,regionName,lat,lon' }))

            const res = await fetch('http://ip-api.com/batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            })

            if (!res.ok) {
                console.error(`[GEO] API Error: ${res.status}`)
                continue
            }

            const data = await res.json()

            data.forEach((info, index) => {
                const ip = batch[index] // The IP corresponding to this result

                if (info.status === 'success') {
                    regionCache.set(ip, info)

                    // Update all pods with this IP
                    pods.forEach(p => {
                        if (p.address && p.address.startsWith(ip)) {
                            p.region = info.regionName || info.country || 'Unknown'
                            p.country = info.country || 'Unknown'
                            p.lat = info.lat
                            p.lon = info.lon
                        }
                    })
                }
            })

        } catch (err) {
            console.error('[GEO] Failed to resolve regions:', err.message)
        }

        // Polite delay between batches
        await new Promise(r => setTimeout(r, 1000))
    }
}

// Normalize pod data to match frontend expectations
function normalizePod(pod) {
    const storageUsedBytes = Number(pod?.storage_used || 0)
    const storageUsedMb = storageUsedBytes / (1024 * 1024)
    const storageUsedGb = storageUsedBytes / (1024 * 1024 * 1024)

    // Handle storage_committed (bytes) and convert to GB for capacityGb
    const storageCommittedBytes = Number(pod?.storage_committed || 0)
    const storageCommittedGb = storageCommittedBytes / (1024 * 1024 * 1024)

    const uptimeRaw = pod?.uptime_percent ?? pod?.uptime ?? pod?.performance_score ?? 0
    // If uptime is in seconds (large number), treat as valid - we'll use performance_score or set to 100
    let uptimePercent
    if (Number(uptimeRaw) > 100) {
        // uptime field is in seconds, use performance_score or default to 100%
        uptimePercent = pod?.performance_score != null
            ? Math.max(0, Math.min(100, Number(pod.performance_score) * 100))
            : 100
    } else {
        uptimePercent = Math.max(0, Math.min(100, Number(uptimeRaw)))
    }

    return {
        id: pod?.id || pod?.pod_id || pod?.pubkey || `pod_${Date.now()}`,
        storage_used: storageUsedBytes,
        storage_used_mb: storageUsedMb,
        storage_used_gb: storageUsedGb,
        uptime_percent: uptimePercent,
        uptime: uptimePercent,
        capacityGb: storageCommittedGb > 0 ? storageCommittedGb : Number(pod?.capacityGb ?? pod?.capacity ?? 1000),
        storage: Number(pod?.storage ?? 0),
        peers: Number(pod?.peers ?? 0),
        region: pod?.region || 'Unknown',
        health: uptimePercent > 95 ? 'excellent' : uptimePercent > 80 ? 'good' : 'warning',
        performance_score: Number(pod?.performance_score ?? uptimePercent / 100),
        address: pod?.address || '',
        pubkey: pod?.pubkey || '',
        version: pod?.version || '',
        is_public: pod?.is_public ?? false,
        ...pod
    }
}

// RPC call helper with timeout
async function rpcCall(method, params = []) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

    try {
        console.log(`[RPC] Calling method: ${method}`)

        const res = await fetch(RPC_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: Date.now(),
                method,
                params
            }),
            signal: controller.signal
        })

        clearTimeout(timeout)

        if (!res.ok) {
            const text = await res.text()
            throw new Error(`RPC HTTP ${res.status}: ${text}`)
        }

        const json = await res.json()

        if (json.error) {
            throw new Error(`RPC Error: ${json.error.message || JSON.stringify(json.error)}`)
        }

        console.log(`[RPC] Success: ${method}`)
        return json.result

    } catch (err) {
        clearTimeout(timeout)
        console.error(`[RPC] Failed: ${method} - ${err.message}`)
        throw err
    }
}

// Fetch pods with caching
async function fetchPodsFromRpc() {
    const now = Date.now()

    // Return cached data if still valid
    if (podsCache.data && (now - podsCache.timestamp) < podsCache.ttl) {
        console.log('[CACHE] Returning cached pods data')
        return podsCache.data
    }

    const methods = ['get-pods-with-stats', 'getPodsWithStats', 'get_pods_with_stats', 'getPods']
    let result = null
    let lastError = null

    for (const method of methods) {
        try {
            result = await rpcCall(method)
            break
        } catch (err) {
            lastError = err
        }
    }

    if (!result) {
        throw lastError || new Error('All RPC methods failed')
    }

    // Normalize the result - handle different response structures
    let pods = []
    if (Array.isArray(result)) {
        pods = result
    } else if (Array.isArray(result?.pods)) {
        pods = result.pods
    } else if (result && typeof result === 'object') {
        pods = [result]
    }

    const normalizedPods = pods.map(normalizePod)

    // Resolve regions
    try {
        await resolveRegions(normalizedPods)
    } catch (err) {
        console.error('[GEO] Error resolving regions:', err.message)
    }

    // Update cache
    podsCache = {
        data: normalizedPods,
        timestamp: now,
        ttl: 30000
    }

    console.log(`[RPC] Fetched and normalized ${normalizedPods.length} pods`)
    return normalizedPods
}

// MAIN ENDPOINT: Get pods with stats
app.get('/api/xandeum/pods', async (req, res) => {
    console.log('[API] GET /api/xandeum/pods')

    try {
        const normalizedPods = await fetchPodsFromRpc()

        console.log(`[API] Returning ${normalizedPods.length} pods`)

        res.json({
            success: true,
            pods: normalizedPods,
            count: normalizedPods.length,
            timestamp: new Date().toISOString()
        })

    } catch (err) {
        console.error('[API] Error:', err.message)
        res.status(500).json({
            success: false,
            error: err.message,
            pods: [],
            count: 0,
            timestamp: new Date().toISOString()
        })
    }
})

// Network stats endpoint - uses cached pods data
app.get('/api/xandeum/network-stats', async (req, res) => {
    console.log('[API] GET /api/xandeum/network-stats')

    try {
        const normalizedPods = await fetchPodsFromRpc()

        // Calculate stats from pods
        const totalNodes = normalizedPods.length
        const activeNodes = normalizedPods.filter(p => p.uptime_percent > 80).length
        const totalStorageGb = normalizedPods.reduce((sum, p) => sum + (p.capacityGb || 0), 0)
        const avgUptime = normalizedPods.length > 0
            ? normalizedPods.reduce((sum, p) => sum + p.uptime_percent, 0) / normalizedPods.length
            : 0
        const warnings = normalizedPods.filter(p => p.health === 'warning').length

        // Calculate region distribution
        const regionCounts = normalizedPods.reduce((acc, p) => {
            const r = p.region || 'Unknown'
            acc[r] = (acc[r] || 0) + 1
            return acc
        }, {})

        console.log(`[API] Stats: ${totalNodes} nodes, ${activeNodes} active, ${totalStorageGb.toFixed(2)} GB, ${avgUptime.toFixed(2)}% uptime`)

        res.json({
            success: true,
            stats: {
                totalNodes,
                activeNodes,
                totalStorageGb,
                totalStorageTb: totalStorageGb / 1000,
                avgUptime,
                warnings,
                regionCounts
            },
            timestamp: new Date().toISOString()
        })

    } catch (err) {
        console.error('[API] Error:', err.message)
        res.status(500).json({
            success: false,
            error: err.message,
            stats: {
                totalNodes: 0,
                activeNodes: 0,
                totalStorageGb: 0,
                totalStorageTb: 0,
                avgUptime: 0,
                warnings: 0,
                regionCounts: {}
            },
            timestamp: new Date().toISOString()
        })
    }
})

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        rpc_url: RPC_URL,
        cache_age_ms: podsCache.timestamp ? Date.now() - podsCache.timestamp : null,
        cached_pods: podsCache.data?.length || 0,
        timestamp: new Date().toISOString()
    })
})

// Catch-all for debugging
app.use((req, res) => {
    console.log(`[API] 404: ${req.method} ${req.path}`)
    res.status(404).json({ error: 'Not found', path: req.path })
})

const PORT = 3001

app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════╗
║        XANDEUM PROXY SERVER RUNNING           ║
╠════════════════════════════════════════════════╣
║  Local:   http://localhost:${PORT}              ║
║  RPC:     ${RPC_URL}       ║
║  Health:  http://localhost:${PORT}/health       ║
║  Pods:    http://localhost:${PORT}/api/xandeum/pods
║  Stats:   http://localhost:${PORT}/api/xandeum/network-stats
╚════════════════════════════════════════════════╝
  `)
})
