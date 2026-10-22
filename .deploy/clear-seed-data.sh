#!/usr/bin/env bash
set -euo pipefail

app_dir=/opt/it-service-desk
db_file="$app_dir/data/itdesk.db"
backup_dir="$app_dir/backups"
stamp=$(date +%Y%m%d%H%M%S)

sudo install -d -m 750 "$backup_dir"
cd "$app_dir"
sudo docker compose -f docker-compose.server.yml stop itdesk >/dev/null
sudo cp "$db_file" "$backup_dir/itdesk-before-seed-clear-$stamp.db"
sudo chmod 600 "$backup_dir/itdesk-before-seed-clear-$stamp.db"
sudo docker compose -f docker-compose.server.yml start itdesk >/dev/null

for attempt in $(seq 1 20); do
  status=$(sudo docker inspect -f '{{.State.Health.Status}}' it-service-desk 2>/dev/null || true)
  [ "$status" = "healthy" ] && break
  sleep 2
done

sudo docker compose -f docker-compose.server.yml exec -T itdesk node - <<'NODE'
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const before = {
    tickets: await prisma.ticket.count(),
    users: await prisma.user.count(),
  };
  const result = await prisma.$transaction(async (tx) => {
    const tickets = await tx.ticket.deleteMany({});
    const users = await tx.user.deleteMany({ where: { wecomUserId: null } });
    const departments = await tx.department.deleteMany({ where: { users: { none: {} }, tickets: { none: {} } } });
    return { deletedTickets: tickets.count, deletedTestUsers: users.count, deletedOrphanDepartments: departments.count };
  });
  const remainingUsers = await prisma.user.findMany({ select: { name: true, wecomUserId: true } });
  const after = {
    tickets: await prisma.ticket.count(),
    logs: await prisma.ticketLog.count(),
    comments: await prisma.ticketComment.count(),
    attachments: await prisma.ticketAttachment.count(),
    remainingUsers,
  };
  console.log(JSON.stringify({ before, result, after }, null, 2));
})().finally(() => prisma.$disconnect());
NODE

upload_dir=$(realpath "$app_dir/uploads")
if [ "$upload_dir" != "/opt/it-service-desk/uploads" ]; then
  echo "Unexpected upload path: $upload_dir" >&2
  exit 1
fi
sudo find "$upload_dir" -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +
echo "BACKUP=$backup_dir/itdesk-before-seed-clear-$stamp.db"
