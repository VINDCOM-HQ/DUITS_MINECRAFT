package io.github.netherdeck.tools.product;

import io.github.netherdeck.tools.func.Func;
import io.github.netherdeck.tools.func.Func2;
import java.lang.IndexOutOfBoundsException;
import java.lang.Object;
import java.lang.Override;
import java.lang.String;
import java.util.Objects;

public class Product2<T1, T2> implements Product {
  public final T1 _1;

  public final T2 _2;

  Product2(T1 t1, T2 t2) {
    this._1 = t1;
    this._2 = t2;
  }

  public <R> R map(Func2<T1, T2, R> func) {
    return func.apply(_1,_2);
  }

  @Override
  public <R> R map(Func<R> func) {
    if (func instanceof Func2) {
      return ((Func2<T1, T2, R>) func).apply(_1,_2);
    }
    return func.applyArray(_1,_2);
  }

  @Override
  public Object productElement(int i) throws IndexOutOfBoundsException {
    switch (i) {
      case 0: return _1;
      case 1: return _2;
    }
    throw new IndexOutOfBoundsException("Index: " + i + ", Max: 2");
  }

  @Override
  public int productArity() {
    return 2;
  }

  @Override
  public String toString() {
    return "Product2["+_1+","+_2+"]";
  }

  @Override
  public boolean equals(Object that) {
    if (this == that) return true;
    if (that == null || this.getClass() != that.getClass()) return false;
    Product2<?, ?> p = (Product2<?, ?>) that;
    return Objects.equals(_1, p._1) && Objects.equals(_2, p._2);
  }

  @Override
  public int hashCode() {
    return Objects.hash(_1,_2);
  }
}
