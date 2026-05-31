package io.github.netherdeck.tools.func;

import java.lang.AssertionError;
import java.lang.IllegalArgumentException;
import java.lang.Object;
import java.lang.Override;
import java.lang.SuppressWarnings;
import java.lang.Throwable;
import java.util.function.BiFunction;

public interface Func2<T1, T2, R> extends Func<R>, BiFunction<T1, T2, R> {
  R apply2(T1 t1, T2 t2) throws Throwable;

  default R apply(T1 t1, T2 t2) {
    try {
      return apply2(t1,t2);
    } catch (Throwable t) {
      Func.throwException(t);
      throw new AssertionError();
    }
  }

  @Override
  @SuppressWarnings("unchecked")
  default R applyArray(Object... args) {
    if (args.length < 2) {
      throw new IllegalArgumentException();
    }
    return apply((T1) args[0],(T2) args[1]);
  }

  static <T1, T2, T3> Func2<T1, T2, T3> y(Func1<Func2<T1, T2, T3>, Func2<T1, T2, T3>> comp) {
    return comp.apply((p1,p2) -> y(comp).apply(p1,p2));
  }
}
