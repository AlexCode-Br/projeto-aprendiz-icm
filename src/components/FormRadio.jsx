import React, { forwardRef } from 'react';

const FormRadio = forwardRef(({ checked, onChange, disabled, label, description, className = '', id, name, value, ...props }, ref) => {
    return (
        <label className={`flex items-start gap-3 cursor-pointer group ${disabled ? 'opacity-60 cursor-not-allowed' : ''} ${className}`}>
            <div className="relative flex items-center justify-center mt-0.5 shrink-0">
                <input
                    type="radio"
                    id={id}
                    name={name}
                    value={value}
                    checked={checked}
                    onChange={onChange}
                    disabled={disabled}
                    ref={ref}
                    className="peer appearance-none h-5 w-5 rounded-full border border-border bg-surface checked:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface transition-all"
                    {...props}
                />
                <div className="absolute w-2.5 h-2.5 rounded-full bg-primary pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity transform scale-50 peer-checked:scale-100"></div>
            </div>
            {(label || description) && (
                <div className="flex flex-col">
                    {label && <span className={`text-sm font-medium ${checked ? 'text-text-default' : 'text-text-default'} transition-colors`}>{label}</span>}
                    {description && <span className="text-sm text-text-muted">{description}</span>}
                </div>
            )}
        </label>
    );
});

FormRadio.displayName = 'FormRadio';
export default FormRadio;
