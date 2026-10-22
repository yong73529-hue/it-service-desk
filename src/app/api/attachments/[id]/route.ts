import { readFile } from "node:fs/promises";
import path from "node:path";
import { getCurrentUser, hasRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  const attachment = await prisma.ticketAttachment.findUnique({
    where: { id },
    include: { ticket: { select: { creatorId: true } } },
  });
  if (!attachment) return new Response("Not found", { status: 404 });
  if (
    !hasRole(user, "OPS") &&
    !hasRole(user, "ADMIN") &&
    attachment.ticket.creatorId !== user.id
  )
    return new Response("Forbidden", { status: 403 });

  const uploadRoot = path.resolve(
    process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads", "tickets"),
  );
  const relativePath = attachment.storagePath.replace(
    /^\/uploads\/tickets\//,
    "",
  );
  const filePath = path.resolve(uploadRoot, relativePath);
  if (!filePath.startsWith(`${uploadRoot}${path.sep}`))
    return new Response("Invalid path", { status: 400 });
  try {
    const file = await readFile(filePath);
    return new Response(new Uint8Array(file), {
      headers: {
        "Content-Type": attachment.mimeType,
        "Content-Length": String(file.length),
        "Cache-Control": "private, max-age=300",
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(attachment.originalName)}`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
