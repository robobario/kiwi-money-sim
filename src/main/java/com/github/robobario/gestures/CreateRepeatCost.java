package com.github.robobario.gestures;

import com.github.robobario.events.Event;
import com.github.robobario.events.Frequency;
import com.github.robobario.events.RegisterEventGenerator;
import com.github.robobario.events.RepeatTransferGenerator;
import com.github.robobario.model.Money;

import java.time.Instant;
import java.util.List;

public record CreateRepeatCost(Instant day, String name, Frequency frequency, Money amount, String fromAccountName, String toAccountName) implements Gesture {

    @Override
    public String toString() {
        return "create repeat cost '" + name + "' of " + amount + " repeating " + frequency + " from account " + fromAccountName + " to world";
    }

    @Override
    public List<Event> events() {
        return List.of(new RegisterEventGenerator(name, new RepeatTransferGenerator(day, fromAccountName, toAccountName, amount, frequency, name)));
    }
}
