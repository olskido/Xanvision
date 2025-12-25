import { useMemo, useState } from 'react'
import { Copy, Check } from 'lucide-react'
import './NodeCard.css'
import { computeNodeHeuristics, formatStorage, shortenNodeId } from '../../utils/techwizHeuristics.js'

export default function NodeCard({ node }) {
  const derived = useMemo(() => computeNodeHeuristics(node), [node])
  const meta = derived.meta
  const [copied, setCopied] = useState(false)

  const handleCopy = (e) => {
    e.stopPropagation()
    navigator.clipboard.writeText(node.id)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={`nc-card ${meta.colorClass}`}>
      <div className="nc-top">
        <div>
          <div className="nc-id" title={node.id}>
            {shortenNodeId(node.id)}
            <button className="nc-copy-btn" onClick={handleCopy} aria-label="Copy ID">
              {copied ? <Check size={12} /> : <Copy size={12} />}
            </button>
          </div>
          <div className="nc-region">{node.region || 'UNK'}</div>
        </div>

        <div className={`nc-badge ${meta.colorClass}`}>{meta.label}</div>
      </div>

      <div className="nc-metrics">
        <div className="nc-metric">
          <div className="nc-k">🧱 Uptime</div>
          <div className="nc-v">{derived.uptime.toFixed(1)}%</div>
        </div>
        <div className="nc-metric">
          <div className="nc-k">🧱 Storage Used</div>
          <div className="nc-v">{formatStorage(derived.storageGb)}</div>
        </div>
      </div>

      <div className="nc-bar">
        <div className="nc-bar-head">
          <span className="nc-k">Storage Utilization</span>
          <span className="nc-v">{Math.round(derived.utilization * 100)}%</span>
        </div>
        <div className="nc-bar-track">
          <div className={`nc-bar-fill ${meta.colorClass}`} style={{ width: `${derived.utilization * 100}%` }} />
        </div>
      </div>

      <div className="nc-derived">
        <div className="nc-derived-head">
          <div className="nc-derived-title">🧠 Derived Analytics</div>
          <div className="nc-derived-note">Heuristic</div>
        </div>

        <div className="nc-derived-grid">
          <div className="nc-pill">
            <div className="nc-k">
              Health Score
              <span className="nc-info" title={derived.explain.healthScore}>
                ⓘ
              </span>
            </div>
            <div className="nc-v">{Math.round(derived.compositeScore)}/100</div>
          </div>
          <div className="nc-pill">
            <div className="nc-k">
              Reliability
              <span className="nc-info" title={derived.explain.reliability}>
                ⓘ
              </span>
            </div>
            <div className="nc-v">{derived.reliability}</div>
          </div>
          <div className={`nc-pill ${derived.risk === 'High' ? 'nc-risk-high' : derived.risk === 'Medium' ? 'nc-risk-medium' : 'nc-risk-low'}`}>
            <div className="nc-k">
              Risk
              <span className="nc-info" title={derived.explain.risk}>
                ⓘ
              </span>
            </div>
            <div className="nc-v">{derived.risk}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
