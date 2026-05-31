package io.github.netherdeck.tools.collection;

public class TypedKey<A> {

    private final String displayName;

    private TypedKey(String displayName) {
        this.displayName = displayName;
    }

    @Override
    public String toString() {
        return displayName == null ? super.toString() : displayName;
    }

    public static <A> TypedKey<A> of() {
        return new TypedKey<>(null);
    }

    public static <A> TypedKey<A> of(String displayName) {
        return new TypedKey<>(displayName);
    }
}
