import React from 'react';

const ChartLoadingPlaceholder: React.FC<{ height?: number }> = ({ height = 250 }) => {
  return (
    <div 
      style={{
        width: '100%',
        height: `${height}px`,
        backgroundColor: '#f3f4f6',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: '-100%',
          width: '100%',
          height: '100%',
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
          animation: 'shimmer 1.5s infinite'
        }}
      />
      <style>{`
        @keyframes shimmer {
          to {
            left: 100%;
          }
        }
      `}</style>
      <span style={{ color: '#9ca3af', fontSize: '14px' }}>Cargando gráfico...</span>
    </div>
  );
};

export default ChartLoadingPlaceholder;