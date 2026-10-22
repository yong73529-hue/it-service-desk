import ExcelJS from "exceljs";
import { getCurrentUser, hasRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { statusLabels, priorityLabels } from "@/lib/constants";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (!hasRole(user, "ADMIN")) return new Response("Forbidden", { status: 403 });
  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const tickets = await prisma.ticket.findMany({
    where: from || to ? { createdAt: { ...(from ? { gte: new Date(`${from}T00:00:00+08:00`) } : {}), ...(to ? { lte: new Date(`${to}T23:59:59.999+08:00`) } : {}) } } : {},
    include: { creator: true, department: true, assignedTo: true, logs: { where: { toStatus: "CANCELLED" }, orderBy: { createdAt: "desc" } } },
    orderBy: { createdAt: "desc" },
  });
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "天合教育 IT 运维平台";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("工单明细", { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = [
    { header: "工单编号", key: "ticketNo", width: 20 }, { header: "提交时间", key: "createdAt", width: 20 },
    { header: "报修人", key: "creator", width: 12 }, { header: "部门", key: "department", width: 18 },
    { header: "分类", key: "category", width: 24 }, { header: "标题", key: "title", width: 32 },
    { header: "设备", key: "device", width: 18 }, { header: "地点", key: "location", width: 18 },
    { header: "优先级", key: "priority", width: 10 }, { header: "状态", key: "status", width: 12 },
    { header: "运维人员", key: "assignee", width: 14 }, { header: "接单时间", key: "acceptedAt", width: 20 },
    { header: "完成时间", key: "completedAt", width: 20 }, { header: "响应分钟", key: "responseMinutes", width: 12 },
    { header: "解决分钟", key: "resolutionMinutes", width: 12 }, { header: "取消类型", key: "cancelType", width: 14 },
    { header: "取消原因", key: "cancelReason", width: 32 }, { header: "服务评分", key: "rating", width: 10 },
    { header: "故障原因", key: "cause", width: 30 }, { header: "解决方法", key: "resolution", width: 36 },
  ];
  for (const ticket of tickets) {
    const cancelLog = ticket.logs[0];
    sheet.addRow({
      ticketNo: ticket.ticketNo, createdAt: ticket.createdAt, creator: ticket.creator.name, department: ticket.department.name,
      category: ticket.category, title: ticket.title, device: ticket.device, location: ticket.location,
      priority: priorityLabels[ticket.priority] || ticket.priority, status: statusLabels[ticket.status] || ticket.status,
      assignee: ticket.assignedTo?.name || "", acceptedAt: ticket.acceptedAt || "", completedAt: ticket.completedAt || "",
      responseMinutes: ticket.acceptedAt ? Math.round((ticket.acceptedAt.getTime() - ticket.createdAt.getTime()) / 60000) : "",
      resolutionMinutes: ticket.completedAt ? Math.round((ticket.completedAt.getTime() - (ticket.startedAt || ticket.createdAt).getTime()) / 60000) : "",
      cancelType: ticket.status === "CANCELLED" ? (cancelLog?.action === "USER_WITHDRAW" ? "员工撤回" : "运维取消") : "",
      cancelReason: cancelLog?.note || "", rating: ticket.satisfactionRating || "", cause: ticket.cause || "", resolution: ticket.resolution || "",
    });
  }
  sheet.getRow(1).eachCell((cell) => { cell.font = { bold: true, color: { argb: "FFFFFFFF" } }; cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF17303B" } }; cell.alignment = { vertical: "middle" }; });
  sheet.getRow(1).height = 26;
  sheet.autoFilter = { from: "A1", to: "T1" };
  sheet.getColumn("createdAt").numFmt = "yyyy-mm-dd hh:mm";
  sheet.getColumn("acceptedAt").numFmt = "yyyy-mm-dd hh:mm";
  sheet.getColumn("completedAt").numFmt = "yyyy-mm-dd hh:mm";
  sheet.eachRow((row, rowNumber) => { if (rowNumber > 1) { row.alignment = { vertical: "top", wrapText: true }; if (rowNumber % 2 === 0) row.eachCell((cell) => { cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF7F9FA" } }; }); } });
  const buffer = await workbook.xlsx.writeBuffer();
  await writeAudit(user.id, "TICKETS_EXPORT", "Ticket", null, `范围：${from || "不限"} 至 ${to || "不限"}；共 ${tickets.length} 条`);
  return new Response(new Uint8Array(buffer), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="it-tickets-${new Date().toISOString().slice(0, 10)}.xlsx"`, "Cache-Control": "no-store" } });
}
