package io.github.netherdeck.tools.product;

import io.github.netherdeck.tools.func.Func;
import io.github.netherdeck.tools.func.Func4;
import java.lang.IndexOutOfBoundsException;
import java.lang.Object;
import java.lang.Override;
import java.lang.String;
import java.util.Objects;

public class Product4<T1, T2, T3, T4> implements Product {
  public final T1 _1;

  public final T2 _2;

  public final T3 _3;

  public final T4 _4;

  Product4(T1 t1, T2 t2, T3 t3, T4 t4) {
    this._1 = t1;
    this._2 = t2;
    this._3 = t3;
    this._4 = t4;
  }

  public <R> R map(Func4<T1, T2, T3, T4, R> func) {
    return func.apply(_1,_2,_3,_4);
  }

  @Override
  public <R> R map(Func<R> func) {
    if (func instanceof Func4) {
      return ((Func4<T1, T2, T3, T4, R>) func).apply(_1,_2,_3,_4);
    }
    return func.applyArray(_1,_2,_3,_4);
  }

  @Override
  public Object productElement(int i) throws IndexOutOfBoundsException {
    switch (i) {
      case 0: return _1;
      case 1: return _2;
      case 2: return _3;
      case 3: return _4;
    }
    throw new IndexOutOfBoundsException("Index: " + i + ", Max: 4");
  }

  @Override
  public int productArity() {
    return 4;
  }

  @Override
  public String toString() {
    return "Product4["+_1+","+_2+","+_3+","+_4+"]";
  }

  @Override
  public boolean equals(Object that) {
    if (this == that) return true;
    if (that == null || this.getClass() != that.getClass()) return false;
    Product4<?, ?, ?, ?> p = (Product4<?, ?, ?, ?>) that;
    return Objects.equals(_1, p._1) && Objects.equals(_2, p._2) && Objects.equals(_3, p._3) && Objects.equals(_4, p._4);
  }

  @Override
  public int hashCode() {
    return Objects.hash(_1,_2,_3,_4);
  }
}
