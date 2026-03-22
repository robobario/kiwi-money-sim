package com.github.robobario.events;

import com.github.robobario.model.Account;
import com.github.robobario.model.Money;
import com.github.robobario.model.World;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Objects;

public record InterestPaymentGenerator(Instant startDay, String mortgageAccount, String toAccountName, BigDecimal interestPerAnnum, Frequency frequency, String name) implements EventGenerator {
    public InterestPaymentGenerator {
        Objects.requireNonNull(startDay);
        Objects.requireNonNull(mortgageAccount);
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
            return List.of(new Transfer(mortgageAccount, toAccountName, calculateInterest(world)));
        }
    }

    private Money calculateInterest(World world) {
        var paymentsPerYear = switch (frequency) {
            case DAILY -> 365;
            case WEEKLY -> 52;
            case FIRST_OF_THE_MONTH -> 12;
        };
        BigDecimal monthlyRate = interestPerAnnum
                .divide(BigDecimal.valueOf(100), 10, RoundingMode.HALF_UP)
                .divide(BigDecimal.valueOf(paymentsPerYear), 10, RoundingMode.HALF_UP);
        Account account = world.account(mortgageAccount);
        return Money.dollars(account.balance().negate().dollars().multiply(monthlyRate).setScale(2, RoundingMode.HALF_UP));
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
