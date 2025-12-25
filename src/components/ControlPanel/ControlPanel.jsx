import { Pause, Play, RotateCcw, Volume2, VolumeX, Zap } from 'lucide-react'
import './ControlPanel.css'

export default function ControlPanel({
  isPlaying,
  onTogglePlaying,
  timeTravel,
  onChangeTimeTravel,
  onResetTime,
  graphSpeed,
  onChangeGraphSpeed,
  soundEnabled,
  onToggleSound,
  onAIAnalysis,
}) {
  return (
    <div className="xv-controls">
      <div className="xv-panel">
        <div className="xv-panel-title">
          <Zap className="xv-icon" />
          TEMP CTRL
        </div>

        <div className="xv-btn-row">
          <button className="xv-btn" type="button" onClick={onTogglePlaying} aria-label={isPlaying ? 'Pause' : 'Play'}>
            {isPlaying ? <Pause className="xv-icon" /> : <Play className="xv-icon" />}
          </button>

          <button className="xv-btn" type="button" onClick={onResetTime} aria-label="Reset time">
            <RotateCcw className="xv-icon" />
          </button>

          <button className="xv-btn" type="button" onClick={onToggleSound} aria-label={soundEnabled ? 'Mute' : 'Unmute'}>
            {soundEnabled ? <Volume2 className="xv-icon" /> : <VolumeX className="xv-icon" />}
          </button>
        </div>

        <div className="xv-panel-sub">TIME TRAVEL: {timeTravel === 100 ? 'NOW' : `-${100 - timeTravel}h`}</div>
        <input
          className="xv-slider"
          type="range"
          min="0"
          max="100"
          value={timeTravel}
          onChange={(e) => onChangeTimeTravel(parseInt(e.target.value, 10))}
        />

        <div className="xv-panel-sub">GRAPH SPEED: {Math.round((Number(graphSpeed) || 0) * 100)}%</div>
        <input
          className="xv-slider"
          type="range"
          min="0"
          max="100"
          value={Math.round((Number(graphSpeed) || 0) * 100)}
          onChange={(e) => onChangeGraphSpeed(parseInt(e.target.value, 10) / 100)}
        />
      </div>

      <button type="button" className="xv-ai-btn" onClick={onAIAnalysis}>
        REQUEST AI ANALYSIS
      </button>
    </div>
  )
}
