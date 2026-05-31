package io.github.netherdeck.tools.func;

import java.lang.AssertionError;
import java.lang.Object;
import java.lang.Override;
import java.lang.Throwable;

public interface Func0<R> extends Func<R> {
  R apply0() throws Throwable;

  default R apply() {
    try {
      return apply0();
    } catch (Throwable t) {
      Func.throwException(t);
      throw new AssertionError();
    }
  }

  @Override
  default R applyArray(Object... args) {
    return apply();
  }

  static <T1> Func0<T1> y(Func1<Func0<T1>, Func0<T1>> comp) {
    return comp.apply(() -> y(comp).apply());
  }
}
