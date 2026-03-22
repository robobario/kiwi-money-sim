package com.github.robobario.gestures;

import com.github.robobario.events.Event;

import java.time.Instant;
import java.util.List;

// represents an action or event in the real world, as distinct from events in the modelled world like account credit/debits
// buying an assert
// opening a mortgage account
// starting an investment account
public interface Gesture {
    // a gesture can generate low-level world effecting events, like the creation or removal of an Account
    // an event could also register an event generator
    List<Event> events();

    // the day the gesture occurs
    Instant day();
}
