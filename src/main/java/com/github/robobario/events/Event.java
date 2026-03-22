package com.github.robobario.events;

import com.github.robobario.model.World;

/**
 * Events change the world. Altering Account balances, adding and removing EventGenerators
 */
public interface Event {
    World apply(World world);

}
