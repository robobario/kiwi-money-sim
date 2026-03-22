package com.github.robobario.simulation;

import com.github.robobario.events.Event;
import com.github.robobario.events.Frequency;
import com.github.robobario.gestures.CreateExistingMortgage;
import com.github.robobario.gestures.CreateIncome;
import com.github.robobario.gestures.CreateRepeatCost;
import com.github.robobario.gestures.Gesture;
import com.github.robobario.gestures.InitializeAccount;
import com.github.robobario.model.Account;
import com.github.robobario.model.Money;
import com.github.robobario.model.World;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

public class Simulation {

    public static final String WORLD_ACCOUNT_NAME = "world";
    public static final String CASH_ACCOUNT_NAME = "cash";
    private final List<Gesture> gestures;
    private World world;

    public Simulation(Instant start, List<Gesture> gestures) {
        this.gestures = gestures;
        this.world = World.initial(List.of(), List.of(), start);
        triggerGestures();
    }

    private void triggerGestures() {
        Instant day = world.currentDay();
        gestures.stream().filter(gesture -> gesture.day().equals(day)).forEach(this::triggerGesture);
    }

    private void triggerGesture(Gesture gesture) {
        List<Event> events = gesture.events();
        this.world = world.applyEvents(events);
    }

    private void runUntil(Instant runUntil) {
        while (world.currentDay().isBefore(runUntil)) {
            world = world.advanceDay();
            triggerGestures();
        }
    }

    public static void main(String[] args) {
        Instant today = Instant.now().truncatedTo(ChronoUnit.DAYS);
        List<Gesture> gestures = List.of(
                new InitializeAccount(today, Money.ZERO, WORLD_ACCOUNT_NAME),
                new InitializeAccount(today, Money.ZERO, CASH_ACCOUNT_NAME),
                new CreateIncome(today, "salary", Frequency.FIRST_OF_THE_MONTH, Money.dollars(17000), CASH_ACCOUNT_NAME, WORLD_ACCOUNT_NAME),
                new CreateRepeatCost(today, "living-costs", Frequency.WEEKLY, Money.dollars(1000), CASH_ACCOUNT_NAME, WORLD_ACCOUNT_NAME),
                new CreateRepeatCost(today, "annual-costs", Frequency.FIRST_OF_THE_MONTH, Money.dollars(2040), CASH_ACCOUNT_NAME, WORLD_ACCOUNT_NAME),
                new CreateExistingMortgage(today, "mortgage", Money.dollars(240000), Money.dollars(700000), BigDecimal.valueOf(6.0d), Frequency.FIRST_OF_THE_MONTH, 22,
                        CASH_ACCOUNT_NAME)
        );
        Simulation simulation = new Simulation(today, gestures);
        simulation.runUntil(today.plus(365, ChronoUnit.DAYS));
        for (Account account : simulation.world.accounts()) {
            if (!account.name().equals(WORLD_ACCOUNT_NAME)) {
                System.out.println("account " + account.name() + " has balance " + account.balance() + " at " + simulation.world.currentDay());
            }
        }
    }
}
