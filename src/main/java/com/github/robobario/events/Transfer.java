package com.github.robobario.events;

import com.github.robobario.model.Account;
import com.github.robobario.model.Money;
import com.github.robobario.model.World;

import java.util.List;
import java.util.stream.Stream;

public record Transfer(String fromAccountName, String toAccountName, Money amount) implements Event {
    @Override
    public World apply(World world) {
        Account from = world.account(fromAccountName).add(amount.negate());
        Account to = world.account(toAccountName).add(amount);
        Stream<Account> otherAccounts = world.accounts().stream()
                .filter(account -> !account.name().equals(fromAccountName) && !account.name().equals(toAccountName));
        List<Account> newAccounts = Stream.concat(Stream.of(from, to), otherAccounts).toList();
        return new World(world.currentDay(), newAccounts, world.eventGenerators(), world.eventHistory());
    }
}
