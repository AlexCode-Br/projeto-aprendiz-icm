import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

const COLORS = ['#ef4444', '#f97316', '#84cc16', '#3b82f6', '#8b5cf6'];

const PopularCoursesChart = ({ data }) => {
  if (!data || data.length === 0) {
    return <p className="text-center text-gray-500">Não há dados de cursos para exibir.</p>;
  }

  return (
    <div style={{ width: '100%', height: 250 }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            fill="#8884d8"
            paddingAngle={5}
            dataKey="value"
            nameKey="name"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend iconSize={10} layout="vertical" verticalAlign="middle" align="right" />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export default PopularCoursesChart;