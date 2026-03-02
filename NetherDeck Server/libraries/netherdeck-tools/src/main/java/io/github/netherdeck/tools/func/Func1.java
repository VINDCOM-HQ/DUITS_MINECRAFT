package io.github.netherdeck.tools.func;

import java.lang.AssertionError;
import java.lang.IllegalArgumentException;
import java.lang.Object;
import java.lang.Override;
import java.lang.SuppressWarnings;
import java.lang.Throwable;
import java.util.function.Function;

public interface Func1<T1, R> extends Func<R>, Function<T1, R> {
  R apply1(T1 t1) throws Throwable;

  default R apply(T1 t1) {
    try {
      return apply1(t1);
    } catch (Throwable t) {
      Func.throwException(t);
      throw new AssertionError();
    }
  }

  @Override
  @SuppressWarnings("unchecked")
  default R applyArray(Object... args) {
    if (args.length < 1) {
      throw new IllegalArgumentException();
    }
    return apply((T1) args[0]);
  }

  static <T1, T2> Func1<T1, T2> y(Func1<Func1<T1, T2>, Func1<T1, T2>> comp) {
    return comp.apply((p1) -> y(comp).apply(p1));
  }
}
