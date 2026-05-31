package io.github.netherdeck.api;

import java.util.Objects;

public class NetherDeckVersion {

    public static final NetherDeckVersion v1_14 = new NetherDeckVersion("1.14.4", 1140, "v1_14_R1");
    public static final NetherDeckVersion v1_15 = new NetherDeckVersion("1.15.2", 1152, "v1_15_R1");
    public static final NetherDeckVersion v1_16 = new NetherDeckVersion("1.16.3", 1163, "v1_16_R2");
    public static final NetherDeckVersion v1_16_4 = new NetherDeckVersion("1.16.4", 1164, "v1_16_R3");
    public static final NetherDeckVersion v1_17_R1 = new NetherDeckVersion("1.17", 1170, "v1_17_R1");
    public static final NetherDeckVersion v1_18_R1 = new NetherDeckVersion("1.18", 1180, "v1_18_R1");
    public static final NetherDeckVersion v1_18_R2 = new NetherDeckVersion("1.18.2", 1182, "v1_18_R2");
    public static final NetherDeckVersion v1_19_R1 = new NetherDeckVersion("1.19.1", 1191, "v1_19_R1", "Horn");
    public static final NetherDeckVersion HORN = v1_19_R1;
    public static final NetherDeckVersion GREAT_HORN = new NetherDeckVersion("1.19.3", 1193, "v1_19_R2", "GreatHorn");
    public static final NetherDeckVersion EXECUTIONS = new NetherDeckVersion("1.19.4", 1194, "v1_19_R3", "Executions");
    public static final NetherDeckVersion TRIALS = new NetherDeckVersion("1.20", 1200, "v1_20_R1", "Trials");
    public static final NetherDeckVersion NET = new NetherDeckVersion("1.20.2", 1202, "v1_20_R2", "Net");
    public static final NetherDeckVersion WHISPER = new NetherDeckVersion("1.20.4", 1204, "v1_20_R3", "Whisper");
    public static final NetherDeckVersion PILLARS = new NetherDeckVersion("1.20.6", 1206, "v1_20_R4", "Pillars");
    public static final NetherDeckVersion FEUDAL_KINGS = new NetherDeckVersion("1.21", 1210, "v1_21_R1", "FeudalKings");
    public static final NetherDeckVersion HEART = new NetherDeckVersion("1.21.3", 1213, "v1_21_R2", "Heart");

    private final String name;
    private final int num;
    private final String pkg;
    private final String releaseName;

    public NetherDeckVersion(String name, int num, String pkg) {
        this(name, num, pkg, null);
    }

    public NetherDeckVersion(String name, int num, String pkg, String releaseName) {
        this.name = name;
        this.num = num;
        this.pkg = pkg;
        this.releaseName = releaseName;
    }

    public String getName() {
        return name;
    }

    public String packageName() {
        return pkg;
    }

    public String getReleaseName() {
        return releaseName;
    }

    @Override
    public String toString() {
        return "NetherDeckVersion{" +
            "name='" + name + '\'' +
            ", num=" + num +
            ", releaseName='" + releaseName + '\'' +
            '}';
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        NetherDeckVersion that = (NetherDeckVersion) o;
        return num == that.num &&
            Objects.equals(name, that.name);
    }

    @Override
    public int hashCode() {
        return Objects.hash(name, num);
    }

    private static NetherDeckVersion version;

    public static NetherDeckVersion current() {
        if (NetherDeckVersion.version == null) throw new IllegalStateException("Version is not set!");
        return version;
    }

    public static void setVersion(NetherDeckVersion version) {
        if (NetherDeckVersion.version != null) throw new IllegalStateException("Version is already set!");
        if (version == null) throw new IllegalArgumentException("Version cannot be null!");
        NetherDeckVersion.version = version;
    }

    public static boolean atLeast(NetherDeckVersion v) {
        return v.num <= version.num;
    }

    public static boolean lesserThan(NetherDeckVersion v) {
        return v.num > version.num;
    }
}
