package io.github.netherdeck.tools.func;

import java.lang.AssertionError;
import java.lang.IllegalArgumentException;
import java.lang.Object;
import java.lang.Override;
import java.lang.SuppressWarnings;
import java.lang.Throwable;

public interface Func6<T1, T2, T3, T4, T5, T6, R> extends Func<R> {
  R apply6(T1 t1, T2 t2, T3 t3, T4 t4, T5 t5, T6 t6) throws Throwable;

  default R apply(T1 t1, T2 t2, T3 t3, T4 t4, T5 t5, T6 t6) {
    try {
      return apply6(t1,t2,t3,t4,t5,t6);
    } catch (Throwable t) {
      Func.throwException(t);
      throw new AssertionError();
    }
  }

  @Override
  @SuppressWarnings("unchecked")
  default R applyArray(Object... args) {
    if (args.length < 6) {
      throw new IllegalArgumentException();
    }
    return apply((T1) args[0],(T2) args[1],(T3) args[2],(T4) args[3],(T5) args[4],(T6) args[5]);
  }

  static <T1, T2, T3, T4, T5, T6, T7> Func6<T1, T2, T3, T4, T5, T6, T7> y(
      Func1<Func6<T1, T2, T3, T4, T5, T6, T7>, Func6<T1, T2, T3, T4, T5, T6, T7>> comp) {
    return comp.apply((p1,p2,p3,p4,p5,p6) -> y(comp).apply(p1,p2,p3,p4,p5,p6));
  }
}
