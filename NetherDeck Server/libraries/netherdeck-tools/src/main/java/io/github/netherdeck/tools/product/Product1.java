package io.github.netherdeck.tools.product;

import io.github.netherdeck.tools.func.Func;
import io.github.netherdeck.tools.func.Func1;
import java.lang.IndexOutOfBoundsException;
import java.lang.Object;
import java.lang.Override;
import java.lang.String;
import java.util.Objects;

public class Product1<T1> implements Product {
  public final T1 _1;

  Product1(T1 t1) {
    this._1 = t1;
  }

  public <R> R map(Func1<T1, R> func) {
    return func.apply(_1);
  }

  @Override
  public <R> R map(Func<R> func) {
    if (func instanceof Func1) {
      return ((Func1<T1, R>) func).apply(_1);
    }
    return func.applyArray(_1);
  }

  @Override
  public Object productElement(int i) throws IndexOutOfBoundsException {
    switch (i) {
      case 0: return _1;
    }
    throw new IndexOutOfBoundsException("Index: " + i + ", Max: 1");
  }

  @Override
  public int productArity() {
    return 1;
  }

  @Override
  public String toString() {
    return "Product1["+_1+"]";
  }

  @Override
  public boolean equals(Object that) {
    if (this == that) return true;
    if (that == null || this.getClass() != that.getClass()) return false;
    Product1<?> p = (Product1<?>) that;
    return Objects.equals(_1, p._1);
  }

  @Override
  public int hashCode() {
    return Objects.hash(_1);
  }
}
