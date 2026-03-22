package com.github.robobario.model;

public record Account(String name, Money balance) {
    public Account add(Money value) {
        return new Account(name, balance.add(value));
    }
}
