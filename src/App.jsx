import { useMemo, useEffect } from 'react'
import { BrowserRouter, Link, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import TechwizPage from './components/TechwizPage/TechwizPage.jsx'
import XanVision from './components/XanVision/XanVision.jsx'
import Analytics from './pages/analytics/Analytics.jsx'
import { MobileMenuProvider, useMobileMenu } from './context/MobileMenuContext.jsx'
import GlobalMenu from './components/GlobalMenu/GlobalMenu.jsx'
import Footer from './components/Footer/Footer.jsx'

function generateFallbackNodes() {
  const nodeCount = 50
  const generatedNodes = []

  for (let i = 0; i < nodeCount; i++) {
    const lat = (Math.random() - 0.5) * 180
    const lon = (Math.random() - 0.5) * 360

    const uptime = Math.max(50, Math.min(100, 85 + Math.random() * 15))
    const storage = Math.floor(100 + Math.random() * 900)
    const peers = Math.floor(3 + Math.random() * 12)

    generatedNodes.push({
      id: `node_${i}`,
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

function Nav() {
  const location = useLocation()
  const navigate = useNavigate()
  const { registerItems, unregisterItems } = useMobileMenu()

  const isTechwiz = location.pathname.startsWith('/techwiz')
  const isAnalytics = location.pathname.startsWith('/analytics')
  const isMain = !isTechwiz && !isAnalytics

  // Register global navigation items for mobile menu
  useEffect(() => {
    const items = [
      { id: 'nav-main', label: 'MAIN', onClick: () => navigate('/'), section: 'global', priority: 1 },
      { id: 'nav-pnodes', label: 'PNODES', onClick: () => navigate('/techwiz'), section: 'global', priority: 2 },
      { id: 'nav-analytics', label: 'ANALYTICS', onClick: () => navigate('/analytics'), section: 'global', priority: 3 },
    ]
    registerItems(items)
    return () => unregisterItems(items.map(i => i.id))
  }, [registerItems, unregisterItems, navigate])

  return (
    <nav className="xv-nav">
      <Link className={isMain ? 'xv-nav-link xv-nav-link-active' : 'xv-nav-link'} to="/">
        MAIN
      </Link>
      <Link className={isTechwiz ? 'xv-nav-link xv-nav-link-active' : 'xv-nav-link'} to="/techwiz">
        PNODES
      </Link>
      <Link className={isAnalytics ? 'xv-nav-link xv-nav-link-active' : 'xv-nav-link'} to="/analytics">
        ANALYTICS
      </Link>
    </nav>
  )
}

function App() {
  // Provide stable fallback dataset to TechwizPage so it can render immediately.
  const fallbackNodes = useMemo(() => generateFallbackNodes(), [])

  return (
    <BrowserRouter>
      <MobileMenuProvider>
        <GlobalMenu />
        <Nav />
        <Routes>
          <Route path="/" element={<XanVision />} />
          <Route path="/techwiz" element={<TechwizPage fallbackNodes={fallbackNodes} />} />
          <Route path="/analytics" element={<Analytics />} />
        </Routes>
        <Footer />
      </MobileMenuProvider>
    </BrowserRouter>
  )
}

export default App