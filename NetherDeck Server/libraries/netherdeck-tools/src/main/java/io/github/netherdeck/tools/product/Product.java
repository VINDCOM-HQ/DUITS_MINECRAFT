package io.github.netherdeck.tools.product;

import io.github.netherdeck.tools.func.Func;
import java.lang.IndexOutOfBoundsException;
import java.lang.Object;
import java.util.Arrays;
import java.util.List;

public interface Product {
  <R> R map(Func<R> func);

  Object productElement(int i) throws IndexOutOfBoundsException;

  int productArity();

  default List<?> toList() {
    return map(Arrays::asList);
  }

  static <T1> Product1<T1> of(T1 t1) {
    return new Product1<>(t1);
  }

  static <T1, T2> Product2<T1, T2> of(T1 t1, T2 t2) {
    return new Product2<>(t1,t2);
  }

  static <T1, T2, T3> Product3<T1, T2, T3> of(T1 t1, T2 t2, T3 t3) {
    return new Product3<>(t1,t2,t3);
  }

  static <T1, T2, T3, T4> Product4<T1, T2, T3, T4> of(T1 t1, T2 t2, T3 t3, T4 t4) {
    return new Product4<>(t1,t2,t3,t4);
  }

  static <T1, T2, T3, T4, T5> Product5<T1, T2, T3, T4, T5> of(T1 t1, T2 t2, T3 t3, T4 t4, T5 t5) {
    return new Product5<>(t1,t2,t3,t4,t5);
  }

  static <T1, T2, T3, T4, T5, T6> Product6<T1, T2, T3, T4, T5, T6> of(T1 t1, T2 t2, T3 t3, T4 t4,
      T5 t5, T6 t6) {
    return new Product6<>(t1,t2,t3,t4,t5,t6);
  }

  static <T1, T2, T3, T4, T5, T6, T7> Product7<T1, T2, T3, T4, T5, T6, T7> of(T1 t1, T2 t2, T3 t3,
      T4 t4, T5 t5, T6 t6, T7 t7) {
    return new Product7<>(t1,t2,t3,t4,t5,t6,t7);
  }

  static <T1, T2, T3, T4, T5, T6, T7, T8> Product8<T1, T2, T3, T4, T5, T6, T7, T8> of(T1 t1, T2 t2,
      T3 t3, T4 t4, T5 t5, T6 t6, T7 t7, T8 t8) {
    return new Product8<>(t1,t2,t3,t4,t5,t6,t7,t8);
  }

  static <T1, T2, T3, T4, T5, T6, T7, T8, T9> Product9<T1, T2, T3, T4, T5, T6, T7, T8, T9> of(T1 t1,
      T2 t2, T3 t3, T4 t4, T5 t5, T6 t6, T7 t7, T8 t8, T9 t9) {
    return new Product9<>(t1,t2,t3,t4,t5,t6,t7,t8,t9);
  }

  static <T1, T2, T3, T4, T5, T6, T7, T8, T9, T10> Product10<T1, T2, T3, T4, T5, T6, T7, T8, T9, T10> of(
      T1 t1, T2 t2, T3 t3, T4 t4, T5 t5, T6 t6, T7 t7, T8 t8, T9 t9, T10 t10) {
    return new Product10<>(t1,t2,t3,t4,t5,t6,t7,t8,t9,t10);
  }

  static <T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11> Product11<T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11> of(
      T1 t1, T2 t2, T3 t3, T4 t4, T5 t5, T6 t6, T7 t7, T8 t8, T9 t9, T10 t10, T11 t11) {
    return new Product11<>(t1,t2,t3,t4,t5,t6,t7,t8,t9,t10,t11);
  }

  static <T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12> Product12<T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12> of(
      T1 t1, T2 t2, T3 t3, T4 t4, T5 t5, T6 t6, T7 t7, T8 t8, T9 t9, T10 t10, T11 t11, T12 t12) {
    return new Product12<>(t1,t2,t3,t4,t5,t6,t7,t8,t9,t10,t11,t12);
  }

  static <T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13> Product13<T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13> of(
      T1 t1, T2 t2, T3 t3, T4 t4, T5 t5, T6 t6, T7 t7, T8 t8, T9 t9, T10 t10, T11 t11, T12 t12,
      T13 t13) {
    return new Product13<>(t1,t2,t3,t4,t5,t6,t7,t8,t9,t10,t11,t12,t13);
  }

