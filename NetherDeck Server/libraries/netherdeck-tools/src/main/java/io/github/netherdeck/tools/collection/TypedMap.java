package io.github.netherdeck.tools.collection;

import io.github.netherdeck.tools.func.Func0;

import java.util.HashMap;
import java.util.Map;
import java.util.Objects;

public final class TypedMap {

    private final Map<TypedKey<?>, Object> underlying;

    public TypedMap() {
        this.underlying = new HashMap<>();
    }

    public TypedMap(TypedMap map) {
        this.underlying = new HashMap<>(map.underlying);
    }

    private TypedMap(Map<TypedKey<?>, Object> underlying) {
        this.underlying = underlying;
    }

    @SuppressWarnings("unchecked")
    public <A> A get(TypedKey<A> key) {
        return (A) underlying.get(key);
    }

    @SuppressWarnings("unchecked")
    public <A> A getOrElse(TypedKey<A> key, Func0<A> supplier) {
        A ret = (A) underlying.get(key);
        return ret == null ? supplier.apply() : ret;
    }

    @SuppressWarnings("unchecked")
    public <A> A put(TypedKey<A> key, A value) {
        return (A) underlying.put(key, value);
    }

    @SuppressWarnings("unchecked")
    public <A> A remove(TypedKey<A> key) {
        return (A) underlying.remove(key);
    }

    public Map<TypedKey<?>, Object> asMap() {
        return underlying;
    }

    public static Builder builder() {
        return new Builder(HashMap::new);
    }

    public static Builder builder(Func0<Map<TypedKey<?>, Object>> mapSupplier) {
        Objects.requireNonNull(mapSupplier, "mapSupplier");
        return new Builder(mapSupplier);
    }

    public static final class Builder {

        private final Map<TypedKey<?>, Object> underlying = new HashMap<>();
        private final Func0<Map<TypedKey<?>, Object>> mapSupplier;

        private Builder(Func0<Map<TypedKey<?>, Object>> mapSupplier) {
            this.mapSupplier = mapSupplier;
        }

        public <A> Builder put(TypedKey<A> key, A value) {
            underlying.put(key, value);
            return this;
        }

        public TypedMap build() {
            Map<TypedKey<?>, Object> map = mapSupplier.apply();
            map.putAll(underlying);
            return new TypedMap(map);
        }
    }
}
