# syntax=docker/dockerfile:1
# ---------- 1) Base & packages ----------
FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive

# Install OpenJDK 21 LTS (NetherDeck targets Java 21; max supported is Java 22)
RUN apt-get update && apt-get upgrade -y && \
    apt-get install -y --no-install-recommends wget curl ca-certificates openjdk-21-jdk-headless && \
    rm -rf /var/lib/apt/lists/*

# Verify Java installation
RUN java -version

# Install remaining packages (samba, mysql, supervisor, networking tools, logrotate, cron, netcat for healthcheck)
RUN apt-get update && apt-get install -y --no-install-recommends \
    samba \
    tdb-tools \
    mysql-server \
    supervisor \
    iproute2 \
    net-tools \
    procps \
    logrotate \
    cron \
    netcat-openbsd \
  && rm -rf /var/lib/apt/lists/*

# Install Node.js 22 LTS for agent relay
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

# ---------- 2) Create users & directories ----------
# Create minecraft user for running the game server (non-root)
RUN useradd -r -m -d /minecraft -s /bin/false minecraft
# Create agent user for running the relay server (non-root)
RUN useradd -r -s /bin/false -d /opt/agent agent

# Samba needs its run & cache dirs, plus we'll use volumes for logs
RUN mkdir -p \
      /var/run/samba \
      /var/cache/samba \
      /var/lib/samba/private \
      /var/log/samba \
      /var/log/supervisor \
      /var/run/mysqld \
      /minecraft \
      /opt/agent \
  && chown -R root:root /var/run/samba /var/cache/samba /var/lib/samba /var/lib/samba/private \
  && (chown -R mysql:mysql /var/run/mysqld || true) \
  && chmod 755 /var/run/samba

# ---------- 3) Copy NetherDeck server jar ----------
ARG LOADER=neoforge
# JAR_HASH is passed at build time to bust the Docker layer cache when the JAR changes
ARG JAR_HASH=unknown
COPY ["NetherDeck Server/bootstrap/build/libs/", "/tmp/netherdeck-jars/"]
RUN cp /tmp/netherdeck-jars/netherdeck-${LOADER}-*.jar /minecraft/paper.jar \
  && chown minecraft:minecraft /minecraft/paper.jar \
  && rm -rf /tmp/netherdeck-jars

# ---------- 3a) Bundle ViaVersion plugins for cross-version client support ----------
RUN mkdir -p /minecraft/plugins
COPY ["NetherDeck Server/libraries/via/", "/minecraft/plugins/"]
RUN chown -R minecraft:minecraft /minecraft/plugins

# ---------- 3b-pre) Seed default netherdeck.yml (world-map enabled by default) ----------
COPY container/netherdeck.yml /minecraft/netherdeck.yml
RUN chown minecraft:minecraft /minecraft/netherdeck.yml

# ---------- 3b) Pre-install loader dependencies ----------
# netherdeck.hypertention.cn (primary download mirror) is unreachable; we fetch
# NeoForge installer and all installer.json library JARs from public Maven during build.
# Named volume `mc_data` is seeded from image contents on first container start.
WORKDIR /minecraft
COPY container/neoforge-preinstall.sh /tmp/neoforge-preinstall.sh
RUN sed -i 's/\r//' /tmp/neoforge-preinstall.sh && chmod +x /tmp/neoforge-preinstall.sh && \
    if [ "$LOADER" = "neoforge" ]; then \
      /tmp/neoforge-preinstall.sh; \
    fi && \
    rm -f /tmp/neoforge-preinstall.sh

# ---------- 4) Copy configs & scripts ----------
COPY container/smb.conf               /etc/samba/smb.conf.tmpl
COPY container/supervisord.conf        /etc/supervisor/supervisord.conf.tmpl
COPY container/entrypoint.sh           /usr/local/bin/entrypoint.sh
COPY container/samba-repair.sh         /samba-repair.sh
COPY container/logrotate.conf          /etc/logrotate.d/minecraft
RUN chmod +x /usr/local/bin/entrypoint.sh /samba-repair.sh

# ---------- 5) Copy & install agent relay ----------
COPY --chown=agent:agent agent/ /opt/agent/
RUN cd /opt/agent && npm ci --omit=dev --omit=optional --ignore-scripts && rm -f .env

# ---------- 6) Build web portal ----------
COPY web/ /opt/web-portal/
RUN cd /opt/web-portal && npm ci && npm run build \
  && rm -rf node_modules src .svelte-kit static \
  && cd /opt/web-portal/build && npm ci --omit=dev \
  && chown -R agent:agent /opt/web-portal

# ---------- 7) Healthcheck ----------
HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=120s \
  CMD nc -z localhost 25565 || exit 1

# ---------- 8) Expose ----------
EXPOSE 25565 25575 445 139 137/udp 138/udp 3500 3000

WORKDIR /minecraft
ENTRYPOINT [ "/usr/local/bin/entrypoint.sh" ]
