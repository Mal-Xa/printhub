#!/usr/bin/env bash
# Installs print-agent as a systemd service on Ubuntu (and, later,
# Raspberry Pi OS on the Pi Zero 2 W target -- the steps are identical
# since both use systemd and CUPS).
#
# Usage: sudo ./scripts/install-systemd.sh [install-dir]
# Default install-dir: /opt/print-agent

set -euo pipefail

INSTALL_DIR="${1:-/opt/print-agent}"
SERVICE_USER="printagent"

if [[ "$EUID" -ne 0 ]]; then
  echo "Run this script as root (sudo)." >&2
  exit 1
fi

if ! id "$SERVICE_USER" &>/dev/null; then
  echo "Creating system user '$SERVICE_USER'..."
  useradd --system --create-home --shell /usr/sbin/nologin "$SERVICE_USER"
fi

# CUPS access so the agent can query/submit to local printers.
if getent group lpadmin >/dev/null; then
  usermod -aG lp,lpadmin "$SERVICE_USER"
else
  usermod -aG lp "$SERVICE_USER"
fi

echo "Copying build output to $INSTALL_DIR..."
mkdir -p "$INSTALL_DIR"
cp -r dist node_modules package.json "$INSTALL_DIR/"

if [[ ! -f "$INSTALL_DIR/.env" ]]; then
  cp .env.example "$INSTALL_DIR/.env"
  echo "Wrote $INSTALL_DIR/.env from .env.example -- edit it before starting the service."
fi

mkdir -p /var/lib/print-agent
chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR" /var/lib/print-agent

cp systemd/print-agent.service /etc/systemd/system/print-agent.service
systemctl daemon-reload
systemctl enable print-agent.service

echo "Installed. Edit $INSTALL_DIR/.env, then run:"
echo "  sudo systemctl start print-agent"
echo "  sudo journalctl -u print-agent -f"
