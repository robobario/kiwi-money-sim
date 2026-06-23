import type { Event, Frequency } from './events';
import type { World } from './world';
import { roundCents } from './money';

export interface InitializeAccountGesture {
  readonly kind: 'initialize_account';
  readonly day: number;
  readonly accountName: string;
  readonly balance: number;
  readonly external?: boolean;
}

export interface CreateIncomeGesture {
  readonly kind: 'create_income';
  readonly day: number;
  readonly name: string;
  readonly frequency: Frequency;
  readonly amount: number;
  readonly toAccount: string;
  readonly fromAccount: string;
  readonly inflationLinked?: boolean;
}

export interface CreateRepeatCostGesture {
  readonly kind: 'create_repeat_cost';
  readonly day: number;
  readonly name: string;
  readonly frequency: Frequency;
  readonly amount: number;
  readonly fromAccount: string;
  readonly inflationLinked?: boolean;
}

export interface CreateInflationGesture {
  readonly kind: 'create_inflation';
  readonly day: number;
  readonly annualRatePercent: number;
}

export interface CreateExistingMortgageGesture {
  readonly kind: 'create_existing_mortgage';
  readonly day: number;
  readonly name: string;
  readonly principal: number;
  readonly assetValue: number;
  readonly annualRatePercent: number;
  readonly interestFrequency: Frequency;
  readonly termYears: number;
  readonly paymentFromAccount: string;
  readonly annualHousePriceGrowthPercent?: number;
}

export interface CreatePeriodicInvestmentGesture {
  readonly kind: 'create_periodic_investment';
  readonly day: number;
  readonly name: string;
  readonly periodAmount: number;
  readonly frequency: Frequency;
  readonly annualGrowthPercent: number;
  readonly fromAccount: string;
}

export interface BuyHouseGesture {
  readonly kind: 'buy_house';
  readonly day: number;
  readonly name: string;
  readonly housePrice: number;
  readonly deposit: number;
  readonly annualRatePercent: number;
  readonly termYears: number;
  readonly paymentFromAccount: string;
  readonly annualHousePriceGrowthPercent?: number;
}

export interface StartJobGesture {
  readonly kind: 'start_job';
  readonly day: number;
  readonly personName: string;
  readonly name: string;
  readonly annualSalary: number;
  readonly payFrequency: 'weekly' | 'fortnightly' | 'first_of_month';
  readonly kiwiSaverEnabled: boolean;
  readonly employeeKiwiSaverPercent: number;
  readonly employerKiwiSaverPercent: number;
  readonly kiwiSaverGrowthPercent: number;
  readonly inflationMatchedPayrise: boolean;
}

export interface SellHouseGesture {
  readonly kind: 'sell_house';
  readonly day: number;
  readonly houseName: string;
  readonly salePriceOverride?: number;
  readonly agentFeePercent: number;
  readonly fixedCosts: number;
}

export interface EndJobGesture {
  readonly kind: 'end_job';
  readonly day: number;
  readonly personName: string;
  readonly jobName: string;
}

export interface RetireGesture {
  readonly kind: 'retire';
  readonly day: number;
  readonly personName: string;
}

export type SuperannuationLivingSituation = 'single_alone' | 'single_sharing' | 'couple';

export interface StartSuperannuationGesture {
  readonly kind: 'start_superannuation';
  readonly day: number;
  readonly personName: string;
  readonly livingSituation: SuperannuationLivingSituation;
}

export type Gesture =
  | InitializeAccountGesture
  | CreateIncomeGesture
  | CreateRepeatCostGesture
  | CreateExistingMortgageGesture
  | BuyHouseGesture
  | CreatePeriodicInvestmentGesture
  | CreateInflationGesture
  | StartJobGesture
  | EndJobGesture
  | RetireGesture
  | SellHouseGesture
  | StartSuperannuationGesture;

