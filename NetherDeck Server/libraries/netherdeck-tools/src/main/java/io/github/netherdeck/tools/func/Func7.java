package io.github.netherdeck.tools.func;

import java.lang.AssertionError;
import java.lang.IllegalArgumentException;
import java.lang.Object;
import java.lang.Override;
import java.lang.SuppressWarnings;
import java.lang.Throwable;

public interface Func7<T1, T2, T3, T4, T5, T6, T7, R> extends Func<R> {
  R apply7(T1 t1, T2 t2, T3 t3, T4 t4, T5 t5, T6 t6, T7 t7) throws Throwable;

  default R apply(T1 t1, T2 t2, T3 t3, T4 t4, T5 t5, T6 t6, T7 t7) {
    try {
      return apply7(t1,t2,t3,t4,t5,t6,t7);
    } catch (Throwable t) {
      Func.throwException(t);
      throw new AssertionError();
    }
  }

  @Override
  @SuppressWarnings("unchecked")
  default R applyArray(Object... args) {
    if (args.length < 7) {
      throw new IllegalArgumentException();
    }
    return apply((T1) args[0],(T2) args[1],(T3) args[2],(T4) args[3],(T5) args[4],(T6) args[5],(T7) args[6]);
  }

  static <T1, T2, T3, T4, T5, T6, T7, T8> Func7<T1, T2, T3, T4, T5, T6, T7, T8> y(
      Func1<Func7<T1, T2, T3, T4, T5, T6, T7, T8>, Func7<T1, T2, T3, T4, T5, T6, T7, T8>> comp) {
    return comp.apply((p1,p2,p3,p4,p5,p6,p7) -> y(comp).apply(p1,p2,p3,p4,p5,p6,p7));
  }
}
