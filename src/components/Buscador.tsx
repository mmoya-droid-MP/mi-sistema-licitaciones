import React, { useRef, useCallback } from 'react';

interface BuscadorProps {
  onSearch?: (query: string) => void;
  onSearchChange?: (query: string) => void;
  placeholder?: string;
  className?: string;
  initialValue?: string;
}

export const Buscador: React.FC<BuscadorProps> = ({
  onSearch,
  onSearchChange,
  placeholder = 'Buscar por código (ej: 425-37-LP26), nombre u organismo...',
  className = 'w-full px-4 py-2 border rounded-lg shadow-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500',
  initialValue = ''
}) => {
  // useRef hace que el navegador escriba directo en pantalla a 60 FPS sin esperar a React
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const notifyChange = useCallback(
    (val: string) => {
      if (onSearch) onSearch(val);
      if (onSearchChange) onSearchChange(val);
    },
    [onSearch, onSearchChange]
  );

  // Manejador ultra-rápido que no congela la pantalla al presionar o borrar teclas
  const handleInputChange = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    // Espera 350ms después de que dejas de escribir para ejecutar la búsqueda pesada
    timerRef.current = setTimeout(() => {
      if (inputRef.current) {
        notifyChange(inputRef.current.value);
      }
    }, 350);
  }, [notifyChange]);

  const handleClear = () => {
    if (inputRef.current) {
      inputRef.current.value = '';
      notifyChange('');
    }
  };

  return (
    <div className="relative w-full my-4">
      <input
        ref={inputRef}
        type="text"
        defaultValue={initialValue}
        onChange={handleInputChange}
        placeholder={placeholder}
        className={className}
      />
      <button
        type="button"
        onClick={handleClear}
        className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 text-sm font-semibold"
      >
        Limpiar
      </button>
    </div>
  );
};

export default Buscador;
