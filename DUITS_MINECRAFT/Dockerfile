# syntax=docker/dockerfile:1
# ---------- 1) Base & packages ----------
FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive

# Install wget/curl, then download and install Oracle JDK 24
RUN apt-get update && apt-get upgrade -y && \
    apt-get install -y --no-install-recommends wget curl ca-certificates && \
    wget -O /tmp/jdk-24_linux-x64_bin.deb https://download.oracle.com/java/24/latest/jdk-24_linux-x64_bin.deb && \
    apt-get install -y /tmp/jdk-24_linux-x64_bin.deb && \
    rm /tmp/jdk-24_linux-x64_bin.deb

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

# ---------- 3) Download PaperMC ----------
RUN wget -O /minecraft/paper.jar \
    https://api.papermc.io/v2/projects/paper/versions/1.21.11/builds/69/downloads/paper-1.21.11-69.jar \
  && chown minecraft:minecraft /minecraft/paper.jar

# ---------- 4) Copy configs & scripts ----------
COPY DUITS_MINECRAFT/smb.conf               /etc/samba/smb.conf.tmpl
COPY DUITS_MINECRAFT/supervisord.conf        /etc/supervisor/supervisord.conf.tmpl
COPY DUITS_MINECRAFT/entrypoint.sh           /usr/local/bin/entrypoint.sh
COPY DUITS_MINECRAFT/samba-repair.sh         /samba-repair.sh
COPY DUITS_MINECRAFT/logrotate.conf          /etc/logrotate.d/minecraft
RUN chmod +x /usr/local/bin/entrypoint.sh /samba-repair.sh

# ---------- 5) Copy & install agent relay ----------
COPY --chown=agent:agent agent/ /opt/agent/
RUN cd /opt/agent && npm ci --omit=dev --omit=optional --ignore-scripts && rm -f .env

# ---------- 6) Healthcheck ----------
HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=120s \
  CMD nc -z localhost 25565 || exit 1

# ---------- 7) Expose ----------
EXPOSE 25565 25575 445 139 137/udp 138/udp 3500

WORKDIR /minecraft
ENTRYPOINT [ "/usr/local/bin/entrypoint.sh" ]
