package io.github.netherdeck.tools.product;

import io.github.netherdeck.tools.func.Func;
import io.github.netherdeck.tools.func.Func3;
import java.lang.IndexOutOfBoundsException;
import java.lang.Object;
import java.lang.Override;
import java.lang.String;
import java.util.Objects;

public class Product3<T1, T2, T3> implements Product {
  public final T1 _1;

  public final T2 _2;

  public final T3 _3;

  Product3(T1 t1, T2 t2, T3 t3) {
    this._1 = t1;
    this._2 = t2;
    this._3 = t3;
  }

  public <R> R map(Func3<T1, T2, T3, R> func) {
    return func.apply(_1,_2,_3);
  }

  @Override
  public <R> R map(Func<R> func) {
    if (func instanceof Func3) {
      return ((Func3<T1, T2, T3, R>) func).apply(_1,_2,_3);
    }
    return func.applyArray(_1,_2,_3);
  }

  @Override
  public Object productElement(int i) throws IndexOutOfBoundsException {
    switch (i) {
      case 0: return _1;
      case 1: return _2;
      case 2: return _3;
    }
    throw new IndexOutOfBoundsException("Index: " + i + ", Max: 3");
  }

  @Override
  public int productArity() {
    return 3;
  }

  @Override
  public String toString() {
    return "Product3["+_1+","+_2+","+_3+"]";
  }

  @Override
  public boolean equals(Object that) {
    if (this == that) return true;
    if (that == null || this.getClass() != that.getClass()) return false;
    Product3<?, ?, ?> p = (Product3<?, ?, ?>) that;
    return Objects.equals(_1, p._1) && Objects.equals(_2, p._2) && Objects.equals(_3, p._3);
  }

  @Override
  public int hashCode() {
    return Objects.hash(_1,_2,_3);
  }
}