  static <T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14> Product14<T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14> of(
      T1 t1, T2 t2, T3 t3, T4 t4, T5 t5, T6 t6, T7 t7, T8 t8, T9 t9, T10 t10, T11 t11, T12 t12,
      T13 t13, T14 t14) {
    return new Product14<>(t1,t2,t3,t4,t5,t6,t7,t8,t9,t10,t11,t12,t13,t14);
  }

  static <T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14, T15> Product15<T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14, T15> of(
      T1 t1, T2 t2, T3 t3, T4 t4, T5 t5, T6 t6, T7 t7, T8 t8, T9 t9, T10 t10, T11 t11, T12 t12,
      T13 t13, T14 t14, T15 t15) {
    return new Product15<>(t1,t2,t3,t4,t5,t6,t7,t8,t9,t10,t11,t12,t13,t14,t15);
  }

  static <T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14, T15, T16> Product16<T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14, T15, T16> of(
      T1 t1, T2 t2, T3 t3, T4 t4, T5 t5, T6 t6, T7 t7, T8 t8, T9 t9, T10 t10, T11 t11, T12 t12,
      T13 t13, T14 t14, T15 t15, T16 t16) {
    return new Product16<>(t1,t2,t3,t4,t5,t6,t7,t8,t9,t10,t11,t12,t13,t14,t15,t16);
  }

  static <T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14, T15, T16, T17> Product17<T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14, T15, T16, T17> of(
      T1 t1, T2 t2, T3 t3, T4 t4, T5 t5, T6 t6, T7 t7, T8 t8, T9 t9, T10 t10, T11 t11, T12 t12,
      T13 t13, T14 t14, T15 t15, T16 t16, T17 t17) {
    return new Product17<>(t1,t2,t3,t4,t5,t6,t7,t8,t9,t10,t11,t12,t13,t14,t15,t16,t17);
  }

  static <T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14, T15, T16, T17, T18> Product18<T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14, T15, T16, T17, T18> of(
      T1 t1, T2 t2, T3 t3, T4 t4, T5 t5, T6 t6, T7 t7, T8 t8, T9 t9, T10 t10, T11 t11, T12 t12,
      T13 t13, T14 t14, T15 t15, T16 t16, T17 t17, T18 t18) {
    return new Product18<>(t1,t2,t3,t4,t5,t6,t7,t8,t9,t10,t11,t12,t13,t14,t15,t16,t17,t18);
  }

  static <T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14, T15, T16, T17, T18, T19> Product19<T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14, T15, T16, T17, T18, T19> of(
      T1 t1, T2 t2, T3 t3, T4 t4, T5 t5, T6 t6, T7 t7, T8 t8, T9 t9, T10 t10, T11 t11, T12 t12,
      T13 t13, T14 t14, T15 t15, T16 t16, T17 t17, T18 t18, T19 t19) {
    return new Product19<>(t1,t2,t3,t4,t5,t6,t7,t8,t9,t10,t11,t12,t13,t14,t15,t16,t17,t18,t19);
  }

  static <T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14, T15, T16, T17, T18, T19, T20> Product20<T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14, T15, T16, T17, T18, T19, T20> of(
      T1 t1, T2 t2, T3 t3, T4 t4, T5 t5, T6 t6, T7 t7, T8 t8, T9 t9, T10 t10, T11 t11, T12 t12,
      T13 t13, T14 t14, T15 t15, T16 t16, T17 t17, T18 t18, T19 t19, T20 t20) {
    return new Product20<>(t1,t2,t3,t4,t5,t6,t7,t8,t9,t10,t11,t12,t13,t14,t15,t16,t17,t18,t19,t20);
  }

  static <T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14, T15, T16, T17, T18, T19, T20, T21> Product21<T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14, T15, T16, T17, T18, T19, T20, T21> of(
      T1 t1, T2 t2, T3 t3, T4 t4, T5 t5, T6 t6, T7 t7, T8 t8, T9 t9, T10 t10, T11 t11, T12 t12,
      T13 t13, T14 t14, T15 t15, T16 t16, T17 t17, T18 t18, T19 t19, T20 t20, T21 t21) {
    return new Product21<>(t1,t2,t3,t4,t5,t6,t7,t8,t9,t10,t11,t12,t13,t14,t15,t16,t17,t18,t19,t20,t21);
  }

