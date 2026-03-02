package io.github.netherdeck.tools.func;

public interface Func<R> {

    R applyArray(Object... args);

    @SuppressWarnings("unchecked")
    static <E extends Throwable> void throwException(Throwable t) throws E {
        throw (E) t;
    }
}
