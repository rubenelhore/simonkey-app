import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface StudyTimeData {
  dia: string;
  tiempo: number;
}

interface WeeklyStudyChartProps {
  data: StudyTimeData[];
}

const WeeklyStudyChart: React.FC<WeeklyStudyChartProps> = ({ data }) => {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="dia" />
        <YAxis 
          label={{ value: 'Minutos', angle: -90, position: 'insideLeft' }}
          tickFormatter={(value) => `${value}m`}
        />
        <Tooltip 
          formatter={(value: any) => [`${value} minutos`, 'Tiempo de estudio']}
          labelFormatter={(label) => `${label}`}
          contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', border: '1px solid #e5e7eb' }}
        />
        <Bar 
          dataKey="tiempo" 
          fill="#10B981" 
          radius={[8, 8, 0, 0]}
          animationDuration={800}
        />
      </BarChart>
    </ResponsiveContainer>
  );
};

export default WeeklyStudyChart;