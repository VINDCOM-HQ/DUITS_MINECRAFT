#!/bin/bash
# Pre-installs NeoForge server during Docker build so the container starts without
# internet access. netherdeck.hypertention.cn (primary mirror) is unreachable;
# this script fetches everything from official public sources.
#
# Must be run from /minecraft (the server working directory).
set -euo pipefail

NEOFORGE_VER="21.1.216"
MAVEN_CENTRAL="https://repo1.maven.org/maven2"
SPONGE_MAVEN="https://repo.spongepowered.org/maven"
NEOFORGED_MAVEN="https://maven.neoforged.net/releases"

INSTALLER_PATH="libraries/net/neoforged/neoforge/${NEOFORGE_VER}/neoforge-${NEOFORGE_VER}-installer.jar"

echo "==> [NeoForge pre-install] Downloading NeoForge ${NEOFORGE_VER} installer..."
mkdir -p "$(dirname "${INSTALLER_PATH}")"
wget -q --show-progress -O "${INSTALLER_PATH}" \
    "${NEOFORGED_MAVEN}/net/neoforged/neoforge/${NEOFORGE_VER}/neoforge-${NEOFORGE_VER}-installer.jar"

echo "==> [NeoForge pre-install] Running installer (downloads Minecraft server jar + NeoForge runtime libs)..."
java -jar "${INSTALLER_PATH}" --installServer .

echo "==> [NeoForge pre-install] Pre-downloading NetherDeck launcher dependencies (installer.json libraries)..."

# Download a Maven artifact to libraries/ using standard Maven path layout.
# Usage: dl <groupId:artifactId:version> [base_url]
dl() {
    local coord="$1"
    local base="${2:-${MAVEN_CENTRAL}}"
    local g a v
    g=$(echo "$coord" | cut -d: -f1)
    a=$(echo "$coord" | cut -d: -f2)
    v=$(echo "$coord" | cut -d: -f3)
    local gpath="${g//.//}"
    local path="libraries/${gpath}/${a}/${v}/${a}-${v}.jar"
    if [ -f "$path" ]; then
        echo "  [skip] ${a}-${v}.jar"
        return 0
    fi
    mkdir -p "$(dirname "$path")"
    echo "  [get]  ${a}-${v}.jar"
    wget -q -O "$path" "${base}/${gpath}/${a}/${v}/${a}-${v}.jar"
}

# --- Maven Central ---
dl "org.yaml:snakeyaml:2.2"
dl "org.xerial:sqlite-jdbc:3.42.0.1"
dl "com.mysql:mysql-connector-j:8.1.0"
dl "com.googlecode.json-simple:json-simple:1.1.1"
dl "org.apache.logging.log4j:log4j-jul:2.19.0"
dl "net.md-5:SpecialSource:1.11.3"
dl "jline:jline:2.12.1"
dl "org.jline:jline-terminal-jansi:3.12.1"
dl "org.apache.maven:maven-resolver-provider:3.8.5"
dl "org.apache.maven.resolver:maven-resolver-connector-basic:1.7.3"
dl "org.apache.maven.resolver:maven-resolver-transport-http:1.7.3"
dl "org.apache.maven:maven-model:3.8.5"
dl "org.codehaus.plexus:plexus-utils:3.3.0"
dl "org.apache.maven:maven-model-builder:3.8.5"
dl "org.codehaus.plexus:plexus-interpolation:1.26"
dl "org.eclipse.sisu:org.eclipse.sisu.inject:0.3.4"
dl "org.apache.maven:maven-builder-support:3.8.5"
dl "org.apache.maven:maven-repository-metadata:3.8.5"
dl "org.apache.maven.resolver:maven-resolver-api:1.6.3"
dl "org.apache.maven.resolver:maven-resolver-spi:1.6.3"
dl "org.apache.maven.resolver:maven-resolver-util:1.6.3"
dl "org.apache.maven.resolver:maven-resolver-impl:1.6.3"
dl "org.apache.httpcomponents:httpclient:4.5.13"
dl "org.apache.httpcomponents:httpcore:4.4.14"
dl "commons-codec:commons-codec:1.15"
dl "org.slf4j:jcl-over-slf4j:1.7.30"
dl "com.typesafe:config:1.3.1"
dl "javax.inject:javax.inject:1"

# --- SpongePowered Maven (configurate) ---
dl "org.spongepowered:configurate-hocon:3.6.1" "${SPONGE_MAVEN}"
dl "org.spongepowered:configurate-core:3.6.1" "${SPONGE_MAVEN}"

echo "==> [NeoForge pre-install] All dependencies downloaded successfully."
