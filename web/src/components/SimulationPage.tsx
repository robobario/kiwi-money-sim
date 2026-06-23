import React from 'react';
import type { SimulationResult } from '../engine/simulation';
import { ChartView } from './ChartView';

interface SimulationPageProps {
  result: SimulationResult;
  mortgageNames: string[];
}

function formatDollar(value: number): string {
  return '$' + Math.round(value).toLocaleString();
}

export function SimulationPage({ result, mortgageNames }: SimulationPageProps) {
  const finalBalances = result.finalWorld.accounts;
  const finalInvestments = result.finalWorld.investments;
  const externalAccountNames = finalBalances.filter(a => a.external).map(a => a.name);
  const cashBalance = finalBalances.find(a => a.name === 'cash')?.balance ?? 0;
  const houseInvestmentKeys = new Set(mortgageNames.map(n => `${n}-house`));
  const investmentTotal = finalInvestments.reduce((sum, i) => sum + i.unitsHeld * i.indexPrice, 0);
  const netWorth = finalBalances
    .filter(a => !a.external)
    .reduce((sum, a) => sum + a.balance, 0) + investmentTotal;
  const displayInvestments = finalInvestments.filter(i => !houseInvestmentKeys.has(i.name));

  const firstNegativeCash = result.snapshots.find(s => (s.balances['cash'] ?? 0) < 0);

  return (
    <div className="simulation-page">
      <div className="summary-stats">
        <div className="stat">
          <span className="stat-label">Final Cash</span>
          <span className="stat-value">{formatDollar(cashBalance)}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Final Net Worth</span>
          <span className="stat-value">{formatDollar(netWorth)}</span>
        </div>
        {mortgageNames.map(name => {
          const inv = finalInvestments.find(i => i.name === `${name}-house`);
          const houseValue = inv ? inv.unitsHeld * inv.indexPrice : 0;
          const mortgageBalance = finalBalances.find(a => a.name === `${name}-mortgage`)?.balance ?? 0;
          return (
            <React.Fragment key={name}>
              <div className="stat">
                <span className="stat-label">{name} value</span>
                <span className="stat-value">{formatDollar(houseValue)}</span>
              </div>
              <div className="stat">
                <span className="stat-label">{name} mortgage</span>
                <span className="stat-value">{formatDollar(mortgageBalance)}</span>
              </div>
            </React.Fragment>
          );
        })}
        {displayInvestments.map(inv => (
          <div className="stat" key={inv.name}>
            <span className="stat-label">{inv.name}</span>
            <span className="stat-value">
              {formatDollar(inv.unitsHeld * inv.indexPrice)}
              <span className="stat-sub"> ({inv.unitsHeld.toFixed(2)} units @ {inv.indexPrice.toFixed(4)})</span>
            </span>
          </div>
        ))}
      </div>

      <ChartView snapshots={result.snapshots} mortgageNames={mortgageNames} externalAccountNames={externalAccountNames} />

      {firstNegativeCash && (
        <p className="warning">
          Warning: cash went negative — first occurrence on {new Date(firstNegativeCash.day).toISOString().slice(0, 10)} ({formatDollar(firstNegativeCash.balances['cash'] ?? 0)}).
        </p>
      )}
    </div>
  );
}
