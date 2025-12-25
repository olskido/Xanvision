import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Copy, Check, ExternalLink, ArrowLeft } from 'lucide-react'
import { getNodeDetails, getRpcBaseUrl } from '../../utils/xandeumRpc.js'
import { shortenNodeId } from '../../utils/techwizHeuristics.js'
import './NodeExplorer.css'

export default function NodeExplorer({ node, open, onClose, onBack }) {
  if (!open) return null

  const rpcBaseUrl = useMemo(() => getRpcBaseUrl() || '', [])
  const [rpcNode, setRpcNode] = useState(null)
  const [rpcLoading, setRpcLoading] = useState(false)
  const [rpcError, setRpcError] = useState(null)
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    if (node?.id) {
      navigator.clipboard.writeText(node.id)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  useEffect(() => {
    if (!open) return
    if (!rpcBaseUrl) return
    if (!node?.id) return

    let cancelled = false
    const controller = new AbortController()

    const fetchDetails = async () => {
      setRpcLoading(true)
      setRpcError(null)

      try {
        const data = await getNodeDetails(node.id, { baseUrl: rpcBaseUrl, signal: controller.signal })
        if (cancelled) return
        setRpcNode(data)
        setRpcLoading(false)
      } catch (err) {
        if (cancelled) return
        setRpcError(err)
        setRpcNode(null)
        setRpcLoading(false)
      }
    }

    fetchDetails()
    const interval = setInterval(fetchDetails, 30000)

    return () => {
      cancelled = true
      clearInterval(interval)
      controller.abort()
    }
  }, [node?.id, open, rpcBaseUrl])

  const effectiveNode = rpcNode && typeof rpcNode === 'object' ? { ...node, ...rpcNode } : node

  return (
    <div className="xv-explorer" role="dialog" aria-label="pNode explorer">
      <div className="xv-explorer-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {onBack && (
            <button type="button" className="xv-explorer-back" onClick={onBack} aria-label="Back">
              <ArrowLeft size={16} />
            </button>
          )}
          <div className="xv-explorer-title">PNODE EXPLORER</div>
        </div>
        <button type="button" className="xv-explorer-close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>

      {effectiveNode ? (
        <div className="xv-explorer-body">
          <div className="xv-explorer-row">
            <span className="xv-ek">ID</span>
            <span className="xv-ev" style={{ display: 'flex', alignItems: 'center', gap: '8px' }} title={effectiveNode.id}>
              {shortenNodeId(effectiveNode.id)}
              <button className="xv-copy-btn" onClick={handleCopy} aria-label="Copy ID">
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </span>
          </div>
          <div className="xv-explorer-row" style={{ marginTop: '-8px', marginBottom: '12px' }}>
            <span className="xv-ek"></span>
            <Link to={`/techwiz?search=${effectiveNode.id}`} className="xv-view-link">
              View in PNodes <ExternalLink size={12} />
            </Link>
          </div>
          <div className="xv-explorer-row">
            <span className="xv-ek">Region</span>
            <span className="xv-ev">{effectiveNode.region}</span>
          </div>
          <div className="xv-explorer-row">
            <span className="xv-ek">Health</span>
            <span className={effectiveNode.health === 'warning' ? 'xv-ev xv-warn' : 'xv-ev'}>
              {effectiveNode.health}
            </span>
          </div>
          <div className="xv-explorer-row">
            <span className="xv-ek">Uptime</span>
            <span className="xv-ev">{Number(effectiveNode.uptime).toFixed(1)}%</span>
          </div>
          <div className="xv-explorer-row">
            <span className="xv-ek">Storage Capacity</span>
            <span className="xv-ev">{effectiveNode.capacityGb || effectiveNode.storage || 0} GB</span>
          </div>
          <div className="xv-explorer-row">
            <span className="xv-ek">Storage Used</span>
            <span className="xv-ev">{(effectiveNode.storage_used_gb || 0).toFixed(2)} GB</span>
          </div>
          <div className="xv-explorer-row">
            <span className="xv-ek">Peers</span>
            <span className="xv-ev">{effectiveNode.peers}</span>
          </div>

          {effectiveNode?.country ? (
            <div className="xv-explorer-row">
              <span className="xv-ek">Country</span>
              <span className="xv-ev">{effectiveNode.country}</span>
            </div>
          ) : null}

          <div className="xv-explorer-sep" />

          <div className="xv-explorer-sub">Coordinates</div>
          <div className="xv-explorer-mono">
            LAT: {Number(effectiveNode.lat).toFixed(2)}°
            <br />
            LON: {Number(effectiveNode.lon).toFixed(2)}°
          </div>

          <div className="xv-explorer-sep" />

          <div className="xv-explorer-sub">Notes</div>
          <div className="xv-explorer-note">
            {rpcLoading
              ? 'Fetching RPC details…'
              : rpcError
                ? 'RPC details unavailable (showing base snapshot).'
                : 'Real-time view updates automatically.'}
          </div>
        </div>
      ) : (
        <div className="xv-explorer-empty">Select a pNode to inspect.</div>
      )}
    </div>
  )
}
