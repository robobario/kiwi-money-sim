import type { EventGenerator } from './generators';
import type { Investment, World } from './world';

export type Frequency = 'daily' | 'weekly' | 'fortnightly' | 'first_of_month' | 'first_of_year';

export interface TransferEvent {
  readonly kind: 'transfer';
  readonly from: string;
  readonly to: string;
  readonly amount: number;
}

export interface CreateAccountEvent {
  readonly kind: 'create_account';
  readonly name: string;
  readonly balance: number;
  readonly external?: boolean;
}

export interface RegisterGeneratorEvent {
  readonly kind: 'register_generator';
  readonly name: string;
  readonly generator: EventGenerator;
}

export interface DeregisterGeneratorEvent {
  readonly kind: 'deregister_generator';
  readonly name: string;
}

export interface CreateInvestmentEvent {
  readonly kind: 'create_investment';
  readonly name: string;
  readonly initialPrice: number;
  readonly initialUnits?: number;
}

export interface UpdateIndexPriceEvent {
  readonly kind: 'update_index_price';
  readonly investmentName: string;
  readonly newPrice: number;
}

export interface BuyInvestmentUnitsEvent {
  readonly kind: 'buy_investment_units';
  readonly investmentName: string;
  readonly cashAmount: number;
  readonly fromAccount: string;
}

export interface UpdateInflationIndexEvent {
  readonly kind: 'update_inflation_index';
  readonly newIndex: number;
}

export interface ClearInvestmentEvent {
  readonly kind: 'clear_investment';
  readonly name: string;
}

export interface SellInvestmentUnitsEvent {
  readonly kind: 'sell_investment_units';
  readonly investmentName: string;
  readonly cashAmount: number;
  readonly toAccount: string;
}

export type Event =
  | TransferEvent
  | CreateAccountEvent
  | RegisterGeneratorEvent
  | DeregisterGeneratorEvent
  | CreateInvestmentEvent
  | UpdateIndexPriceEvent
  | BuyInvestmentUnitsEvent
  | SellInvestmentUnitsEvent
  | UpdateInflationIndexEvent
  | ClearInvestmentEvent;

export function applyEvent(world: World, event: Event): World {
  switch (event.kind) {
    case 'transfer': {
      const from = world.accounts.get(event.from)!;
      const to = world.accounts.get(event.to)!;
      const newAccounts = new Map(world.accounts);
      newAccounts.set(event.from, { ...from, balance: from.balance - event.amount });
      newAccounts.set(event.to, { ...to, balance: to.balance + event.amount });
      return { ...world, accounts: newAccounts };
    }
    case 'create_account': {
      if (world.accounts.has(event.name)) {
        throw new Error(`account named ${event.name} exists already`);
      }
      const newAccounts = new Map(world.accounts);
      newAccounts.set(event.name, { name: event.name, balance: event.balance, external: event.external ?? false });
      return { ...world, accounts: newAccounts };
    }
    case 'register_generator': {
      const newGenerators = new Map(world.eventGenerators);
      newGenerators.set(event.name, event.generator);
      return { ...world, eventGenerators: newGenerators };
    }
    case 'deregister_generator': {
      const newGenerators = new Map(world.eventGenerators);
      newGenerators.delete(event.name);
      return { ...world, eventGenerators: newGenerators };
    }
    case 'create_investment': {
      if (world.investments.has(event.name)) {
        throw new Error(`investment named ${event.name} exists already`);
      }
      const investment: Investment = { name: event.name, indexPrice: event.initialPrice, unitsHeld: event.initialUnits ?? 0 };
      const newInvestments = new Map(world.investments);
      newInvestments.set(event.name, investment);
      return { ...world, investments: newInvestments };
    }
    case 'update_index_price': {
      const inv = world.investments.get(event.investmentName)!;
      const newInvestments = new Map(world.investments);
      newInvestments.set(event.investmentName, { ...inv, indexPrice: event.newPrice });
      return { ...world, investments: newInvestments };
    }
    case 'update_inflation_index':
      return { ...world, inflationIndex: event.newIndex };
    case 'buy_investment_units': {
      const inv = world.investments.get(event.investmentName)!;
      const fromAccount = world.accounts.get(event.fromAccount)!;
      const newInvestments = new Map(world.investments);
      newInvestments.set(event.investmentName, { ...inv, unitsHeld: inv.unitsHeld + event.cashAmount / inv.indexPrice });
      const newAccounts = new Map(world.accounts);
      newAccounts.set(event.fromAccount, { ...fromAccount, balance: fromAccount.balance - event.cashAmount });
      return { ...world, investments: newInvestments, accounts: newAccounts };
    }
    case 'sell_investment_units': {
      const inv = world.investments.get(event.investmentName)!;
      const toAccount = world.accounts.get(event.toAccount)!;
      const newInvestments = new Map(world.investments);
      newInvestments.set(event.investmentName, { ...inv, unitsHeld: Math.max(0, inv.unitsHeld - event.cashAmount / inv.indexPrice) });
      const newAccounts = new Map(world.accounts);
      newAccounts.set(event.toAccount, { ...toAccount, balance: toAccount.balance + event.cashAmount });
      return { ...world, investments: newInvestments, accounts: newAccounts };
    }
    case 'clear_investment': {
      const inv = world.investments.get(event.name)!;
      const newInvestments = new Map(world.investments);
      newInvestments.set(event.name, { ...inv, unitsHeld: 0 });
      return { ...world, investments: newInvestments };
    }
  }
}
