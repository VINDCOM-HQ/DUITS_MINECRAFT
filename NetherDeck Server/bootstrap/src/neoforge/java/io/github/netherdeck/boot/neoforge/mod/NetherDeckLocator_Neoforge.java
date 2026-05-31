package io.github.netherdeck.boot.neoforge.mod;

import net.neoforged.neoforgespi.ILaunchContext;
import net.neoforged.neoforgespi.locating.IDiscoveryPipeline;
import net.neoforged.neoforgespi.locating.IModFileCandidateLocator;
import net.neoforged.neoforgespi.locating.IncompatibleFileReporting;
import net.neoforged.neoforgespi.locating.ModFileDiscoveryAttributes;

import java.nio.file.Path;
import java.nio.file.Paths;

public class NetherDeckLocator_Neoforge implements IModFileCandidateLocator {

    private final Path netherdeck;

    public NetherDeckLocator_Neoforge() {
        ModBootstrap.run();
        this.netherdeck = loadJar();
    }

    protected Path loadJar() {
        var version = System.getProperty("netherdeck.version");
        return Paths.get(".netherdeck", "mod_file", version + ".jar");
    }

    @Override
    public void findCandidates(ILaunchContext context, IDiscoveryPipeline pipeline) {
        pipeline.addPath(this.netherdeck, ModFileDiscoveryAttributes.DEFAULT, IncompatibleFileReporting.WARN_ALWAYS);
    }

    @Override
    public String toString() {
        return "netherdeck";
    }
}
