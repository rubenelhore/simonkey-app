import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface ConceptProgressData {
  fecha: string;
  dominados: number;
  aprendiendo: number;
  total: number;
}

interface ConceptProgressChartProps {
  data: ConceptProgressData[];
}

const ConceptProgressChart: React.FC<ConceptProgressChartProps> = ({ data }) => {
  // Formatear el tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          padding: '10px',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <p style={{ margin: 0, fontWeight: 'bold', color: '#374151' }}>
            {label}
          </p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ margin: '4px 0', color: entry.color, fontSize: '0.875rem' }}>
              {entry.name}: {entry.value} conceptos
            </p>
          ))}
          {payload[0] && payload[1] && (
            <p style={{ margin: '4px 0', color: '#6b7280', fontSize: '0.75rem', borderTop: '1px solid #e5e7eb', paddingTop: '4px' }}>
              Porcentaje dominado: {((payload[0].value / (payload[0].value + payload[1].value)) * 100).toFixed(1)}%
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  // Si no hay datos o todos los valores son 0, mostrar gráfico vacío con estructura
  const emptyData = data.length === 0 || data.every(d => d.dominados === 0 && d.aprendiendo === 0);
  
  // Datos de ejemplo para mostrar estructura cuando está vacío
  const displayData = emptyData ? [
    { fecha: '01/01', dominados: 0, aprendiendo: 0, total: 0 },
    { fecha: '15/01', dominados: 0, aprendiendo: 0, total: 0 },
    { fecha: '01/02', dominados: 0, aprendiendo: 0, total: 0 },
    { fecha: '15/02', dominados: 0, aprendiendo: 0, total: 0 },
    { fecha: 'Hoy', dominados: 0, aprendiendo: 0, total: 0 }
  ] : data;

  return (
    <>
      {emptyData && (
        <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem', textAlign: 'center' }}>
          El progreso de conceptos se irá registrando con el tiempo
        </div>
      )}
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={displayData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis 
          dataKey="fecha" 
          tick={{ fontSize: 12 }}
          angle={-45}
          textAnchor="end"
          height={60}
        />
        <YAxis 
          label={{ value: 'Conceptos', angle: -90, position: 'insideLeft' }}
          domain={[0, emptyData ? 10 : 'dataMax + 5']}
          ticks={emptyData ? [0, 2, 4, 6, 8, 10] : undefined}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend 
          wrapperStyle={{ paddingTop: '10px' }}
          iconType="circle"
        />
        <Line 
          type="monotone" 
          dataKey="dominados" 
          stroke="#10B981" 
          strokeWidth={3}
          dot={{ fill: '#10B981', r: 4 }}
          activeDot={{ r: 6 }}
          name="Dominados"
        />
        <Line 
          type="monotone" 
          dataKey="aprendiendo" 
          stroke="#F59E0B" 
          strokeWidth={2}
          strokeDasharray="5 5"
          dot={{ fill: '#F59E0B', r: 3 }}
          activeDot={{ r: 5 }}
          name="Aprendiendo"
        />
        <Line 
          type="monotone" 
          dataKey="total" 
          stroke="#6B7280" 
          strokeWidth={1}
          strokeDasharray="2 2"
          dot={false}
          name="Total"
          opacity={0.5}
        />
      </LineChart>
    </ResponsiveContainer>
    </>
  );
};

export default ConceptProgressChart;