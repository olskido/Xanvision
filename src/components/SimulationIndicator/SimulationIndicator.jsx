import './SimulationIndicator.css'

export default function SimulationIndicator({ visible }) {
  if (!visible) return null

  return <div className="xv-sim-badge">SIMULATION MODE</div>
}
