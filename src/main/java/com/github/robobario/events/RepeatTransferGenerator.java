package com.github.robobario.events;

import com.github.robobario.model.Money;
import com.github.robobario.model.World;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Objects;

public record RepeatTransferGenerator(Instant startDay, String fromAccountName, String toAccountName, Money amount, Frequency frequency, String name) implements EventGenerator {
    public RepeatTransferGenerator {
        Objects.requireNonNull(startDay);
        Objects.requireNonNull(fromAccountName);
        Objects.requireNonNull(toAccountName);
        Objects.requireNonNull(frequency);
        if (!startDay.equals(startDay.truncatedTo(ChronoUnit.DAYS))) {
            throw new IllegalStateException("startDay must be a day");
        }
    }

    @Override
    public List<Event> generate(World world) {
        boolean transfer = shouldTransfer(world.currentDay());
        if (!transfer){
            return List.of();
        } else {
            return List.of(new Transfer(fromAccountName, toAccountName, amount));
        }
    }

    private boolean shouldTransfer(Instant currentDay) {
        return switch (frequency) {
            case DAILY -> true;
            case WEEKLY -> sameDayOfWeek(currentDay, startDay);
            case FIRST_OF_THE_MONTH -> isFirstOfMonth(currentDay);
        };
    }

    private boolean isFirstOfMonth(Instant currentDay) {
        int dayOfMonth = currentDay.atZone(ZoneId.of("UTC")).getDayOfMonth();
        return dayOfMonth == 1;
    }

    private boolean sameDayOfWeek(Instant currentDay, Instant startDay) {
        DayOfWeek current = currentDay.atZone(ZoneId.of("UTC")).getDayOfWeek();
        DayOfWeek start = startDay.atZone(ZoneId.of("UTC")).getDayOfWeek();
        return current.equals(start);
    }
}
