import type { Account } from './account';
import type { EventGenerator } from './generators';
import type { Investment, World } from './world';

export type Frequency = 'daily' | 'weekly' | 'first_of_month';

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

export interface CreateInvestmentEvent {
  readonly kind: 'create_investment';
  readonly name: string;
  readonly initialPrice: number;
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

export type Event =
  | TransferEvent
  | CreateAccountEvent
  | RegisterGeneratorEvent
  | CreateInvestmentEvent
  | UpdateIndexPriceEvent
  | BuyInvestmentUnitsEvent;

export function applyEvent(world: World, event: Event): World {
  switch (event.kind) {
    case 'transfer': {
      const fromAccount = world.accounts.find(a => a.name === event.from)!;
      const toAccount = world.accounts.find(a => a.name === event.to)!;
      const updatedFrom: Account = { ...fromAccount, balance: fromAccount.balance - event.amount };
      const updatedTo: Account = { ...toAccount, balance: toAccount.balance + event.amount };
      const otherAccounts = world.accounts.filter(a => a.name !== event.from && a.name !== event.to);
      return { ...world, accounts: [updatedFrom, updatedTo, ...otherAccounts] };
    }
    case 'create_account': {
      if (world.accounts.some(a => a.name === event.name)) {
        throw new Error(`account named ${event.name} exists already`);
      }
      return { ...world, accounts: [...world.accounts, { name: event.name, balance: event.balance, external: event.external ?? false }] };
    }
    case 'register_generator': {
      if (world.eventGenerators.some(g => g.name === event.name)) {
        throw new Error(`event generator named ${event.name} exists already`);
      }
      return { ...world, eventGenerators: [...world.eventGenerators, event.generator] };
    }
    case 'create_investment': {
      if (world.investments.some(i => i.name === event.name)) {
        throw new Error(`investment named ${event.name} exists already`);
      }
      const investment: Investment = { name: event.name, indexPrice: event.initialPrice, unitsHeld: 0 };
      return { ...world, investments: [...world.investments, investment] };
    }
    case 'update_index_price': {
      return {
        ...world,
        investments: world.investments.map(i =>
          i.name === event.investmentName ? { ...i, indexPrice: event.newPrice } : i
        ),
      };
    }
    case 'buy_investment_units': {
      const investment = world.investments.find(i => i.name === event.investmentName)!;
      const unitsToAdd = event.cashAmount / investment.indexPrice;
      return {
        ...world,
        investments: world.investments.map(i =>
          i.name === event.investmentName ? { ...i, unitsHeld: i.unitsHeld + unitsToAdd } : i
        ),
        accounts: world.accounts.map(a =>
          a.name === event.fromAccount ? { ...a, balance: a.balance - event.cashAmount } : a
        ),
      };
    }
  }
}
