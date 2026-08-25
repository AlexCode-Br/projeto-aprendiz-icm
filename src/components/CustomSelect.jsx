import React, { useState, useEffect, useRef } from 'react';

const CustomSelect = ({ options, placeholder, value, onChange, containerId }) => {
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (option) => {
        onChange(option);
        setIsOpen(false);
    };
    
    const displayValue = value?.label || placeholder;

    return (
        <div ref={wrapperRef} id={containerId} className="relative custom-select-container">
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center justify-between w-full px-3 py-2 bg-surface border border-border rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
            >
                <span className="text-sm text-text-default truncate">{displayValue}</span>
                <svg className={`w-4 h-4 ml-2 text-text-muted transform transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                </svg>
            </button>

            {isOpen && (
                <ul className="custom-select-options absolute top-full left-0 right-0 mt-1 bg-surface border border-border rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto">
                    <li
                        onClick={() => handleSelect(null)}
                        className="px-3 py-2 text-sm text-text-muted hover:bg-gray-100 dark:hover:bg-gray-50/10 cursor-pointer"
                    >
                        {placeholder}
                    </li>
                    {options.map(option => (
                        <li
                            key={option.value}
                            onClick={() => handleSelect(option)}
                            className="px-3 py-2 text-sm text-text-default hover:bg-gray-100 dark:hover:bg-gray-50/10 cursor-pointer truncate"
                        >
                            {option.label}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default CustomSelect;
