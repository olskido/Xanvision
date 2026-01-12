import { useState, useEffect } from 'react'
import './AIInsight.css'

export default function AIInsight({ insight }) {
  const [displayedText, setDisplayedText] = useState('')
  const [isTyping, setIsTyping] = useState(false)

  useEffect(() => {
    if (!insight) return

    setDisplayedText('')
    setIsTyping(true)
    let index = 0

    // Typing speed usually ~30ms per char for "hacker" feel
    const intervalId = setInterval(() => {
      setDisplayedText(insight.slice(0, index + 1))
      index++
      if (index >= insight.length) {
        clearInterval(intervalId)
        setIsTyping(false)
      }
    }, 30)

    return () => clearInterval(intervalId)
  }, [insight])

  if (!insight) return null

  return (
    <div className={`xv-ai-panel ${isTyping ? 'typing' : ''}`}>
      <div className="xv-ai-title">AI CO-PILOT INSIGHT</div>
      <p className="xv-ai-text">
        {displayedText}
        {isTyping && <span className="xv-cursor">█</span>}
      </p>
    </div>
  )
}
