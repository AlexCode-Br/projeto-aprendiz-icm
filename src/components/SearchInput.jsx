import React, { forwardRef } from 'react';
import { Search, X } from 'lucide-react';

const SearchInput = forwardRef(({ value, onChange, className = '', placeholder = 'Pesquisar...', ...props }, ref) => <div className={`relative min-w-0 ${className.replace(/\bform-control\b/g, '')}`}>
    <Search aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
    <input {...props} ref={ref} aria-label={props['aria-label'] || placeholder} type="search" value={value} onChange={onChange} placeholder={placeholder} className="form-control pl-11 pr-11 [&::-webkit-search-cancel-button]:appearance-none" />
    {value && <button type="button" onClick={() => onChange({ target: { value: '', name: props.name } })} className="icon-button absolute right-0 top-0" aria-label="Limpar busca"><X aria-hidden="true" className="!h-4 !w-4" /></button>}
</div>);
SearchInput.displayName = 'SearchInput';
export default SearchInput;
