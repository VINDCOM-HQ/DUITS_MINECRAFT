package io.github.netherdeck.common.mod.mixins.annotation;

import io.github.netherdeck.api.NetherDeckPlatform;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

@Target(ElementType.TYPE)
@Retention(RetentionPolicy.CLASS)
public @interface OnlyInPlatform {

    NetherDeckPlatform[] value();
}
