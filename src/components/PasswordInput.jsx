import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export default function PasswordInput({ className = '', ...props }) {
    const [visible, setVisible] = useState(false);
    return <span className="relative block">
        <input {...props} type={visible ? 'text' : 'password'} className={`form-control pr-12 ${className}`} />
        <button type="button" className="icon-button absolute right-0 top-0" aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={visible} onClick={() => setVisible(value => !value)}>
            {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
        </button>
    </span>;
}