export function gestureEvents(gesture: Gesture, world?: World): Event[] {
  const baseInflationIndex = world?.inflationIndex ?? 1;
  switch (gesture.kind) {
    case 'initialize_account':
      return [{ kind: 'create_account', name: gesture.accountName, balance: gesture.balance, external: gesture.external }];

    case 'create_income':
      return [{
        kind: 'register_generator',
        name: gesture.name,
        generator: {
          kind: 'repeat_transfer',
          name: gesture.name,
          startDay: gesture.day,
          from: gesture.fromAccount,
          to: gesture.toAccount,
          amount: gesture.amount,
          frequency: gesture.frequency,
          inflationLinked: gesture.inflationLinked,
          baseInflationIndex,
        },
      }];

    case 'create_repeat_cost': {
      const spendAccount = `${gesture.name}-spend`;
      return [
        { kind: 'create_account', name: spendAccount, balance: 0, external: true },
        {
          kind: 'register_generator',
          name: gesture.name,
          generator: {
            kind: 'repeat_transfer',
            name: gesture.name,
            startDay: gesture.day,
            from: gesture.fromAccount,
            to: spendAccount,
            amount: gesture.amount,
            frequency: gesture.frequency,
            inflationLinked: gesture.inflationLinked,
            baseInflationIndex,
          },
        },
      ];
    }

    case 'create_inflation':
      return [{
        kind: 'register_generator',
        name: `inflation-${gesture.annualRatePercent}pct`,
        generator: {
          kind: 'inflation',
          name: `inflation-${gesture.annualRatePercent}pct`,
          annualRatePercent: gesture.annualRatePercent,
        },
      }];

    case 'create_periodic_investment':
      return [
        { kind: 'create_investment', name: gesture.name, initialPrice: 1.0 },
        {
          kind: 'register_generator',
          name: `${gesture.name}-appreciation`,
          generator: {
            kind: 'index_appreciation',
            name: `${gesture.name}-appreciation`,
            investmentName: gesture.name,
            annualGrowthPercent: gesture.annualGrowthPercent,
          },
        },
        {
          kind: 'register_generator',
          name: `${gesture.name}-buy`,
          generator: {
            kind: 'periodic_buy_investment',
            name: `${gesture.name}-buy`,
            startDay: gesture.day,
            investmentName: gesture.name,
            cashAmount: gesture.periodAmount,
            fromAccount: gesture.fromAccount,
            frequency: gesture.frequency,
          },
        },
      ];

    case 'buy_house': {
      const principal = gesture.housePrice - gesture.deposit;
      const mortgageAccount = `${gesture.name}-mortgage`;
      const houseInvestment = `${gesture.name}-house`;
      const payment = calculateMonthlyPayment(principal, gesture.annualRatePercent, gesture.termYears);
      const events: Event[] = [
        { kind: 'transfer', from: gesture.paymentFromAccount, to: 'world', amount: gesture.deposit },
        { kind: 'create_account', name: mortgageAccount, balance: -principal },
        { kind: 'create_investment', name: houseInvestment, initialPrice: 1.0, initialUnits: gesture.housePrice },
        {
          kind: 'register_generator',
          name: `${mortgageAccount}-interest-deduction`,
          generator: {
            kind: 'interest_payment',
            name: `${mortgageAccount}-interest-deduction`,
            startDay: gesture.day,
            mortgageAccount,
            interestSinkAccount: 'world',
            annualRatePercent: gesture.annualRatePercent,
            frequency: 'first_of_month',
          },
        },
        {
          kind: 'register_generator',
          name: `${mortgageAccount}-repayment`,
          generator: {
            kind: 'mortgage_repayment',
            name: `${mortgageAccount}-repayment`,
            startDay: gesture.day,
            mortgageAccount,
            paymentFromAccount: gesture.paymentFromAccount,
            amount: payment,
            frequency: 'first_of_month',
          },
        },
      ];
      if (gesture.annualHousePriceGrowthPercent && gesture.annualHousePriceGrowthPercent > 0) {
        events.push({
          kind: 'register_generator',
          name: `${houseInvestment}-appreciation`,
          generator: {
            kind: 'index_appreciation',
            name: `${houseInvestment}-appreciation`,
            investmentName: houseInvestment,
            annualGrowthPercent: gesture.annualHousePriceGrowthPercent,
          },
        });
      }
      return events;
    }

    case 'start_job': {
      const prefix = `${gesture.personName}-${gesture.name}`;
      const ksName = `${prefix}-kiwisaver`;
      const events: Event[] = [
        { kind: 'create_account', name: `${prefix}-tax-spend`,     balance: 0, external: true },
        { kind: 'create_account', name: `${prefix}-acc-levy-spend`, balance: 0, external: true },
      ];
      if (gesture.kiwiSaverEnabled) {
        events.push({ kind: 'create_investment', name: ksName, initialPrice: 1.0 });
        events.push({
          kind: 'register_generator',
          name: `${ksName}-appreciation`,
          generator: {
            kind: 'index_appreciation',
            name: `${ksName}-appreciation`,
            investmentName: ksName,
            annualGrowthPercent: gesture.kiwiSaverGrowthPercent,
          },
        });
      }
      events.push({
        kind: 'register_generator',
        name: `${prefix}-salary`,
        generator: {
          kind: 'nz_salary',
          name: `${prefix}-salary`,
          startDay: gesture.day,
          frequency: gesture.payFrequency,
          annualSalary: gesture.annualSalary,
          fromAccount: 'income',
          cashAccount: 'cash',
          taxAccount:  `${prefix}-tax-spend`,
          accAccount:  `${prefix}-acc-levy-spend`,
          kiwiSaverInvestmentName: gesture.kiwiSaverEnabled ? ksName : undefined,
          employeeKiwiSaverPercent: gesture.employeeKiwiSaverPercent,
          employerKiwiSaverPercent: gesture.employerKiwiSaverPercent,
          inflationLinked: gesture.inflationMatchedPayrise,
          baseInflationIndex: gesture.inflationMatchedPayrise ? baseInflationIndex : undefined,
        },
      });
      return events;
    }

    case 'end_job': {
      const prefix = `${gesture.personName}-${gesture.jobName}`;
      return [{ kind: 'deregister_generator', name: `${prefix}-salary` }];
    }

    case 'retire': {
      const pattern = new RegExp(`^${gesture.personName}-.+-salary$`);
      return (world?.eventGenerators ?? [])
        .filter(g => pattern.test(g.name))
        .map(g => ({ kind: 'deregister_generator' as const, name: g.name }));
    }

    case 'sell_house': {
      const houseInvestmentName = `${gesture.houseName}-house`;
      const mortgageAccountName = `${gesture.houseName}-mortgage`;

      const houseInvestment = world?.investments.find(i => i.name === houseInvestmentName);
      const marketPrice = houseInvestment ? houseInvestment.unitsHeld * houseInvestment.indexPrice : 0;
      const salePrice = gesture.salePriceOverride ?? marketPrice;

      const agentFee = roundCents(salePrice * gesture.agentFeePercent / 100);
      const netProceeds = salePrice - agentFee - gesture.fixedCosts;

      const mortgageBalance = world?.accounts.find(a => a.name === mortgageAccountName)?.balance ?? 0;
      const mortgagePayoff = mortgageBalance < 0 ? -mortgageBalance : 0;
      const proceedsToMortgage = Math.min(netProceeds, mortgagePayoff);
      const cashToMortgage = Math.max(0, mortgagePayoff - netProceeds);
      const cashFromSale = Math.max(0, netProceeds - mortgagePayoff);

      const proceedsAccount = `${gesture.houseName}-sale-proceeds`;
      const legalFeeAccount = `${gesture.houseName}-sale-legal-fee`;
      const agentFeeAccount = `${gesture.houseName}-sale-agent-fee`;

      const events: Event[] = [
        { kind: 'create_account', name: proceedsAccount, balance: salePrice, external: true },
        { kind: 'create_account', name: legalFeeAccount, balance: 0, external: true },
        { kind: 'create_account', name: agentFeeAccount, balance: 0, external: true },
      ];
      if (gesture.fixedCosts > 0) {
        events.push({ kind: 'transfer', from: proceedsAccount, to: legalFeeAccount, amount: gesture.fixedCosts });
      }
      if (agentFee > 0) {
        events.push({ kind: 'transfer', from: proceedsAccount, to: agentFeeAccount, amount: agentFee });
      }
      if (proceedsToMortgage > 0) {
        events.push({ kind: 'transfer', from: proceedsAccount, to: mortgageAccountName, amount: proceedsToMortgage });
      }
      if (cashToMortgage > 0) {
        events.push({ kind: 'transfer', from: 'cash', to: mortgageAccountName, amount: cashToMortgage });
      }
      if (cashFromSale > 0) {
        events.push({ kind: 'transfer', from: proceedsAccount, to: 'cash', amount: cashFromSale });
      }
      events.push({ kind: 'clear_investment', name: houseInvestmentName });
      return events;
    }

    case 'start_superannuation': {
      const fortnightlyRates: Record<SuperannuationLivingSituation, number> = {
        single_alone:  1294.74,
        single_sharing: 1191.14,
        couple:          984.28,
      };
      const generatorName = `${gesture.personName}-super`;
      return [{
        kind: 'register_generator',
        name: generatorName,
        generator: {
          kind: 'repeat_transfer',
          name: generatorName,
          startDay: gesture.day,
          from: 'income',
          to: 'cash',
          amount: fortnightlyRates[gesture.livingSituation],
          frequency: 'fortnightly',
          inflationLinked: true,
          baseInflationIndex,
        },
      }];
    }

    case 'create_existing_mortgage': {
      const mortgageAccount = `${gesture.name}-mortgage`;
      const houseInvestment = `${gesture.name}-house`;
      const payment = calculateMonthlyPayment(gesture.principal, gesture.annualRatePercent, gesture.termYears);
      const events: Event[] = [
        { kind: 'create_account', name: mortgageAccount, balance: -gesture.principal },
        { kind: 'create_investment', name: houseInvestment, initialPrice: 1.0, initialUnits: gesture.assetValue },
        {
          kind: 'register_generator',
          name: `${mortgageAccount}-interest-deduction`,
          generator: {
            kind: 'interest_payment',
            name: `${mortgageAccount}-interest-deduction`,
            startDay: gesture.day,
            mortgageAccount,
            interestSinkAccount: 'world',
            annualRatePercent: gesture.annualRatePercent,
            frequency: gesture.interestFrequency,
          },
        },
        {
          kind: 'register_generator',
          name: `${mortgageAccount}-repayment`,
          generator: {
            kind: 'mortgage_repayment',
            name: `${mortgageAccount}-repayment`,
            startDay: gesture.day,
            mortgageAccount,
            paymentFromAccount: gesture.paymentFromAccount,
            amount: payment,
            frequency: gesture.interestFrequency,
          },
        },
      ];
      if (gesture.annualHousePriceGrowthPercent && gesture.annualHousePriceGrowthPercent > 0) {
        events.push({
          kind: 'register_generator',
          name: `${houseInvestment}-appreciation`,
          generator: {
            kind: 'index_appreciation',
            name: `${houseInvestment}-appreciation`,
            investmentName: houseInvestment,
            annualGrowthPercent: gesture.annualHousePriceGrowthPercent,
          },
        });
      }
      return events;
    }
  }
}

export function calculateMonthlyPayment(principal: number, annualRatePercent: number, years: number): number {
  const monthlyRate = annualRatePercent / 100 / 12;
  const numberOfPayments = years * 12;
  const commonFactor = Math.pow(1 + monthlyRate, numberOfPayments);
  const numerator = monthlyRate * commonFactor;
  const denominator = commonFactor - 1;
  return roundCents(principal * numerator / denominator);
}
