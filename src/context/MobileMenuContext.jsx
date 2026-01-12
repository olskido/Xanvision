import { createContext, useContext, useState, useCallback } from 'react'

const MobileMenuContext = createContext(null)

export function MobileMenuProvider({ children }) {
    const [isOpen, setIsOpen] = useState(false)
    const [items, setItems] = useState([])

    // Register items: { id, label, onClick, priority, section }
    // priority: lower number = higher up
    // section: 'global' | 'page'
    const registerItems = useCallback((newItems) => {
        setItems((prev) => {
            // Filter out existing items with same ID to avoid duplicates if re-registering
            const filtered = prev.filter(p => !newItems.find(n => n.id === p.id))
            return [...filtered, ...newItems].sort((a, b) => {
                if (a.section !== b.section) {
                    return a.section === 'global' ? -1 : 1
                }
                return (a.priority || 0) - (b.priority || 0)
            })
        })
    }, [])

    const unregisterItems = useCallback((ids) => {
        setItems((prev) => prev.filter((item) => !ids.includes(item.id)))
    }, [])

    const open = useCallback(() => setIsOpen(true), [])
    const close = useCallback(() => setIsOpen(false), [])
    const toggle = useCallback(() => setIsOpen((v) => !v), [])

    return (
        <MobileMenuContext.Provider
            value={{
                isOpen,
                items,
                registerItems,
                unregisterItems,
                open,
                close,
                toggle,
            }}
        >
            {children}
        </MobileMenuContext.Provider>
    )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useMobileMenu() {
    const context = useContext(MobileMenuContext)
    if (!context) {
        throw new Error('useMobileMenu must be used within a MobileMenuProvider')
    }
    return context
}
