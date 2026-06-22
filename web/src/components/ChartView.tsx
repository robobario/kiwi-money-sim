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
import { WORLD_ACCOUNT, INCOME_ACCOUNT } from '../engine/simulation';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

interface ChartViewProps {
  snapshots: Snapshot[];
  mortgageName?: string;
  externalAccountNames?: string[];
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
const COST_COLORS = ['#f87171', '#fb923c', '#fbbf24', '#a3e635', '#34d399'];
const INCOME_COLOR = '#60a5fa';

export function ChartView({ snapshots, mortgageName, externalAccountNames = [] }: ChartViewProps) {
  const labels = snapshots.map(s => formatDate(s.day));

  const houseInvestmentKey = mortgageName ? `${mortgageName}-house` : undefined;
  const investmentNames = snapshots.length > 0
    ? Object.keys(snapshots[0].investmentValues ?? {}).filter(n => n !== houseInvestmentKey)
    : [];

  const costAccountNames = externalAccountNames.filter(n => n !== WORLD_ACCOUNT && n !== INCOME_ACCOUNT);
  const hasIncomeAccount = externalAccountNames.includes(INCOME_ACCOUNT);

  const externalSet = new Set(externalAccountNames);

  const netWorth = snapshots.map(s => {
    const accountTotal = Object.entries(s.balances)
      .filter(([name]) => !externalSet.has(name))
      .reduce((sum, [, bal]) => sum + bal, 0);
    const investmentTotal = Object.values(s.investmentValues ?? {}).reduce((sum, v) => sum + v, 0);
    return accountTotal + investmentTotal;
  });

  const cash = snapshots.map(s => s.balances['cash'] ?? 0);

  const datasets: Record<string, unknown>[] = [
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
      data: snapshots.map(s => ((s.investmentValues ?? {})[houseKey] ?? 0) + (s.balances[mortgageKey] ?? 0)),
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

  costAccountNames.forEach((accountName, idx) => {
    const color = COST_COLORS[idx % COST_COLORS.length];
    const label = accountName.replace(/-spend$/, '');
    datasets.push({
      label: `${label} (spent)`,
      data: snapshots.map(s => s.balances[accountName] ?? 0),
      borderColor: color,
      backgroundColor: color + '20',
      borderDash: [4, 4],
      pointRadius: 0,
      tension: 0,
    });
  });

  if (hasIncomeAccount) {
    datasets.push({
      label: 'Total Income',
      data: snapshots.map(s => -(s.balances[INCOME_ACCOUNT] ?? 0)),
      borderColor: INCOME_COLOR,
      backgroundColor: INCOME_COLOR + '20',
      borderDash: [4, 4],
      pointRadius: 0,
      tension: 0,
    });
  }

  return (
    <div style={{ width: '100%', maxWidth: 900, margin: '0 auto' }}>
      <Line
        data={{ labels, datasets: datasets as never[] }}
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
