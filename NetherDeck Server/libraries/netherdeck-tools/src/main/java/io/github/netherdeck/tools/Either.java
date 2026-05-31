package io.github.netherdeck.tools;

import java.util.Objects;
import java.util.Optional;
import java.util.function.Consumer;
import java.util.function.Function;

public abstract class Either<A, B> {

    public abstract Optional<A> left();

    public abstract Optional<B> right();

    public abstract <C, D> Either<C, D> map(Function<? super A, ? extends C> left, Function<? super B, ? extends D> right);

    public abstract <C, D> Either<C, D> flatMap(Function<? super A, ? extends Either<C, D>> left, Function<? super B, ? extends Either<C, D>> right);

    public abstract <T> T fold(Function<? super A, ? extends T> left, Function<? super B, ? extends T> right);

    public abstract Either<A, B> ifLeft(Consumer<? super A> consumer);

    public abstract Either<A, B> ifRight(Consumer<? super B> consumer);

    private static final class Left<A, B> extends Either<A, B> {

        private final A left;

        private Left(A left) {
            Objects.requireNonNull(left, "left");
            this.left = left;
        }

        @Override
        public Optional<A> left() {
            return Optional.of(left);
        }

        @Override
        public Optional<B> right() {
            return Optional.empty();
        }

        @Override
        public <C, D> Either<C, D> map(Function<? super A, ? extends C> left, Function<? super B, ? extends D> right) {
            return new Left<>(left.apply(this.left));
        }

        @Override
        public <C, D> Either<C, D> flatMap(Function<? super A, ? extends Either<C, D>> left, Function<? super B, ? extends Either<C, D>> right) {
            return left.apply(this.left);
        }

        @Override
        public <T> T fold(Function<? super A, ? extends T> left, Function<? super B, ? extends T> right) {
            return left.apply(this.left);
        }

        @Override
        public Either<A, B> ifLeft(Consumer<? super A> consumer) {
            consumer.accept(this.left);
            return this;
        }

        @Override
        public Either<A, B> ifRight(Consumer<? super B> consumer) {
            return this;
        }

        @Override
        public String toString() {
            return "Left[" + left + ']';
        }

        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (o == null || getClass() != o.getClass()) return false;

            Left<?, ?> left1 = (Left<?, ?>) o;

            return Objects.equals(left, left1.left);
        }

        @Override
        public int hashCode() {
            return left.hashCode();
        }
    }

    private static final class Right<A, B> extends Either<A, B> {

        private final B right;

        private Right(B right) {
            Objects.requireNonNull(right, "right");
            this.right = right;
        }

        @Override
        public Optional<A> left() {
            return Optional.empty();
        }

        @Override
        public Optional<B> right() {
            return Optional.of(right);
        }

        @Override
        public <C, D> Either<C, D> map(Function<? super A, ? extends C> left, Function<? super B, ? extends D> right) {
            return new Right<>(right.apply(this.right));
        }

        @Override
        public <C, D> Either<C, D> flatMap(Function<? super A, ? extends Either<C, D>> left, Function<? super B, ? extends Either<C, D>> right) {
            return right.apply(this.right);
        }

        @Override
        public <T> T fold(Function<? super A, ? extends T> left, Function<? super B, ? extends T> right) {
            return right.apply(this.right);
        }

        @Override
        public Either<A, B> ifLeft(Consumer<? super A> consumer) {
            return this;
        }

        @Override
        public Either<A, B> ifRight(Consumer<? super B> consumer) {
            consumer.accept(this.right);
            return this;
        }

        @Override
        public String toString() {
            return "Right[" + right + ']';
        }

        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (o == null || getClass() != o.getClass()) return false;
            Right<?, ?> right1 = (Right<?, ?>) o;
            return Objects.equals(right, right1.right);
        }

        @Override
        public int hashCode() {
            return right.hashCode();
        }
    }

    public final boolean isLeft() {
        return left().isPresent();
    }

    public final boolean isRight() {
        return right().isPresent();
    }

    public final Either<B, A> swap() {
        return fold(Either::right, Either::left);
    }

    public final <C> Either<C, B> mapLeft(Function<? super A, ? extends C> left) {
        return map(left, Function.identity());
    }

    public final <D> Either<A, D> mapRight(Function<? super B, ? extends D> right) {
        return map(Function.identity(), right);
    }

    public static <A, B> Either<A, B> left(A left) {
        return new Left<>(left);
    }

    public static <A, B> Either<A, B> right(B right) {
        return new Right<>(right);
    }
}
