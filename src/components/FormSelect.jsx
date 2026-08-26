import React, { forwardRef } from 'react';
import Select from 'react-select';

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
                return formattedOptions?.filter(opt => value.includes(opt.value)) || [];
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
            classNamePrefix="react-select"
            className={className}
            unstyled
            menuPortalTarget={document.body}
            menuPosition="fixed"
            styles={{ menuPortal: base => ({ ...base, zIndex: 9999 }) }}
            classNames={{
                control: ({ isFocused, isDisabled }) =>
                    `min-h-11 w-full rounded-lg border bg-surface text-sm transition-colors cursor-pointer ` +
                    (isDisabled ? 'opacity-60 cursor-not-allowed bg-gray-100 dark:bg-gray-800 ' : 'hover:border-gray-400 ') +
                    (invalid ? 'border-danger focus-within:border-danger focus-within:ring-1 focus-within:ring-danger ' : 'border-border ') +
                    (isFocused && !invalid ? 'border-gray-400 ring-1 ring-gray-400/30 dark:border-gray-500 dark:ring-gray-500/30 ' : ''),
                valueContainer: () => 'px-3.5 py-1.5 gap-1',
                placeholder: () => 'text-text-muted',
                input: () => 'text-text-default caret-text-default focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0',
                singleValue: () => 'text-text-default',
                multiValue: () => 'bg-primary/10 text-primary rounded-md px-2 py-0.5 text-xs font-semibold mr-1 flex items-center',
                multiValueLabel: () => 'mr-1',
                multiValueRemove: () => 'hover:text-danger hover:bg-danger/10 rounded px-0.5',
                indicatorsContainer: () => 'px-2 text-text-muted',
                clearIndicator: () => 'hover:text-danger p-1',
                dropdownIndicator: ({ isFocused }) => `p-1 ${isFocused ? 'text-text-default' : 'text-text-muted'}`,
                menu: () => 'mt-1 mb-1 rounded-xl border border-border bg-surface shadow-lg overflow-hidden z-50',
                menuList: () => 'p-1 max-h-60 overflow-y-auto',
                option: ({ isFocused, isSelected }) =>
                    `px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors ` +
                    (isSelected ? 'bg-primary text-white font-medium ' : isFocused ? 'bg-surface-hover text-text-default ' : 'text-text-default hover:bg-surface-hover'),
                noOptionsMessage: () => 'text-text-muted text-sm py-4 text-center',
            }}
            {...props}
        />
    );
});

FormSelect.displayName = 'FormSelect';

export default FormSelect;
