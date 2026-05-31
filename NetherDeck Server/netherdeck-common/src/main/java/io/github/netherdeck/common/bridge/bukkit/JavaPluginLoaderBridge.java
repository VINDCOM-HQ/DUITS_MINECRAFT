package io.github.netherdeck.common.bridge.bukkit;


import org.bukkit.Server;
import org.bukkit.plugin.PluginDescriptionFile;

import java.net.URLClassLoader;
import java.util.List;

public interface JavaPluginLoaderBridge {

    Server netherdeck$server();

    <T extends URLClassLoader & PluginClassLoaderBridge> List<T> netherdeck$getLoaders();

    void bridge$setClass(final String name, final Class<?> clazz);

    Class<?> netherdeck$getClassByName(String name, boolean resolve, PluginDescriptionFile description);
}
