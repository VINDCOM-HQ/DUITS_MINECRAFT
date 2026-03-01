# ---------- 1) Base & packages ----------
FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive

# Install wget and dependencies first
RUN apt-get update && apt-get upgrade -y && apt-get install -y wget curl ca-certificates

# Download and install Oracle JDK 24
RUN wget -O /tmp/jdk-24_linux-x64_bin.deb https://download.oracle.com/java/24/latest/jdk-24_linux-x64_bin.deb \
    && apt-get update \
    && apt-get install -y /tmp/jdk-24_linux-x64_bin.deb \
    && rm /tmp/jdk-24_linux-x64_bin.deb

# Verify Java installation
RUN java -version

# Install other required packages
RUN apt-get update && apt-get install -y \
    samba \
    tdb-tools \
    mysql-server \
    supervisor \
    iproute2 \
    net-tools \
    procps \
    python3-full \
    python3-venv \
    logrotate \
    cron \
  && rm -rf /var/lib/apt/lists/*

# Create a virtual environment for Python packages
ENV VIRTUAL_ENV=/opt/venv
RUN python3 -m venv $VIRTUAL_ENV
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

# Install and update vulnerable packages to address security issues within the virtual environment
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir cryptography==43.0.1 idna==3.7 protobuf==6.30.2

# Verify installed package versions
RUN echo "Verifying security-critical package versions:" && \
    pip show cryptography | grep "Version:" && \
    pip show idna | grep "Version:" && \
    pip show protobuf | grep "Version:"

# ---------- 2) Prepare directories ----------
# Samba needs its run & cache dirs, plus we'll use volumes for these logs
RUN mkdir -p \
      /var/run/samba \
      /var/cache/samba \
      /var/lib/samba/private \
      /var/log/samba \
      /var/log/supervisor \
      /minecraft \
  && chown -R root:root /var/run/samba /var/cache/samba /var/lib/samba /var/lib/samba/private \
  && chmod 1777 /var/run/samba

# Initialize an empty Samba passdb (needed for security=user with guest ok)
# (-n = no password, -a = add user)
RUN smbpasswd -an root || true

# ---------- 3) Download PaperMC ----------
RUN wget -O /minecraft/paper.jar \
    https://api.papermc.io/v2/projects/paper/versions/1.21.4/builds/225/downloads/paper-1.21.4-225.jar

# ---------- 4) Copy configs & scripts ----------
COPY smb.conf               /etc/samba/smb.conf
COPY supervisord.conf       /etc/supervisor/supervisord.conf
COPY entrypoint.sh          /usr/local/bin/entrypoint.sh
COPY samba-repair.sh        /samba-repair.sh
COPY logrotate.conf         /etc/logrotate.d/minecraft
RUN chmod +x /usr/local/bin/entrypoint.sh /samba-repair.sh

# ---------- 5) Expose & volumes ----------
EXPOSE 25565 25575 445 139 137/udp 138/udp
VOLUME [ "/minecraft", "/var/lib/mysql", "/var/log/samba", "/var/log/supervisor" ]

WORKDIR /minecraft
ENTRYPOINT [ "/usr/local/bin/entrypoint.sh" ]
