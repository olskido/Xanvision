import { useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Stars, AdaptiveDpr, Environment } from '@react-three/drei'
import * as THREE from 'three'
import './Globe3D.css'

function latLonToVec3(latDeg, lonDeg, radius) {
  const lat = (latDeg * Math.PI) / 180
  const lon = (lonDeg * Math.PI) / 180

  const x = radius * Math.cos(lat) * Math.cos(lon)
  const y = radius * Math.sin(lat)
  const z = radius * Math.cos(lat) * Math.sin(lon)

  return new THREE.Vector3(x, y, z)
}

function healthColor(health) {
  if (health === 'excellent') return '#00ff66'
  if (health === 'good') return '#00ccff'
  return '#ff6600'
}

function GlobeScene({ nodes, isPlaying, selectedNode, onSelectNode }) {
  const [hovered, setHovered] = useState(false)
  const glowRef = useRef(null)

  const radius = 2

  const nodePoints = useMemo(() => {
    return nodes.map((n) => ({
      ...n,
      position: latLonToVec3(n.lat, n.lon, radius + 0.05),
      color: new THREE.Color(healthColor(n.health)),
    }))
  }, [nodes])

  const linesGeometry = useMemo(() => {
    // Connect each node to a few neighbors (simple deterministic pattern)
    const positions = []
    for (let i = 0; i < nodePoints.length; i++) {
      for (let j = i + 1; j < Math.min(i + 4, nodePoints.length); j++) {
        const a = nodePoints[i].position
        const b = nodePoints[j].position
        positions.push(a.x, a.y, a.z, b.x, b.y, b.z)
      }
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    return geo
  }, [nodePoints])

  useFrame(({ clock }) => {
    if (!glowRef.current) return
    const t = clock.getElapsedTime()
    glowRef.current.material.opacity = 0.25 + Math.sin(t * 1.5) * 0.05
  })

  return (
    <group
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <Stars radius={90} depth={40} count={1200} factor={2} saturation={0} fade speed={0.5} />

      {/* Earth */}
      <mesh>
        <sphereGeometry args={[radius, 64, 64]} />
        <meshStandardMaterial color="#071018" metalness={0.2} roughness={0.75} />
      </mesh>

      {/* Wireframe cyan grid */}
      <mesh>
        <sphereGeometry args={[radius + 0.002, 40, 40]} />
        <meshBasicMaterial color="rgba(0,204,255,0.35)" wireframe transparent />
      </mesh>

      {/* Outer glow */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[radius + 0.06, 48, 48]} />
        <meshBasicMaterial color="rgba(0,204,255,0.35)" transparent opacity={0.25} />
      </mesh>

      {/* Connections */}
      <lineSegments geometry={linesGeometry}>
        <lineBasicMaterial color="rgba(0,200,255,0.25)" transparent />
      </lineSegments>

      {/* Nodes */}
      {nodePoints.map((n) => {
        const isSelected = selectedNode && selectedNode.id === n.id
        return (
          <group key={n.id} position={n.position.toArray()}>
            <mesh
              onPointerDown={(e) => {
                e.stopPropagation()
                onSelectNode?.(n)
              }}
            >
              <sphereGeometry args={[isSelected ? 0.05 : 0.035, 16, 16]} />
              <meshStandardMaterial emissive={n.color} emissiveIntensity={1.2} color={n.color} />
            </mesh>

            {isSelected ? (
              <mesh>
                <sphereGeometry args={[0.085, 16, 16]} />
                <meshBasicMaterial color="rgba(255,255,255,0.7)" transparent wireframe />
              </mesh>
            ) : null}
          </group>
        )
      })}

      <OrbitControls
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.6}
        zoomSpeed={0.7}
        minDistance={2.6}
        maxDistance={6.0}
        autoRotate={isPlaying}
        autoRotateSpeed={0.6}
      />

      {/* Subtle in-globe hint (handled by overlay div in parent) */}
      <mesh visible={false} userData={{ hovered }} />

      <ambientLight intensity={0.65} />
      <directionalLight position={[3, 2, 4]} intensity={0.75} />
      <Environment preset="night" />
    </group>
  )
}

export default function Globe3D({ nodes, isPlaying, selectedNode, onSelectNode }) {
  // Memoize canvas props to avoid re-creating WebGL context
  const dpr = useMemo(() => {
    if (typeof window === 'undefined') return 1
    return Math.min(2, window.devicePixelRatio || 1)
  }, [])

  return (
    <div className="globe3d-root">
      <Canvas
        dpr={dpr}
        camera={{ position: [0, 0, 4.2], fov: 45, near: 0.1, far: 200 }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
      >
        <color attach="background" args={[0x000000]} />
        <AdaptiveDpr pixelated />
        <GlobeScene
          nodes={nodes}
          isPlaying={isPlaying}
          selectedNode={selectedNode}
          onSelectNode={onSelectNode}
        />
      </Canvas>

      <div className="globe3d-hint">Drag to rotate • Scroll to zoom</div>
    </div>
  )
}
