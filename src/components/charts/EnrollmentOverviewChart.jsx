import React, { useEffect, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import useDarkMode from '../../hooks/useDarkMode';

// Register the necessary components for Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const EnrollmentOverviewChart = ({ data = [] }) => {
    const [isDark] = useDarkMode();
    
    // Data extracted from the HTML prototype script
    const chartData = {
        labels: data.map(item => item.curso),
        datasets: [{
            label: 'Total de Inscrições',
            data: data.map(item => item.total),
            backgroundColor: 'rgba(183, 28, 28, 0.8)',
            borderColor: 'rgba(183, 28, 28, 1)',
            borderWidth: 1,
            borderRadius: 6,
            maxBarThickness: 28,
            hoverBackgroundColor: 'rgba(183, 28, 28, 1)',
        }]
    };

    const [chartOptions, setChartOptions] = useState({});

    useEffect(() => {
        // This effect updates chart colors when the theme changes
        const textColor = isDark ? '#B0B3B8' : '#6C757D';
        const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)';
        
        setChartOptions({
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: { color: textColor, precision: 0 },
                    grid: { color: gridColor },
                },
                y: {
                    ticks: { color: textColor },
                    grid: { display: false },
                },
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    displayColors: false,
                    backgroundColor: isDark ? '#242526' : '#FFFFFF',
                    titleColor: isDark ? '#E4E6EB' : '#212529',
                    bodyColor: isDark ? '#E4E6EB' : '#212529',
                    borderColor: isDark ? '#3a3b3d' : '#E9ECEF',
                    borderWidth: 1,
                },
            },
        });
    }, [isDark]);


    if (!data.length) return <div className="empty-state h-full"><strong className="text-text-default">Nenhuma turma com matrículas</strong><p>Os alunos aparecerão aqui após a matrícula em uma turma ativa.</p></div>;
    return <><Bar data={chartData} options={chartOptions} role="img" aria-label={`Alunos por turma: ${data.map(item => `${item.curso}: ${item.total}`).join('; ')}`} /><ul className="sr-only">{data.map((item, index) => <li key={index}>{item.curso}: {item.total} alunos</li>)}</ul></>;
};

export default EnrollmentOverviewChart;
