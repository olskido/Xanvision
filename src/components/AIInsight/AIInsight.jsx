import './AIInsight.css'

export default function AIInsight({ insight }) {
  if (!insight) return null

  return (
    <div className="xv-ai-panel">
      <div className="xv-ai-title">AI CO-PILOT INSIGHT</div>
      <p className="xv-ai-text">{insight}</p>
    </div>
  )
}
