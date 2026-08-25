import React from 'react';

const CustomSelect = ({ options, placeholder, value, onChange, containerId = 'course-select' }) => {
    return (
        <label htmlFor={containerId}>
            <span className="form-label">Curso</span>
            <select id={containerId} value={value?.value || ''} onChange={event => onChange(options.find(option => String(option.value) === event.target.value) || null)} className="form-control">
                <option value="">{placeholder}</option>
                {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
        </label>
    );
};

export default CustomSelect;
