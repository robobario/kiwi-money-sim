package com.github.robobario.model;

import com.github.robobario.events.Event;
import com.github.robobario.events.EventGenerator;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.stream.Stream;

public record World(Instant currentDay, List<Account> accounts, List<EventGenerator> eventGenerators, List<Event> eventHistory) {
    public World {
        Objects.requireNonNull(accounts);
        Objects.requireNonNull(currentDay);
        Objects.requireNonNull(eventGenerators);
        Objects.requireNonNull(eventHistory);
        if (!currentDay.equals(currentDay.truncatedTo(ChronoUnit.DAYS))) {
            throw new IllegalStateException("world time only advances by day");
        }
    }

    public static World initial(List<Account> accounts, List<EventGenerator> eventGenerators, Instant startDay) {
        return new World(startDay, accounts, eventGenerators, new ArrayList<>());
    }

    public World advanceDay() {
        World newWorld = new World(currentDay.plus(1, ChronoUnit.DAYS), accounts, eventGenerators, eventHistory);
        List<Event> events = generateEvents(newWorld);
        return newWorld.applyEvents(events);
    }

    public World applyEvents(List<Event> events) {
        World newWorld = this;
        for (Event event : events) {
            World afterApply = event.apply(newWorld);
            if (afterApply == null) {
                throw new IllegalStateException("event " + event + " returned a null world, bad event!");
            }
            newWorld = afterApply;
        }
        return newWorld.withEvents(events);
    }

    private World withEvents(List<Event> events) {
        return new World(currentDay, accounts, eventGenerators, Stream.concat(eventHistory.stream(), events.stream()).toList());
    }

    private List<Event> generateEvents(World world) {
        return eventGenerators.stream().flatMap(eventGenerator -> eventGenerator.generate(world).stream()).toList();
    }

    public Account account(String name) {
        return accounts.stream().filter(account -> account.name().equals(name)).findFirst().orElseThrow();
    }

    public World withNewAccount(String account, Money balance) {
        if (accounts.stream().anyMatch(account1 -> account1.name().equals(account))) {
            throw new IllegalStateException("account named " + account + " exists already");
        }
        return new World(currentDay, Stream.concat(accounts.stream(), Stream.of(new Account(account, balance))).toList(), eventGenerators, eventHistory);
    }

    public World withEventGenerator(EventGenerator eventGenerator) {
        if (eventGenerators.stream().anyMatch(generator -> generator.name().equals(eventGenerator.name()))) {
            throw new IllegalStateException("event generator named " + eventGenerator + " exists already");
        }
        return new World(currentDay, accounts, Stream.concat(eventGenerators.stream(), Stream.of(eventGenerator)).toList(), eventHistory);
    }
}
