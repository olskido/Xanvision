import { Menu, X } from 'lucide-react'
import { useMobileMenu } from '../../context/MobileMenuContext'
import './GlobalMenu.css'

export default function GlobalMenu() {
    const { isOpen, items, open, close } = useMobileMenu()

    return (
        <>
            {/* Hamburger Button - Visible only on mobile via CSS */}
            <button
                className="xv-global-menu-btn"
                onClick={open}
                aria-label="Open Menu"
            >
                <Menu className="xv-icon" />
            </button>

            {/* Menu Overlay */}
            {isOpen && (
                <div className="xv-global-menu-overlay" onClick={close}>
                    <div className="xv-global-menu" onClick={(e) => e.stopPropagation()}>
                        <div className="xv-global-menu-head">
                            <span>MENU</span>
                            <button onClick={close} aria-label="Close Menu">
                                <X className="xv-icon" />
                            </button>
                        </div>

                        <div className="xv-global-menu-items">
                            {items.map((item) => (
                                <button
                                    key={item.id}
                                    className={`xv-global-menu-item ${item.section === 'global' ? 'xv-item-global' : ''}`}
                                    onClick={() => {
                                        item.onClick()
                                        close()
                                    }}
                                >
                                    {item.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
