import { useEffect, useRef, useState } from 'react'
import { MessageSquare, Users, X } from 'lucide-react'
import AIInsight from '../AIInsight/AIInsight.jsx'
import ControlPanel from '../ControlPanel/ControlPanel.jsx'
import HUD from '../HUD/HUD.jsx'
import NetworkStatsSidebar from '../NetworkStatsSidebar/NetworkStatsSidebar.jsx'

import Node3D from '../Node3D/Node3D.jsx'
import NodeExplorer from '../NodeExplorer/NodeExplorer.jsx'
import SimulationIndicator from '../SimulationIndicator/SimulationIndicator.jsx'
import './XanVision.css'
import useXandeumNodes from '../../hooks/useXandeumNodes.js'
import { useMobileMenu } from '../../context/MobileMenuContext.jsx'
import { shortenNodeId } from '../../utils/techwizHeuristics.js'
import brainIcon from '../../assets/brain.png'

const XanVision = () => {
  const [isPlaying, setIsPlaying] = useState(true)
  const [timeTravel, setTimeTravel] = useState(100)
  const [graphSpeed, setGraphSpeed] = useState(0.25)
  const [selectedNode, setSelectedNode] = useState(null)
  const [aiInsight, setAiInsight] = useState('')
  const [score, setScore] = useState(0)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [nodes, setNodes] = useState([])
  const [explorerOpen, setExplorerOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [activeMobileComponent, setActiveMobileComponent] = useState(null)
  const [showWarnings, setShowWarnings] = useState(false)
  const [showBrainInsights, setShowBrainInsights] = useState(false)
  const [openedFromWarnings, setOpenedFromWarnings] = useState(false)

  const { registerItems, unregisterItems } = useMobileMenu()

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Register page-specific menu items
  useEffect(() => {
    const items = [
      { id: 'xv-stats', label: 'NETWORK STATS', onClick: () => setActiveMobileComponent('stats'), section: 'page', priority: 1 },
      { id: 'xv-controls', label: 'CONTROLS', onClick: () => setActiveMobileComponent('controls'), section: 'page', priority: 2 },
      { id: 'xv-ai', label: 'AI INSIGHT', onClick: () => setActiveMobileComponent('ai'), section: 'page', priority: 3 },
    ]
    registerItems(items)
    return () => unregisterItems(items.map(i => i.id))
  }, [registerItems, unregisterItems])

  const audioContextRef = useRef(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return

    audioContextRef.current = new Ctx()

    return () => {
      if (audioContextRef.current?.state !== 'closed') {
        audioContextRef.current.close().catch(() => { })
      }
    }
  }, [])

  const playSound = (frequency, duration) => {
    if (!soundEnabled || !audioContextRef.current) return

    const oscillator = audioContextRef.current.createOscillator()
    const gainNode = audioContextRef.current.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(audioContextRef.current.destination)

    oscillator.frequency.value = frequency
    oscillator.type = 'sine'

    gainNode.gain.setValueAtTime(0.1, audioContextRef.current.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(
      0.01,
      audioContextRef.current.currentTime + duration,
    )

    oscillator.start(audioContextRef.current.currentTime)
    oscillator.stop(audioContextRef.current.currentTime + duration)
  }

  const generateNodes = (timeOffset = 0) => {
    const nodeCount = 50
    const generatedNodes = []

    for (let i = 0; i < nodeCount; i++) {
      const lat = (Math.random() - 0.5) * 180
      const lon = (Math.random() - 0.5) * 360
      const phi = (90 - lat) * (Math.PI / 180)
      const theta = (lon + 180) * (Math.PI / 180)
      const radius = 200

      const uptime = Math.max(
        50,
        Math.min(100, 85 + Math.random() * 15 + Math.sin(timeOffset * 0.01 + i) * 10),
      )
      const storage = Math.floor(100 + Math.random() * 900)
      const peers = Math.floor(3 + Math.random() * 12)

      generatedNodes.push({
        id: `node_${i}`,
        x: radius * Math.sin(phi) * Math.cos(theta),
        y: radius * Math.cos(phi),
        z: radius * Math.sin(phi) * Math.sin(theta),
        uptime,
        storage,
        peers,
        health: uptime > 95 ? 'excellent' : uptime > 85 ? 'good' : 'warning',
        region: ['NA', 'EU', 'ASIA', 'SA', 'AF'][Math.floor(Math.random() * 5)],
        lat,
        lon,
      })
    }

    return generatedNodes
  }

  useEffect(() => {
    setNodes(generateNodes(0))
  }, [])

  // Add 3D coordinates to pods that don't have them
  const addCoordinates = (pods) => {
    return pods.map((pod, i) => {
      // If pod already has coordinates, use them
      if (Number.isFinite(pod.x) && Number.isFinite(pod.y) && Number.isFinite(pod.z)) {
        return pod
      }

      // Generate coordinates based on pod index for consistent positioning
      const lat = pod.lat ?? ((i * 7.3 + 13) % 180 - 90)
      const lon = pod.lon ?? ((i * 13.7 + 29) % 360 - 180)
      const phi = (90 - lat) * (Math.PI / 180)
      const theta = (lon + 180) * (Math.PI / 180)
      const radius = 200

      return {
        ...pod,
        x: radius * Math.sin(phi) * Math.cos(theta),
        y: radius * Math.cos(phi),
        z: radius * Math.sin(phi) * Math.sin(theta),
        lat,
        lon,
      }
    })
  }

  const {
    nodes: rawNodes,
    isSimulation,
  } = useXandeumNodes({ fallbackNodes: nodes })

  // Transform nodes to have 3D coordinates
  const effectiveNodes = addCoordinates(rawNodes)

  // Compute storage stats from effective nodes
  const storageStats = {
    totalStorageGb: effectiveNodes.reduce((sum, n) => sum + (n.capacityGb || n.storage || 0), 0),
    usedStorageGb: effectiveNodes.reduce((sum, n) => sum + (n.storage_used_gb || 0), 0),
  }

  useEffect(() => {
    const offset = (100 - timeTravel) * 100
    setNodes(generateNodes(offset))

    if (timeTravel !== 100) {
      playSound(400 + timeTravel * 4, 0.1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeTravel])

  const generateAIInsight = () => {
    if (effectiveNodes.length === 0) return
    const warnings = effectiveNodes.filter((n) => n.health === 'warning')
    const avg = effectiveNodes.reduce((acc, n) => acc + (n.uptime_percent || n.uptime || 0), 0) / effectiveNodes.length

    const insights = []

    // 1. Network Health Analysis
    if (avg > 98) insights.push(`Network health is optimal. Average uptime: ${avg.toFixed(1)}% across ${effectiveNodes.length} nodes.`)
    else if (avg > 90) insights.push(`Network health is stable. Average uptime: ${avg.toFixed(1)}%.`)
    else insights.push(`Network degradation detected. Average uptime dropped to ${avg.toFixed(1)}%.`)

    // 2. Warnings / Risks
    if (warnings.length > 0) {
      insights.push(`${warnings.length} nodes require attention (Health: Warning). Immediate investigation recommended.`)
      const worstNode = warnings.sort((a, b) => a.uptime - b.uptime)[0]
      if (worstNode) insights.push(`Critical Node Detected: ${shortenNodeId(worstNode.id)} is operating at ${worstNode.uptime.toFixed(1)}% uptime.`)
    } else {
      insights.push(`All ${effectiveNodes.length} nodes are operating within optimal parameters. No active warnings.`)
    }

    // 3. Region Analysis
    const regions = effectiveNodes.reduce((acc, n) => {
      acc[n.region] = (acc[n.region] || 0) + 1
      return acc
    }, {})
    const topRegion = Object.entries(regions).sort((a, b) => b[1] - a[1])[0]
    if (topRegion) {
      insights.push(`Regional dominance: ${topRegion[0]} hosts ${topRegion[1]} active nodes (${((topRegion[1] / effectiveNodes.length) * 100).toFixed(0)}% of network).`)
    }

    // 4. Storage Analysis
    const totalStorageTb = effectiveNodes.reduce((a, n) => a + (n.capacityGb || n.storage || 0), 0) / 1000
    const usedStorageTb = effectiveNodes.reduce((a, n) => a + (n.storage_used_gb || 0), 0) / 1000
    const utilPercent = (usedStorageTb / totalStorageTb) * 100
    insights.push(`Global Storage: ${usedStorageTb.toFixed(1)}TB used of ${totalStorageTb.toFixed(1)}TB capacity (${utilPercent.toFixed(1)}% utilization).`)

    // 5. Performance/Gossip
    const highPerfNodes = effectiveNodes.filter(n => n.uptime > 99).length
    insights.push(`${highPerfNodes} nodes are performing at elite levels (>99% uptime). Gossip protocol efficiency is high.`)

    const insight = insights[Math.floor(Math.random() * insights.length)]
    setAiInsight(insight)

    if (warnings.length > 0) {
      playSound(200, 0.3)
    } else {
      playSound(800, 0.2)
    }

    setScore((prev) => prev + 10)
  }

  const avgUptime = effectiveNodes.length
    ? effectiveNodes.reduce((a, n) => a + n.uptime, 0) / effectiveNodes.length
    : 0
  const warningsCount = effectiveNodes.filter((n) => n.health === 'warning').length

  return (
    <div className="xv-root">
      <div className="xv-scanline" aria-hidden="true" />

      {isMobile && activeMobileComponent && (
        <div className="xv-mobile-component-overlay">
          <button
            className="xv-mobile-close-component"
            onClick={() => setActiveMobileComponent(null)}
          >
            <X className="xv-icon" />
          </button>
          {activeMobileComponent === 'stats' && (
            <div className="xv-mobile-component-wrapper">
              <NetworkStatsSidebar
                nodes={effectiveNodes}
                storageStats={storageStats}
                isSimulation={isSimulation}
                explorerOpen={explorerOpen}
                onToggleExplorer={() => setExplorerOpen((v) => !v)}
              />
            </div>
          )}
          {activeMobileComponent === 'controls' && (
            <div className="xv-mobile-component-wrapper">
              <ControlPanel
                isPlaying={isPlaying}
                onTogglePlaying={() => setIsPlaying((p) => !p)}
                timeTravel={timeTravel}
                onChangeTimeTravel={setTimeTravel}
                onResetTime={() => {
                  setTimeTravel(100)
                  playSound(500, 0.2)
                }}
                graphSpeed={graphSpeed}
                onChangeGraphSpeed={setGraphSpeed}
                soundEnabled={soundEnabled}
                onToggleSound={() => setSoundEnabled((s) => !s)}
                onAIAnalysis={generateAIInsight}
              />
            </div>
          )}
          {activeMobileComponent === 'ai' && (
            <div className="xv-mobile-component-wrapper">
              <AIInsight insight={aiInsight || "Request AI analysis from controls to see insights."} />
            </div>
          )}
        </div>
      )}

      <HUD nodes={effectiveNodes} score={score} />

      {!isMobile && (
        <NetworkStatsSidebar
          nodes={effectiveNodes}
          storageStats={storageStats}
          isSimulation={isSimulation}
          explorerOpen={explorerOpen}
          onToggleExplorer={() => setExplorerOpen((v) => !v)}
        />
      )}

      <div className={`xv-node3d-wrap ${activeMobileComponent || explorerOpen ? 'xv-blurred' : ''}`}>
        <Node3D
          nodes={effectiveNodes}
          isPlaying={isPlaying && !selectedNode}
          graphSpeed={graphSpeed}
          selectedNode={selectedNode}
          globalScale={isMobile ? 0.6 : 1}
          onSelectNode={(node) => {
            setSelectedNode(node)
            setExplorerOpen(true)
            setOpenedFromWarnings(false)
            playSound(600, 0.15)
            setScore((prev) => prev + 5)
          }}
        />
      </div>

      {!isMobile && (
        <ControlPanel
          isPlaying={isPlaying}
          onTogglePlaying={() => setIsPlaying((p) => !p)}
          timeTravel={timeTravel}
          onChangeTimeTravel={setTimeTravel}
          onResetTime={() => {
            setTimeTravel(100)
            playSound(500, 0.2)
          }}
          graphSpeed={graphSpeed}
          onChangeGraphSpeed={setGraphSpeed}
          soundEnabled={soundEnabled}
          onToggleSound={() => setSoundEnabled((s) => !s)}
          onAIAnalysis={generateAIInsight}
        />
      )}

      {!isMobile && <AIInsight insight={aiInsight} />}

      {explorerOpen && (
        <div
          className="xv-explorer-backdrop"
          onClick={() => setExplorerOpen(false)}
          aria-hidden="true"
        />
      )}

      <NodeExplorer
        open={explorerOpen}
        node={selectedNode}
        onClose={() => setExplorerOpen(false)}
        onBack={openedFromWarnings ? () => {
          setExplorerOpen(false)
          setShowWarnings(true)
          setOpenedFromWarnings(false)
        } : undefined}
      />

      <SimulationIndicator visible={isSimulation} />

      <div className="xv-stats-container">
        <div className="xv-stats-col">
          <div className="xv-stat">
            <Users className="xv-icon" />
            <span>AVG UPTIME: {avgUptime.toFixed(1)}%</span>
          </div>

          <div
            className="xv-stat xv-stat-clickable"
            onClick={() => setShowWarnings(true)}
            style={{ cursor: 'pointer' }}
          >
            <MessageSquare className="xv-icon" />
            <span>WARNINGS: {warningsCount}</span>
          </div>
        </div>

        <button
          className={`xv-brain-btn ${showBrainInsights ? 'active' : ''}`}
          onClick={() => {
            setShowBrainInsights(!showBrainInsights)
            if (!showBrainInsights) setActiveMobileComponent(null) // Close other overlays
          }}
        >
          <img src={brainIcon} alt="AI Insight" />
        </button>
      </div>

      {showBrainInsights && (
        <div className="xv-mobile-ai-ticker">
          <div className="xv-ai-ticker-content">
            {aiInsight ? (
              <div className="xv-ai-ticker-item">{aiInsight}</div>
            ) : (
              <div className="xv-ai-ticker-item">System analyzing network patterns... Click Controls to generate insight.</div>
            )}
            <div className="xv-ai-ticker-item">Optimal node distribution detected in EU region.</div>
            <div className="xv-ai-ticker-item">Storage capacity at 45% utilization.</div>
          </div>
        </div>
      )}

      {showWarnings && (
        <div className="xv-modal-overlay" onClick={() => setShowWarnings(false)}>
          <div className="xv-modal" onClick={e => e.stopPropagation()}>
            <div className="xv-modal-head">
              <span>SYSTEM WARNINGS</span>
              <button onClick={() => setShowWarnings(false)}><X className="xv-icon" /></button>
            </div>
            <div className="xv-modal-body">
              {effectiveNodes.filter(n => n.health === 'warning').length > 0 ? (
                effectiveNodes.filter(n => n.health === 'warning').map(node => (
                  <div
                    key={node.id}
                    className="xv-warning-item"
                    onClick={() => {
                      setSelectedNode(node)
                      setExplorerOpen(true)
                      setShowWarnings(false)
                      setOpenedFromWarnings(true)
                      playSound(600, 0.15)
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <span className="xv-warning-id" title={node.id}>{shortenNodeId(node.id)}</span>
                    <span className="xv-warning-msg">Uptime: {node.uptime}% - Check connectivity</span>
                  </div>
                ))
              ) : (
                <div className="xv-success-msg">All systems operational. No active warnings.</div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="xv-help">
        <div className="xv-help-title">CONTROLS</div>
        <div>Click nodes for details</div>
        <div>Use time slider to explore history</div>
        <div>Request AI insights for predictions</div>
      </div>
    </div>
  )
}

export default XanVision