  static <T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14, T15, T16, T17, T18, T19, T20, T21, T22> Product22<T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14, T15, T16, T17, T18, T19, T20, T21, T22> of(
      T1 t1, T2 t2, T3 t3, T4 t4, T5 t5, T6 t6, T7 t7, T8 t8, T9 t9, T10 t10, T11 t11, T12 t12,
      T13 t13, T14 t14, T15 t15, T16 t16, T17 t17, T18 t18, T19 t19, T20 t20, T21 t21, T22 t22) {
    return new Product22<>(t1,t2,t3,t4,t5,t6,t7,t8,t9,t10,t11,t12,t13,t14,t15,t16,t17,t18,t19,t20,t21,t22);
  }

  static Product fromArray(Object... array) {
    switch (array.length) {
      case 1: return new Product1<>(array[0]);
      case 2: return new Product2<>(array[0],array[1]);
      case 3: return new Product3<>(array[0],array[1],array[2]);
      case 4: return new Product4<>(array[0],array[1],array[2],array[3]);
      case 5: return new Product5<>(array[0],array[1],array[2],array[3],array[4]);
      case 6: return new Product6<>(array[0],array[1],array[2],array[3],array[4],array[5]);
      case 7: return new Product7<>(array[0],array[1],array[2],array[3],array[4],array[5],array[6]);
      case 8: return new Product8<>(array[0],array[1],array[2],array[3],array[4],array[5],array[6],array[7]);
      case 9: return new Product9<>(array[0],array[1],array[2],array[3],array[4],array[5],array[6],array[7],array[8]);
      case 10: return new Product10<>(array[0],array[1],array[2],array[3],array[4],array[5],array[6],array[7],array[8],array[9]);
      case 11: return new Product11<>(array[0],array[1],array[2],array[3],array[4],array[5],array[6],array[7],array[8],array[9],array[10]);
      case 12: return new Product12<>(array[0],array[1],array[2],array[3],array[4],array[5],array[6],array[7],array[8],array[9],array[10],array[11]);
      case 13: return new Product13<>(array[0],array[1],array[2],array[3],array[4],array[5],array[6],array[7],array[8],array[9],array[10],array[11],array[12]);
      case 14: return new Product14<>(array[0],array[1],array[2],array[3],array[4],array[5],array[6],array[7],array[8],array[9],array[10],array[11],array[12],array[13]);
      case 15: return new Product15<>(array[0],array[1],array[2],array[3],array[4],array[5],array[6],array[7],array[8],array[9],array[10],array[11],array[12],array[13],array[14]);
      case 16: return new Product16<>(array[0],array[1],array[2],array[3],array[4],array[5],array[6],array[7],array[8],array[9],array[10],array[11],array[12],array[13],array[14],array[15]);
      case 17: return new Product17<>(array[0],array[1],array[2],array[3],array[4],array[5],array[6],array[7],array[8],array[9],array[10],array[11],array[12],array[13],array[14],array[15],array[16]);
      case 18: return new Product18<>(array[0],array[1],array[2],array[3],array[4],array[5],array[6],array[7],array[8],array[9],array[10],array[11],array[12],array[13],array[14],array[15],array[16],array[17]);
      case 19: return new Product19<>(array[0],array[1],array[2],array[3],array[4],array[5],array[6],array[7],array[8],array[9],array[10],array[11],array[12],array[13],array[14],array[15],array[16],array[17],array[18]);
      case 20: return new Product20<>(array[0],array[1],array[2],array[3],array[4],array[5],array[6],array[7],array[8],array[9],array[10],array[11],array[12],array[13],array[14],array[15],array[16],array[17],array[18],array[19]);
      case 21: return new Product21<>(array[0],array[1],array[2],array[3],array[4],array[5],array[6],array[7],array[8],array[9],array[10],array[11],array[12],array[13],array[14],array[15],array[16],array[17],array[18],array[19],array[20]);
      case 22: return new Product22<>(array[0],array[1],array[2],array[3],array[4],array[5],array[6],array[7],array[8],array[9],array[10],array[11],array[12],array[13],array[14],array[15],array[16],array[17],array[18],array[19],array[20],array[21]);
    }
    throw new IndexOutOfBoundsException();
  }
}
