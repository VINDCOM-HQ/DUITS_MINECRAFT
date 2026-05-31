package io.github.netherdeck.tools.func;

import java.lang.AssertionError;
import java.lang.IllegalArgumentException;
import java.lang.Object;
import java.lang.Override;
import java.lang.SuppressWarnings;
import java.lang.Throwable;

public interface Func5<T1, T2, T3, T4, T5, R> extends Func<R> {
  R apply5(T1 t1, T2 t2, T3 t3, T4 t4, T5 t5) throws Throwable;

  default R apply(T1 t1, T2 t2, T3 t3, T4 t4, T5 t5) {
    try {
      return apply5(t1,t2,t3,t4,t5);
    } catch (Throwable t) {
      Func.throwException(t);
      throw new AssertionError();
    }
  }

  @Override
  @SuppressWarnings("unchecked")
  default R applyArray(Object... args) {
    if (args.length < 5) {
      throw new IllegalArgumentException();
    }
    return apply((T1) args[0],(T2) args[1],(T3) args[2],(T4) args[3],(T5) args[4]);
  }

  static <T1, T2, T3, T4, T5, T6> Func5<T1, T2, T3, T4, T5, T6> y(
      Func1<Func5<T1, T2, T3, T4, T5, T6>, Func5<T1, T2, T3, T4, T5, T6>> comp) {
    return comp.apply((p1,p2,p3,p4,p5) -> y(comp).apply(p1,p2,p3,p4,p5));
  }
}
