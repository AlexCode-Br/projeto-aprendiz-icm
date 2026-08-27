import React, { useState, useRef, useEffect } from 'react';
import { MoreVerticalIcon } from './icons/index.jsx';

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
            <button
                type="button"
                aria-label="Abrir menu de ações"
                aria-haspopup="menu"
                aria-expanded={isOpen}
                onClick={() => setIsOpen(s => !s)}
                className="icon-btn"
            >
                <MoreVerticalIcon className="w-5 h-5" />
            </button>
            {isOpen && (
                <div
                    role="menu"
                    className="absolute right-0 z-10 mt-1 w-44 origin-top-right rounded-xl border border-border bg-surface py-1 shadow-lg anim-scale-in"
                    onClick={() => setIsOpen(false)}
                >
                    {children}
                </div>
            )}
        </div>
    );
};

export default KebabMenu;
