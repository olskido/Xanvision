import { Trophy } from 'lucide-react'
import './HUD.css'

export default function HUD({ nodes, score }) {
  return (
    <div className="xv-header">
      <div className="xv-header-inner">
        <div>
          <h1 className="xv-title">
            <span className="xv-title-cyan">XAN</span>
            <span className="xv-title-white">VISION</span>
          </h1>
          <p className="xv-subtitle">HOLOGRAPHIC PNODES ANALYTICS PLATFORM</p>
        </div>

        <div className="xv-hud">
          <div className="xv-hud-card">
            <div className="xv-hud-label">NETWORK STATUS</div>
            <div className="xv-hud-value xv-green">OPTIMAL</div>
          </div>

          <div className="xv-hud-card">
            <div className="xv-hud-label">NODES ACTIVE</div>
            <div className="xv-hud-value">{nodes.length}</div>
          </div>

          <div className="xv-hud-card">
            <div className="xv-hud-label">EXPLORER SCORE</div>
            <div className="xv-hud-value xv-yellow xv-hud-inline">
              <Trophy className="xv-icon" />
              {score}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
