import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import type { Snapshot } from '../engine/simulation';
import { WORLD_ACCOUNT } from '../engine/simulation';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

interface ChartViewProps {
  snapshots: Snapshot[];
  mortgageName?: string;
}

function formatDate(epochMs: number): string {
  const d = new Date(epochMs);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function formatDollar(value: number): string {
  return '$' + Math.round(value).toLocaleString();
}

const INVESTMENT_COLORS = ['#8b5cf6', '#14b8a6', '#eab308', '#ec4899', '#06b6d4'];

export function ChartView({ snapshots, mortgageName }: ChartViewProps) {
  const labels = snapshots.map(s => formatDate(s.day));

  const investmentNames = snapshots.length > 0
    ? Object.keys(snapshots[0].investmentValues ?? {})
    : [];

  const netWorth = snapshots.map(s => {
    const accountTotal = Object.entries(s.balances)
      .filter(([name]) => name !== WORLD_ACCOUNT)
      .reduce((sum, [, bal]) => sum + bal, 0);
    const investmentTotal = Object.values(s.investmentValues ?? {}).reduce((sum, v) => sum + v, 0);
    return accountTotal + investmentTotal;
  });

  const cash = snapshots.map(s => s.balances['cash'] ?? 0);

  const datasets = [
    {
      label: 'Net Worth',
      data: netWorth,
      borderColor: '#22c55e',
      backgroundColor: '#22c55e20',
      pointRadius: 0,
      tension: 0,
    },
    {
      label: 'Cash',
      data: cash,
      borderColor: '#3b82f6',
      backgroundColor: '#3b82f620',
      pointRadius: 0,
      tension: 0,
    },
  ];

  if (mortgageName) {
    const mortgageKey = `${mortgageName}-mortgage`;
    const houseKey = `${mortgageName}-house`;

    datasets.push({
      label: 'Mortgage Balance',
      data: snapshots.map(s => s.balances[mortgageKey] ?? 0),
      borderColor: '#ef4444',
      backgroundColor: '#ef444420',
      pointRadius: 0,
      tension: 0,
    });

    datasets.push({
      label: 'House Equity',
      data: snapshots.map(s => (s.balances[houseKey] ?? 0) + (s.balances[mortgageKey] ?? 0)),
      borderColor: '#f97316',
      backgroundColor: '#f9731620',
      pointRadius: 0,
      tension: 0,
    });
  }

  investmentNames.forEach((name, idx) => {
    const color = INVESTMENT_COLORS[idx % INVESTMENT_COLORS.length];
    datasets.push({
      label: name,
      data: snapshots.map(s => (s.investmentValues ?? {})[name] ?? 0),
      borderColor: color,
      backgroundColor: color + '20',
      pointRadius: 0,
      tension: 0,
    });
  });

  return (
    <div style={{ width: '100%', maxWidth: 900, margin: '0 auto' }}>
      <Line
        data={{ labels, datasets }}
        options={{
          responsive: true,
          plugins: {
            legend: { position: 'top' },
            tooltip: {
              callbacks: {
                label: ctx => `${ctx.dataset.label ?? ''}: ${formatDollar(ctx.parsed.y ?? 0)}`,
              },
            },
          },
          scales: {
            y: {
              ticks: {
                callback: value => formatDollar(value as number),
              },
            },
            x: {
              ticks: {
                maxTicksLimit: 20,
              },
            },
          },
        }}
      />
    </div>
  );
}
