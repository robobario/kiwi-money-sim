import { useState } from 'react';
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

function costLabel(accountName: string): string {
  return accountName
    .replace(/-tax-spend$/, ' tax')
    .replace(/-acc-levy-spend$/, ' ACC levy')
    .replace(/-spend$/, '')
    .replace(/-sale-legal-fee$/, ' sale legal fee')
    .replace(/-sale-agent-fee$/, ' sale agent fee');
}

const INVESTMENT_COLORS = ['#8b5cf6', '#14b8a6', '#eab308', '#ec4899', '#06b6d4'];
const COST_COLORS = ['#f87171', '#fb923c', '#fbbf24', '#a3e635', '#34d399', '#60a5fa', '#c084fc'];
const INCOME_COLOR = '#60a5fa';
const TOTAL_COST_COLOR = '#dc2626';

function chartOptions() {
  return {
    responsive: true,
    plugins: {
      legend: { position: 'top' as const },
      tooltip: {
        callbacks: {
          label: (ctx: { dataset: { label?: string }; parsed: { y?: number | null } }) =>
            `${ctx.dataset.label ?? ''}: ${formatDollar(ctx.parsed.y ?? 0)}`,
        },
      },
    },
    scales: {
      y: { ticks: { callback: (value: unknown) => formatDollar(value as number) } },
      x: { ticks: { maxTicksLimit: 20 } },
    },
  };
}

export function ChartView({ snapshots, mortgageName, externalAccountNames = [] }: ChartViewProps) {
  const [realTerms, setRealTerms] = useState(false);

  const adj = (s: Snapshot, value: number) => realTerms ? value / s.inflationIndex : value;

  const labels = snapshots.map(s => formatDate(s.day));

  const houseInvestmentKey = mortgageName ? `${mortgageName}-house` : undefined;
  const investmentNames = snapshots.length > 0
    ? Object.keys(snapshots[0].investmentValues ?? {}).filter(n => n !== houseInvestmentKey)
    : [];

  const costAccountNames = externalAccountNames.filter(n =>
    n !== WORLD_ACCOUNT && n !== INCOME_ACCOUNT && !n.endsWith('-sale-proceeds')
  );
  const hasIncomeAccount = externalAccountNames.includes(INCOME_ACCOUNT);

  const externalSet = new Set(externalAccountNames);

  const netWorth = snapshots.map(s => {
    const accountTotal = Object.entries(s.balances)
      .filter(([name]) => !externalSet.has(name))
      .reduce((sum, [, bal]) => sum + bal, 0);
    const investmentTotal = Object.values(s.investmentValues ?? {}).reduce((sum, v) => sum + v, 0);
    return adj(s, accountTotal + investmentTotal);
  });

  const cash = snapshots.map(s => adj(s, s.balances['cash'] ?? 0));

  const totalCosts = snapshots.map(s =>
    adj(s, costAccountNames.reduce((sum, name) => sum + (s.balances[name] ?? 0), 0))
  );

  const mainDatasets: Record<string, unknown>[] = [
    { label: 'Net Worth', data: netWorth, borderColor: '#22c55e', backgroundColor: '#22c55e20', pointRadius: 0, tension: 0 },
    { label: 'Cash',      data: cash,     borderColor: '#3b82f6', backgroundColor: '#3b82f620', pointRadius: 0, tension: 0 },
  ];

  if (mortgageName) {
    const mortgageKey = `${mortgageName}-mortgage`;
    const houseKey    = `${mortgageName}-house`;
    mainDatasets.push({
      label: 'Mortgage Balance',
      data: snapshots.map(s => adj(s, s.balances[mortgageKey] ?? 0)),
      borderColor: '#ef4444', backgroundColor: '#ef444420', pointRadius: 0, tension: 0,
    });
    mainDatasets.push({
      label: 'House Equity',
      data: snapshots.map(s => adj(s, ((s.investmentValues ?? {})[houseKey] ?? 0) + (s.balances[mortgageKey] ?? 0))),
      borderColor: '#f97316', backgroundColor: '#f9731620', pointRadius: 0, tension: 0,
    });
  }

  investmentNames.forEach((name, idx) => {
    const color = INVESTMENT_COLORS[idx % INVESTMENT_COLORS.length];
    mainDatasets.push({
      label: name, data: snapshots.map(s => adj(s, (s.investmentValues ?? {})[name] ?? 0)),
      borderColor: color, backgroundColor: color + '20', pointRadius: 0, tension: 0,
    });
  });

  if (costAccountNames.length > 0) {
    mainDatasets.push({
      label: 'Total Costs',
      data: totalCosts,
      borderColor: TOTAL_COST_COLOR, backgroundColor: TOTAL_COST_COLOR + '20',
      borderDash: [4, 4], pointRadius: 0, tension: 0,
    });
  }

  if (hasIncomeAccount) {
    mainDatasets.push({
      label: 'Total Income',
      data: snapshots.map(s => adj(s, -(s.balances[INCOME_ACCOUNT] ?? 0))),
      borderColor: INCOME_COLOR, backgroundColor: INCOME_COLOR + '20',
      borderDash: [4, 4], pointRadius: 0, tension: 0,
    });
  }

  const breakdownDatasets: Record<string, unknown>[] = costAccountNames.map((accountName, idx) => {
    const color = COST_COLORS[idx % COST_COLORS.length];
    return {
      label: costLabel(accountName),
      data: snapshots.map(s => adj(s, s.balances[accountName] ?? 0)),
      borderColor: color, backgroundColor: color + '20',
      pointRadius: 0, tension: 0,
    };
  });

  return (
    <div style={{ width: '100%', maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <label className="checkbox-label" style={{ alignSelf: 'flex-end', fontSize: '0.9rem' }}>
        <input type="checkbox" checked={realTerms} onChange={e => setRealTerms(e.target.checked)} />
        Show in today's money (inflation-adjusted)
      </label>
      <Line data={{ labels, datasets: mainDatasets as never[] }} options={chartOptions()} />
      {costAccountNames.length > 0 && (
        <div>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem' }}>Cost Breakdown</h3>
          <Line data={{ labels, datasets: breakdownDatasets as never[] }} options={chartOptions()} />
        </div>
      )}
    </div>
  );
}
