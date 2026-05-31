package io.github.netherdeck.common.mod.util.remapper;

import java.io.DataInput;
import java.io.DataOutput;
import java.io.IOException;

/*
 * Used to record transformation detail for specific ClassLoaders.
 */
public record NetherDeckRemapConfig(boolean remap) {
    public static final NetherDeckRemapConfig PLUGIN = new NetherDeckRemapConfig(true);

    public NetherDeckRemapConfig copy() {
        return new NetherDeckRemapConfig(remap);
    }

    public int write(DataOutput output) throws IOException {
        output.writeBoolean(remap);
        return 1;
    }

    public static NetherDeckRemapConfig read(DataInput input) throws IOException {
        return new NetherDeckRemapConfig(input.readBoolean());
    }
}
