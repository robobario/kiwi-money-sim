package com.github.robobario.events;

import com.github.robobario.model.Money;
import com.github.robobario.model.World;

public record CreateAccount(String name, Money balance) implements Event {
    @Override
    public World apply(World world) {
        return world.withNewAccount(name, balance);
    }
}
