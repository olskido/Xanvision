import { useEffect, useRef } from 'react'
import './Node3D.css'

export default function Node3D({
  nodes,
  isPlaying,
  graphSpeed,
  selectedNode,
  onSelectNode,
  globalScale = 1,
}) {
  const canvasRef = useRef(null)
  const animationRef = useRef(null)
  const nodesRef = useRef(nodes)
  const selectedNodeRef = useRef(selectedNode)
  const isPlayingRef = useRef(isPlaying)
  const graphSpeedRef = useRef(graphSpeed)
  const rotationRef = useRef(0)
  const lastFrameRef = useRef(0)
  const zoomRef = useRef(1)

  const CLICK_RADIUS_PX = 18

  const handleCanvasClick = (e) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const centerX = rect.width / 2
    const centerY = rect.height / 2
    const rot = (rotationRef.current * Math.PI) / 180
    const currentScale = globalScale * zoomRef.current

    let closestNode = null
    let minDist = Infinity

    nodesRef.current.forEach((node) => {
      const nx = node.x * Math.cos(rot) - node.z * Math.sin(rot)
      const nz = node.x * Math.sin(rot) + node.z * Math.cos(rot)
      const scale = (1 / (1 + nz / 400)) * currentScale
      const screenX = centerX + nx * scale
      const screenY = centerY + node.y * scale

      const hitRadius = CLICK_RADIUS_PX + (1 - Math.min(1, Math.max(0, scale))) * 10
      const dist = Math.sqrt((x - screenX) ** 2 + (y - screenY) ** 2)
      if (dist < hitRadius && dist < minDist) {
        minDist = dist
        closestNode = node
      }
    })

    if (closestNode) {
      onSelectNode?.(closestNode)
    } else {
      // Deselect if clicking on empty space
      onSelectNode?.(null)
    }
  }

  const isDraggingRef = useRef(false)
  const lastMouseXRef = useRef(0)

  const handlePointerDown = (e) => {
    isDraggingRef.current = true
    lastMouseXRef.current = e.clientX || e.touches?.[0]?.clientX
  }

  const handlePointerMove = (e) => {
    if (!isDraggingRef.current) return
    const clientX = e.clientX || e.touches?.[0]?.clientX
    const delta = clientX - lastMouseXRef.current
    lastMouseXRef.current = clientX

    // Adjust sensitivity as needed
    rotationRef.current += delta * 0.5
  }

  const handlePointerUp = () => {
    isDraggingRef.current = false
  }

  const handleWheel = (e) => {
    e.preventDefault()
    const delta = -Math.sign(e.deltaY) * 0.1
    zoomRef.current = Math.max(0.5, Math.min(3, zoomRef.current + delta))
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (canvas) {
      canvas.addEventListener('wheel', handleWheel, { passive: false })

      // Touch events for mobile rotation
      canvas.addEventListener('touchstart', handlePointerDown, { passive: true })
      canvas.addEventListener('touchmove', handlePointerMove, { passive: true })
      canvas.addEventListener('touchend', handlePointerUp)

      // Mouse events for desktop manual rotation (optional but good)
      canvas.addEventListener('mousedown', handlePointerDown)
      window.addEventListener('mousemove', handlePointerMove)
      window.addEventListener('mouseup', handlePointerUp)

      return () => {
        canvas.removeEventListener('wheel', handleWheel)
        canvas.removeEventListener('touchstart', handlePointerDown)
        canvas.removeEventListener('touchmove', handlePointerMove)
        canvas.removeEventListener('touchend', handlePointerUp)
        canvas.removeEventListener('mousedown', handlePointerDown)
        window.removeEventListener('mousemove', handlePointerMove)
        window.removeEventListener('mouseup', handlePointerUp)
      }
    }
  }, [])

  useEffect(() => {
    nodesRef.current = nodes
  }, [nodes])

  useEffect(() => {
    selectedNodeRef.current = selectedNode
  }, [selectedNode])

  useEffect(() => {
    isPlayingRef.current = isPlaying
  }, [isPlaying])

  useEffect(() => {
    graphSpeedRef.current = Number(graphSpeed) || 0
  }, [graphSpeed])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      const width = (canvas.width = canvas.offsetWidth * 2)
      const height = (canvas.height = canvas.offsetHeight * 2)
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.scale(2, 2)
      return { width, height }
    }

    let { width, height } = resize()
    const cx = () => width / 4
    const cy = () => height / 4

    const animate = (t) => {
      const last = lastFrameRef.current || t
      const dt = Math.min(0.05, (t - last) / 1000)
      lastFrameRef.current = t

      if (isPlayingRef.current && !isDraggingRef.current) {
        const speed = Math.max(0, Math.min(1, graphSpeedRef.current))
        rotationRef.current = (rotationRef.current + dt * 10 * speed) % 360
      }

      ctx.fillStyle = 'rgba(0, 0, 0, 0.95)'
      ctx.fillRect(0, 0, width / 2, height / 2)

      const currentScale = globalScale * zoomRef.current

      ctx.strokeStyle = 'rgba(0, 255, 255, 0.1)'
      ctx.lineWidth = 0.5
      for (let i = -300; i < 300; i += 30) {
        // Grid lines also need scaling if we want them to zoom? 
        // Or keep grid static? Usually grid zooms too.
        // Let's keep grid static for context, or scale it?
        // User said "3d graph ... can be zoom in".
        // Scaling grid is complex with this simple loop. 
        // Let's leave grid static or just scale the nodes/connections.
        // Scaling nodes only might look weird against static grid.
        // I'll scale grid too.
        const scaledI = i * currentScale
        ctx.beginPath()
        ctx.moveTo(cx() + scaledI, 0)
        ctx.lineTo(cx() + scaledI, height / 2)
        ctx.stroke()

        ctx.beginPath()
        ctx.moveTo(0, cy() + scaledI)
        ctx.lineTo(width / 2, cy() + scaledI)
        ctx.stroke()
      }

      const rot = (rotationRef.current * Math.PI) / 180

      ctx.strokeStyle = 'rgba(0, 200, 255, 0.2)'
      ctx.lineWidth = 1
      const currentNodes = nodesRef.current
      for (let i = 0; i < currentNodes.length; i++) {
        for (let j = i + 1; j < Math.min(i + 4, currentNodes.length); j++) {
          const n1 = currentNodes[i]
          const n2 = currentNodes[j]

          const x1 = n1.x * Math.cos(rot) - n1.z * Math.sin(rot)
          const z1 = n1.x * Math.sin(rot) + n1.z * Math.cos(rot)
          const s1 = (1 / (1 + z1 / 400)) * currentScale

          const x2 = n2.x * Math.cos(rot) - n2.z * Math.sin(rot)
          const z2 = n2.x * Math.sin(rot) + n2.z * Math.cos(rot)
          const s2 = (1 / (1 + z2 / 400)) * currentScale

          if (z1 > -200 && z2 > -200) {
            ctx.beginPath()
            ctx.moveTo(cx() + x1 * s1, cy() + n1.y * s1)
            ctx.lineTo(cx() + x2 * s2, cy() + n2.y * s2)
            ctx.stroke()
          }
        }
      }

      const sel = selectedNodeRef.current
      currentNodes.forEach((node) => {
        if (!Number.isFinite(node.x) || !Number.isFinite(node.y) || !Number.isFinite(node.z)) {
          return
        }

        const x = node.x * Math.cos(rot) - node.z * Math.sin(rot)
        const z = node.x * Math.sin(rot) + node.z * Math.cos(rot)
        if (z < -200) return

        const scale = (1 / (1 + z / 400)) * currentScale
        const screenX = cx() + x * scale
        const screenY = cy() + node.y * scale
        const size = 3 * scale

        if (!Number.isFinite(screenX) || !Number.isFinite(screenY) || !Number.isFinite(size) || size <= 0) {
          return
        }

        const gradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, size * 3)
        gradient.addColorStop(
          0,
          node.health === 'excellent'
            ? 'rgba(0, 255, 100, 0.6)'
            : node.health === 'good'
              ? 'rgba(0, 200, 255, 0.6)'
              : 'rgba(255, 100, 0, 0.6)',
        )
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)')

        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(screenX, screenY, size * 3, 0, Math.PI * 2)
        ctx.fill()

        ctx.fillStyle =
          node.health === 'excellent' ? '#00ff66' : node.health === 'good' ? '#00ccff' : '#ff6600'
        ctx.beginPath()
        ctx.arc(screenX, screenY, size, 0, Math.PI * 2)
        ctx.fill()

        if (sel && sel.id === node.id) {
          const pulse = Math.sin(Date.now() / 200) * 0.5 + 0.5
          ctx.strokeStyle = `rgba(255, 255, 255, ${pulse})`
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.arc(screenX, screenY, size * 2 + pulse * 5, 0, Math.PI * 2)
          ctx.stroke()
        }
      })

      animationRef.current = requestAnimationFrame(animate)
    }

    const onResize = () => {
      ; ({ width, height } = resize())
    }

    window.addEventListener('resize', onResize)
    animationRef.current = requestAnimationFrame(animate)

    return () => {
      window.removeEventListener('resize', onResize)
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
    }
  }, [globalScale]) // Re-run if globalScale changes

  return <canvas ref={canvasRef} onClick={handleCanvasClick} className="node3d-canvas" />
}
