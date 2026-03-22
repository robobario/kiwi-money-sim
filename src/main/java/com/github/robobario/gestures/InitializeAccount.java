package com.github.robobario.gestures;

import com.github.robobario.events.CreateAccount;
import com.github.robobario.events.Event;
import com.github.robobario.model.Money;

import java.time.Instant;
import java.util.List;

public record InitializeAccount(Instant day, Money cash, String accountName) implements Gesture {

    @Override
    public String toString() {
        return "initialize " + accountName + " account with balance: " + cash;
    }

    @Override
    public List<Event> events() {
        return List.of(new CreateAccount(accountName, cash));
    }
}
