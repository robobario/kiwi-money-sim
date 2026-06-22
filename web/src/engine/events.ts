import type { Account } from './account';
import type { EventGenerator } from './generators';
import type { World } from './world';

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
}

export interface RegisterGeneratorEvent {
  readonly kind: 'register_generator';
  readonly name: string;
  readonly generator: EventGenerator;
}

export type Event = TransferEvent | CreateAccountEvent | RegisterGeneratorEvent;

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
      return { ...world, accounts: [...world.accounts, { name: event.name, balance: event.balance }] };
    }
    case 'register_generator': {
      if (world.eventGenerators.some(g => g.name === event.name)) {
        throw new Error(`event generator named ${event.name} exists already`);
      }
      return { ...world, eventGenerators: [...world.eventGenerators, event.generator] };
    }
  }
}
