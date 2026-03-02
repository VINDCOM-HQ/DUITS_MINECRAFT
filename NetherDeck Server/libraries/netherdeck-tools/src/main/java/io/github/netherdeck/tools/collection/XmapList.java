package io.github.netherdeck.tools.collection;

import io.github.netherdeck.tools.func.Func1;

import java.util.AbstractList;
import java.util.List;

public class XmapList<A, B> extends AbstractList<B> {

    private final List<A> list;
    private final Func1<? super A, ? extends B> from;
    private final Func1<? super B, ? extends A> to;

    public XmapList(List<A> list, Func1<? super A, ? extends B> from, Func1<? super B, ? extends A> to) {
        this.list = list;
        this.from = from;
        this.to = to;
    }

    @Override
    public B get(int index) {
        A ret = list.get(index);
        return ret == null ? null : from.apply(ret);
    }

    @Override
    public B set(int index, B element) {
        A ret = list.set(index, to.apply(element));
        return ret == null ? null : from.apply(ret);
    }

    @Override
    public void add(int index, B element) {
        list.add(index, to.apply(element));
    }

    @Override
    public boolean add(B b) {
        return list.add(to.apply(b));
    }

    @Override
    public B remove(int index) {
        A ret = list.remove(index);
        return ret == null ? null : from.apply(ret);
    }

    @SuppressWarnings("unchecked")
    @Override
    public boolean remove(Object o) {
        return list.remove(to.apply((B) o));
    }

    @Override
    public void clear() {
        list.clear();
    }

    @Override
    public int size() {
        return list.size();
    }

    @Override
    public boolean isEmpty() {
        return list.isEmpty();
    }

    public static <A, B> XmapList<A, B> create(List<A> list, Class<B> target, Func1<? super A, ? extends B> from, Func1<? super B, ? extends A> to) {
        return list instanceof java.util.RandomAccess
            ? new RandomAccess<>(list, from, to)
            : new XmapList<>(list, from, to);
    }

    private static class RandomAccess<A, B> extends XmapList<A, B> implements java.util.RandomAccess {

        public RandomAccess(List<A> list, Func1<? super A, ? extends B> from, Func1<? super B, ? extends A> to) {
            super(list, from, to);
        }
    }
}
