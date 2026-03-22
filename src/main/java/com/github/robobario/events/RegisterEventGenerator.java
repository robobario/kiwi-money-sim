package com.github.robobario.events;

import com.github.robobario.model.World;

public record RegisterEventGenerator(String name, EventGenerator eventGenerator) implements Event {
    @Override
    public World apply(World world) {
        return world.withEventGenerator(eventGenerator);
    }
}
