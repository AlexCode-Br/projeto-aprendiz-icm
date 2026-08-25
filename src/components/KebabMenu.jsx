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
            <button onClick={() => setIsOpen(!isOpen)} className="p-2 text-text-muted hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"></path></svg>
            </button>
            {isOpen && (
                <div className="action-menu-dropdown absolute right-0 mt-1 w-40 bg-white dark:bg-surface rounded-md shadow-lg py-1 z-10 origin-top-right ring-1 ring-black ring-opacity-5">
                    {children}
                </div>
            )}
        </div>
    );
};

export default KebabMenu;