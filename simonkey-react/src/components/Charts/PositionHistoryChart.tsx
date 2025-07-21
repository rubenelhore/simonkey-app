import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface PositionData {
  semana: string;
  posicion: number;
}

interface PositionHistoryChartProps {
  data: PositionData[];
}

const PositionHistoryChart: React.FC<PositionHistoryChartProps> = ({ data }) => {
  return (
    <>
      {data.length > 0 && data.every(d => d.posicion === data[0].posicion) && (
        <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem', textAlign: 'center' }}>
          El historial de posiciones se irá construyendo con el tiempo
        </div>
      )}
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="semana" 
            tick={{ fontSize: 12 }}
            angle={-45}
            textAnchor="end"
            height={60}
          />
          <YAxis 
            reversed={true}
            domain={[1, 'dataMax']}
            ticks={[1, 5, 10, 15, 20]}
            label={{ value: 'Posición', angle: -90, position: 'insideLeft' }}
          />
          <Tooltip 
            formatter={(value: any) => [`Posición #${value}`, 'Ranking']}
            labelFormatter={(label) => `Semana del ${label}`}
          />
          <Line 
            type="monotone" 
            dataKey="posicion" 
            stroke="#8B5CF6" 
            strokeWidth={3}
            dot={{ fill: '#8B5CF6', r: 6 }}
            activeDot={{ r: 8 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </>
  );
};

export default PositionHistoryChart;