import React, { useState, useRef, useEffect } from 'react';

const KebabMenu = ({ children }) => {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={menuRef}>
            <button type="button" aria-label="Abrir menu de ações" aria-haspopup="menu" aria-expanded={isOpen} onClick={() => setIsOpen(!isOpen)} className="icon-button">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"></path></svg>
            </button>
            {isOpen && (
                <div role="menu" className="action-menu-dropdown absolute right-0 z-10 mt-1 w-40 origin-top-right rounded-lg border border-border bg-surface py-1 shadow-lg">
                    {children}
                </div>
            )}
        </div>
    );
};

export default KebabMenu;
