package com.github.robobario.model;

import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;
import java.util.Objects;

public record Money(BigDecimal dollars) {
    public Money {
        Objects.requireNonNull(dollars);
    }

    public static final MathContext MATH_CONTEXT = MathContext.DECIMAL128;
    public static final Money ZERO = new Money(BigDecimal.ZERO);

    public static Money dollars(int dollars) {
        return dollars(BigDecimal.valueOf(dollars));
    }
    public static Money dollars(BigDecimal dollars) {
        return new Money(dollars);
    }

    public Money add(Money value) {
        return new Money(dollars.add(value.dollars(), MATH_CONTEXT));
    }

    @Override
    public String toString() {
        return "$" + dollars.setScale(1, RoundingMode.HALF_UP);
    }

    public Money negate() {
        return new Money(dollars.negate(MATH_CONTEXT));
    }
}
