package io.github.netherdeck.tools.func;

import java.lang.AssertionError;
import java.lang.IllegalArgumentException;
import java.lang.Object;
import java.lang.Override;
import java.lang.SuppressWarnings;
import java.lang.Throwable;

public interface Func4<T1, T2, T3, T4, R> extends Func<R> {
  R apply4(T1 t1, T2 t2, T3 t3, T4 t4) throws Throwable;

  default R apply(T1 t1, T2 t2, T3 t3, T4 t4) {
    try {
      return apply4(t1,t2,t3,t4);
    } catch (Throwable t) {
      Func.throwException(t);
      throw new AssertionError();
    }
  }

  @Override
  @SuppressWarnings("unchecked")
  default R applyArray(Object... args) {
    if (args.length < 4) {
      throw new IllegalArgumentException();
    }
    return apply((T1) args[0],(T2) args[1],(T3) args[2],(T4) args[3]);
  }

  static <T1, T2, T3, T4, T5> Func4<T1, T2, T3, T4, T5> y(
      Func1<Func4<T1, T2, T3, T4, T5>, Func4<T1, T2, T3, T4, T5>> comp) {
    return comp.apply((p1,p2,p3,p4) -> y(comp).apply(p1,p2,p3,p4));
  }
}
