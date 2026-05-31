package io.github.netherdeck.common.mod.util.remapper;

public interface RemappingClassLoader {

    ClassLoaderRemapper getRemapper();

    NetherDeckRemapConfig getRemapConfig();
}
