package com.github.robobario.events;

import com.github.robobario.model.World;

import java.util.List;

public interface EventGenerator {

    String name();
    List<Event> generate(World world);

}
