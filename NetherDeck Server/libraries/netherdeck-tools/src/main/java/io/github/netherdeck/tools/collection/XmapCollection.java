package io.github.netherdeck.tools.collection;

import io.github.netherdeck.tools.func.Func1;

import java.util.AbstractCollection;
import java.util.Arrays;
import java.util.Collection;
import java.util.Iterator;
import java.util.function.Function;

public class XmapCollection<A, B> extends AbstractCollection<B> {

    private final Collection<A> collection;
    private final Func1<? super A, ? extends B> from;
    private final Func1<? super B, ? extends A> to;

    protected XmapCollection(Collection<A> collection, Func1<? super A, ? extends B> from, Func1<? super B, ? extends A> to) {
        this.collection = collection;
        this.from = from;
        this.to = to;
    }

    @Override
    public int size() {
        return collection.size();
    }

    @Override
    public boolean isEmpty() {
        return collection.isEmpty();
    }

    @Override
    public Iterator<B> iterator() {
        Iterator<A> iterator = collection.iterator();
        return new Iterator<B>() {
            @Override
            public boolean hasNext() {
                return iterator.hasNext();
            }

            @Override
            public B next() {
                A ret = iterator.next();
                return ret == null ? null : from.apply(ret);
            }
        };
    }

    @SuppressWarnings("unchecked")
    @Override
    public Object[] toArray() {
        return Arrays.stream(collection.toArray()).map((Function<? super Object, ?>) from).toArray();
    }

    @Override
    public boolean add(B b) {
        return collection.add(to.apply(b));
    }

    @SuppressWarnings("unchecked")
    @Override
    public boolean remove(Object o) {
        return collection.remove(to.apply((B) o));
    }

    @Override
    public void clear() {
        collection.clear();
    }

    public static <A, B> XmapCollection<A, B> create(Collection<A> collection, Class<B> target, Func1<? super A, ? extends B> from, Func1<? super B, ? extends A> to) {
        return new XmapCollection<>(collection, from, to);
    }
}
