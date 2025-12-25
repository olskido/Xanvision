import './NodeDetails.css'

export default function NodeDetails({ node, onClose }) {
  if (!node) return null

  return (
    <div className="xv-node-panel">
      <div className="xv-node-panel-head">
        <div className="xv-node-label">PNODE DETAILS</div>
        <button type="button" className="xv-close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>

      <div className="xv-node-body">
        <div>
          <div className="xv-node-label">ID</div>
          <div className="xv-node-mono">{node.id}</div>
        </div>

        <div className="xv-two-col">
          <div>
            <div className="xv-node-label">UPTIME</div>
            <div
              className={
                node.uptime > 95
                  ? 'xv-big xv-green'
                  : node.uptime > 85
                    ? 'xv-big xv-yellow'
                    : 'xv-big xv-red'
              }
            >
              {node.uptime.toFixed(1)}%
            </div>
          </div>

          <div>
            <div className="xv-node-label">STORAGE</div>
            <div className="xv-big xv-white">{node.storage} GB</div>
          </div>
        </div>

        <div className="xv-two-col">
          <div>
            <div className="xv-node-label">PEERS</div>
            <div className="xv-white">{node.peers}</div>
          </div>

          <div>
            <div className="xv-node-label">REGION</div>
            <div className="xv-white">{node.region}</div>
          </div>
        </div>

        <div>
          <div className="xv-node-label">HEALTH STATUS</div>
          <div
            className={
              node.health === 'excellent'
                ? 'xv-pill xv-pill-green'
                : node.health === 'good'
                  ? 'xv-pill xv-pill-blue'
                  : 'xv-pill xv-pill-red'
            }
          >
            {node.health.toUpperCase()}
          </div>
        </div>

        <div className="xv-coords">
          <div className="xv-node-label">COORDINATES</div>
          <div className="xv-node-mono">
            LAT: {node.lat.toFixed(2)}° LON: {node.lon.toFixed(2)}°
          </div>
        </div>
      </div>
    </div>
  )
}
