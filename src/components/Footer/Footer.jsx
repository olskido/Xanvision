import './Footer.css'
import githubIcon from '../../assets/socials/github.png'
import telegramIcon from '../../assets/socials/telegram.png'
import xIcon from '../../assets/socials/x.png'
import discordIcon from '../../assets/socials/discord.png'

export default function Footer() {
    return (
        <footer className="xv-footer">
            <div className="xv-footer-content">
                {/* Left Section */}
                <div className="xv-footer-left">
                    <div className="xv-footer-title">
                        XANVISION
                        <span className="xv-footer-subtitle"> HOLOGRAPHIC PNODES ANALYTICS PLATFORM</span>
                    </div>
                    <div className="xv-footer-copyright">
                        © 2025 vision
                    </div>
                </div>

                {/* Middle Section */}
                <div className="xv-footer-center">
                    <a href="https://xandeum.com" target="_blank" rel="noopener noreferrer" className="xv-footer-link">
                        xandeum
                    </a>
                    <a href="https://docs.xandeum.network/" className="xv-footer-link">
                        documentation
                    </a>
                    <a href="https://xandsol.xandeum.network/validators" className="xv-footer-link">
                        validators
                    </a>
                </div>

                {/* Right Section */}
                <div className="xv-footer-right">
                    <a href="https://github.com/olskido" className="xv-social-link" aria-label="Github">
                        <img src={githubIcon} alt="Github" />
                    </a>
                    <a href="https://t.me/olskido" className="xv-social-link" aria-label="Telegram">
                        <img src={telegramIcon} alt="Telegram" />
                    </a>
                    <a href="https://x.com/olskiddo" className="xv-social-link" aria-label="X">
                        <img src={xIcon} alt="X" />
                    </a>
                    <a href="https://discord.gg/olskido" className="xv-social-link" aria-label="Discord">
                        <img src={discordIcon} alt="Discord" />
                    </a>
                </div>
            </div>
        </footer>
    )
}
