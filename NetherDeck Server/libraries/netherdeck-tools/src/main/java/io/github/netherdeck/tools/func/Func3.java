package io.github.netherdeck.tools.func;

import java.lang.AssertionError;
import java.lang.IllegalArgumentException;
import java.lang.Object;
import java.lang.Override;
import java.lang.SuppressWarnings;
import java.lang.Throwable;

public interface Func3<T1, T2, T3, R> extends Func<R> {
  R apply3(T1 t1, T2 t2, T3 t3) throws Throwable;

  default R apply(T1 t1, T2 t2, T3 t3) {
    try {
      return apply3(t1,t2,t3);
    } catch (Throwable t) {
      Func.throwException(t);
      throw new AssertionError();
    }
  }

  @Override
  @SuppressWarnings("unchecked")
  default R applyArray(Object... args) {
    if (args.length < 3) {
      throw new IllegalArgumentException();
    }
    return apply((T1) args[0],(T2) args[1],(T3) args[2]);
  }

  static <T1, T2, T3, T4> Func3<T1, T2, T3, T4> y(
      Func1<Func3<T1, T2, T3, T4>, Func3<T1, T2, T3, T4>> comp) {
    return comp.apply((p1,p2,p3) -> y(comp).apply(p1,p2,p3));
  }
}
