package com.github.robobario.gestures;

import com.github.robobario.events.CreateAccount;
import com.github.robobario.events.Event;
import com.github.robobario.events.Frequency;
import com.github.robobario.events.InterestPaymentGenerator;
import com.github.robobario.events.RegisterEventGenerator;
import com.github.robobario.events.RepeatTransferGenerator;
import com.github.robobario.model.Money;
import com.github.robobario.simulation.Simulation;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.List;

// an account with an initial (negative) balance, optional regular payment from cash, interest rate per annum paid regularly
// also materialize an asset account (could also set up inflation etc on that)
public record CreateExistingMortgage(Instant day, String name, Money principal, Money assetValue, BigDecimal interestPerAnnum, Frequency interestDeductionFrequency,
                                     int termYears, String deductPaymentsFromAccount)
        implements Gesture {

    @Override
    public List<Event> events() {
        BigDecimal payment = calculateMonthlyPayment(principal.dollars(), interestPerAnnum, termYears);
        String mortgageAccount = name + "-mortgage";
        return List.of(new CreateAccount(mortgageAccount, principal.negate()),
                new CreateAccount(name + "-house", assetValue),
                new RegisterEventGenerator(mortgageAccount + "-interest-deduction",
                        new InterestPaymentGenerator(day, mortgageAccount, Simulation.WORLD_ACCOUNT_NAME, interestPerAnnum, interestDeductionFrequency,
                                mortgageAccount + "-interest-deduction")),
                new RegisterEventGenerator(mortgageAccount + "-repayment",
                        new RepeatTransferGenerator(day, deductPaymentsFromAccount, mortgageAccount, Money.dollars(payment), interestDeductionFrequency,
                                mortgageAccount + "-repayment")));
    }

    public static BigDecimal calculateMonthlyPayment(BigDecimal principal, BigDecimal annualRatePercent, int years) {
        // 1. Convert annual percentage (e.g., 6.0) to a monthly decimal (0.005)
        BigDecimal monthlyRate = annualRatePercent
                .divide(BigDecimal.valueOf(100), 10, RoundingMode.HALF_UP)
                .divide(BigDecimal.valueOf(12), 10, RoundingMode.HALF_UP);

        int numberOfPayments = years * 12;

        // 2. Calculate (1 + r)^n using Math.pow
        // We convert to double temporarily for the exponentiation
        double ratePlusOne = monthlyRate.add(BigDecimal.ONE).doubleValue();
        double commonFactorDouble = Math.pow(ratePlusOne, numberOfPayments);
        BigDecimal commonFactor = BigDecimal.valueOf(commonFactorDouble);

        // 3. Formula: M = P * [ r(1 + r)^n ] / [ (1 + r)^n – 1 ]
        BigDecimal numerator = monthlyRate.multiply(commonFactor);
        BigDecimal denominator = commonFactor.subtract(BigDecimal.ONE);

        return principal.multiply(numerator)
                .divide(denominator, 2, RoundingMode.HALF_UP);
    }
}
