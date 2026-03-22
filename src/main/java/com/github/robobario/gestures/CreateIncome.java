package com.github.robobario.gestures;

import com.github.robobario.events.Event;
import com.github.robobario.events.Frequency;
import com.github.robobario.events.RegisterEventGenerator;
import com.github.robobario.events.RepeatTransferGenerator;
import com.github.robobario.model.Money;
import com.github.robobario.model.World;
import com.github.robobario.simulation.Simulation;

import java.time.Instant;
import java.util.List;

public record CreateIncome(Instant day, String name, Frequency frequency, Money amount, String toAccountName, String fromAccountName) implements Gesture {

    @Override
    public String toString() {
        return "create income '" + name + "' of " + amount + " repeating " + frequency + " to account " + toAccountName + " from " + fromAccountName;
    }

    @Override
    public List<Event> events() {
        return List.of(new RegisterEventGenerator(name, new RepeatTransferGenerator(day, fromAccountName, toAccountName, amount, frequency, name)));
    }
}
