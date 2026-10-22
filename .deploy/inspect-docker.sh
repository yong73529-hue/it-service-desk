#!/usr/bin/env bash
set -u
echo "DOCKER"
docker --version
echo "COMPOSE"
docker compose version 2>/dev/null || true
echo "CONTAINERS"
sudo docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Ports}}'
echo "NETWORKS"
sudo docker network ls
echo "MOUNTS_80_443"
for id in $(sudo docker ps -q --filter publish=80 --filter publish=443); do
  sudo docker inspect "$id" --format '{{.Name}} image={{.Config.Image}} networks={{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}} mounts={{range .Mounts}}{{.Source}}:{{.Destination}} {{end}}'
done
echo "COMPOSE_FILES"
sudo find /opt /home/ubuntu -maxdepth 4 -type f \( -name 'docker-compose.yml' -o -name 'compose.yml' -o -name 'Caddyfile' -o -name 'nginx.conf' \) 2>/dev/null
