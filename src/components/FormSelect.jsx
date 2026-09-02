import React, { forwardRef } from 'react';
import Select from 'react-select';

const ariaLiveMessages = {
    guidance: ({ context, isSearchable }) => context === 'menu'
        ? 'Use as setas para navegar, Enter para selecionar e Escape para fechar.'
        : context === 'value' ? 'Use as setas para navegar entre os itens e Delete para remover.'
            : `${isSearchable ? 'Digite para pesquisar. ' : ''}Use a seta para baixo para abrir as opções.`,
    onChange: ({ action, label, labels, isDisabled }) => {
        if (isDisabled) return `${label} está indisponível.`;
        if (action === 'clear') return 'Seleção limpa.';
        if (['remove-value', 'pop-value', 'deselect-option'].includes(action)) return `${label} removido.`;
        return `${label || labels?.join(', ') || 'Item'} selecionado.`;
    },
    onFocus: ({ label, isSelected, isDisabled }) => `${label}${isDisabled ? ', indisponível' : isSelected ? ', selecionado' : ''}.`,
    onFilter: ({ inputValue, resultsMessage }) => `${resultsMessage}${inputValue ? ` Busca por ${inputValue}.` : ''}`,
};

const FormSelect = forwardRef(({
    id,
    name,
    options,
    value,
    onChange,
    onBlur,
    placeholder = 'Selecione...',
    isMulti = false,
    isClearable = true,
    isSearchable = true,
    isDisabled = false,
    isLoading = false,
    noOptionsMessage = () => 'Nenhuma opção encontrada',
    invalid = false,
    className,
    ...props
}, ref) => {

    // Helper to format options if they are simple arrays of strings/numbers
    const formattedOptions = Array.isArray(options) && options.length > 0 && typeof options[0] !== 'object'
        ? options.map(opt => ({ value: opt, label: String(opt) }))
        : options;

    const formattedValue = React.useMemo(() => {
        if (value === null || value === undefined || value === '') return null;
        if (isMulti) {
            if (Array.isArray(value)) {
                return formattedOptions?.filter(opt => value.some(item => String(item) === String(opt.value))) || [];
            }
            return [];
        }
        return formattedOptions?.find(opt => String(opt.value) === String(value)) || null;
    }, [value, formattedOptions, isMulti]);

    const handleChange = (selected) => {
        if (isMulti) {
            onChange({
                target: { name, value: selected ? selected.map(s => s.value) : [] }
            });
        } else {
            onChange({
                target: { name, value: selected ? selected.value : '' }
            });
        }
    };

    return (
        <Select
            ref={ref}
            inputId={id}
            aria-label={props['aria-label'] || (!id ? placeholder : undefined)}
            aria-invalid={invalid || undefined}
            name={name}
            options={formattedOptions}
            value={formattedValue}
            onChange={handleChange}
            onBlur={onBlur}
            placeholder={placeholder}
            isMulti={isMulti}
            isClearable={isClearable}
            isSearchable={isSearchable}
            isDisabled={isDisabled}
            isLoading={isLoading}
            noOptionsMessage={noOptionsMessage}
            loadingMessage={() => 'Carregando opções...'}
            screenReaderStatus={({ count }) => `${count} ${count === 1 ? 'opção disponível' : 'opções disponíveis'}.`}
            ariaLiveMessages={ariaLiveMessages}
            menuPlacement="auto"
            classNamePrefix="react-select"
            className={className}
            unstyled
            menuPortalTarget={document.body}
            menuPosition="fixed"
            styles={{ control: base => ({ ...base, minHeight: 44 }), menuPortal: base => ({ ...base, zIndex: 9999 }) }}
            classNames={{
                control: ({ isFocused, isDisabled }) =>
                    `min-h-11 w-full rounded-xl border bg-surface text-sm transition-colors cursor-pointer ` +
                    (isDisabled ? 'opacity-60 cursor-not-allowed bg-surface-muted ' : 'hover:border-gray-400 ') +
                    (invalid ? 'border-danger focus-within:border-danger focus-within:ring-1 focus-within:ring-danger ' : 'border-border ') +
                    (isFocused && !invalid ? 'border-primary ring-[3px] ring-primary/10 ' : ''),
                valueContainer: () => 'px-3.5 py-1.5 gap-1',
                placeholder: () => 'text-text-muted',
                input: () => 'text-text-default caret-text-default focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0',
                singleValue: () => 'text-text-default',
                multiValue: () => 'bg-primary/10 text-primary rounded-md px-2 py-0.5 text-xs font-semibold mr-1 flex items-center',
                multiValueLabel: () => 'mr-1',
                multiValueRemove: () => 'hover:text-danger hover:bg-danger/10 rounded px-0.5',
                indicatorsContainer: () => 'px-2 text-text-muted',
                clearIndicator: () => 'hover:text-danger p-2 cursor-pointer',
                dropdownIndicator: ({ isFocused }) => `p-2 ${isFocused ? 'text-text-default' : 'text-text-muted'}`,
                menu: () => 'mt-1 mb-1 rounded-xl border border-border bg-surface shadow-lg overflow-hidden z-50',
                menuList: () => 'p-1 max-h-60 overflow-y-auto',
                option: ({ isFocused, isSelected, isDisabled }) =>
                    `px-3 py-3 rounded-lg text-sm transition-colors ` +
                    (isDisabled ? 'cursor-not-allowed opacity-40 ' : 'cursor-pointer ') +
                    (isSelected ? 'bg-primary text-white font-medium ' : isFocused && !isDisabled ? 'bg-surface-hover text-text-default ' : 'text-text-default'),
                noOptionsMessage: () => 'text-text-muted text-sm py-4 text-center',
            }}
            {...props}
        />
    );
});

FormSelect.displayName = 'FormSelect';

export default FormSelect;
