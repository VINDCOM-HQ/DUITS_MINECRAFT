package io.github.netherdeck.common.bridge.bukkit;

import org.bukkit.plugin.PluginDescriptionFile;
import org.bukkit.plugin.SimplePluginManager;

import java.util.logging.Logger;

public interface PluginClassLoaderBridge {
    PluginDescriptionFile netherdeck$desc();
    Class<?> netherdeck$loadFromExternal(String name, boolean initialize, boolean checkLibraries) throws ClassNotFoundException;
    SimplePluginManager netherdeck$getPluginManager();
    Logger netherdeck$systemLogger();
}
