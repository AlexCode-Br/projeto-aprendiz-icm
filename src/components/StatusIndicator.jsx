import React from 'react';

const StatusIndicator = ({ status }) => {
  const isAtivo = status.toLowerCase() === 'ativo';
  const bgColor = isAtivo ? 'bg-green-500' : 'bg-gray-400';

  return (
    <div className="flex items-center space-x-2">
      <span className={`h-2.5 w-2.5 rounded-full ${bgColor}`}></span>
      <span className="text-sm text-gray-700">{status}</span>
    </div>
  );
};

export default StatusIndicator;