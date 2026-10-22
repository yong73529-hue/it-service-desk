export const ROLES = { EMPLOYEE: "EMPLOYEE", OPS: "OPS", ADMIN: "ADMIN" } as const;
export type RoleCode = (typeof ROLES)[keyof typeof ROLES];
export const STATUS = { PENDING: "PENDING", ACCEPTED: "ACCEPTED", PROCESSING: "PROCESSING", WAITING_USER: "WAITING_USER", WAITING_PARTS: "WAITING_PARTS", PENDING_CONFIRMATION: "PENDING_CONFIRMATION", COMPLETED: "COMPLETED", CANCELLED: "CANCELLED" } as const;
export const statusLabels: Record<string, string> = { PENDING: "待接单", ACCEPTED: "已接单", PROCESSING: "处理中", WAITING_USER: "等待用户", WAITING_PARTS: "等待配件", PENDING_CONFIRMATION: "待员工确认", COMPLETED: "已完成", CANCELLED: "已取消" };
export const categories = ["电脑故障", "网络故障", "Adobe / PR / AE / PS", "软件安装", "投屏 / 教室设备", "服务器 / NAS / 文件共享", "账号 / 权限", "打印机 / 外设", "直播相关", "其他"];
export const activeStatuses = ["PENDING", "ACCEPTED", "PROCESSING", "WAITING_USER", "WAITING_PARTS", "PENDING_CONFIRMATION"];
export const priorityLabels: Record<string, string> = { NORMAL: "普通", URGENT: "紧急" };
