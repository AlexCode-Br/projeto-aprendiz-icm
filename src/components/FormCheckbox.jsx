import { Check } from 'lucide-react';
import React, { forwardRef } from 'react';

const FormCheckbox = forwardRef(({ checked, onChange, disabled, label, description, className = '', id, name, ...props }, ref) => {
    return (
        <label className={`flex items-start gap-3 cursor-pointer group ${disabled ? 'opacity-60 cursor-not-allowed' : ''} ${className}`}>
            <div className="relative flex items-center justify-center mt-0.5 shrink-0">
                <input
                    type="checkbox"
                    id={id}
                    name={name}
                    checked={checked}
                    onChange={onChange}
                    disabled={disabled}
                    ref={ref}
                    className="peer appearance-none h-5 w-5 rounded-[4px] border border-border bg-surface checked:bg-primary checked:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface transition-all"
                    {...props}
                />
                <Check aria-hidden="true" className="absolute w-3.5 h-3.5 pointer-events-none opacity-0 peer-checked:opacity-100 text-white stroke-current transition-opacity" />
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

FormCheckbox.displayName = 'FormCheckbox';
export default FormCheckbox;
