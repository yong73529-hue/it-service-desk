import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const sourceName = "技术常见问题解决手册.docx";
const articles = [
  {
    title: "Mac 电脑清理 Premiere Pro 媒体缓存",
    category: "Adobe / PR / AE / PS",
    symptoms: "Premiere Pro 占用空间持续增加、磁盘空间不足，或剪辑时缓存异常。",
    cause: "Premiere Pro 的媒体缓存文件和音频峰值文件长期累积。",
    resolution: "1. 关闭 Premiere Pro。\n2. 在访达中按住 Option（Alt），点击菜单栏“前往”，选择“资源库”。\n3. 进入 Application Support/Adobe/Common。\n4. 删除 Media Cache Files 和 Peak Files 文件夹中的缓存内容。\n5. 清倒废纸篓后重新打开 Premiere Pro。\n注意：不要删除同目录下不确定用途的其他文件。",
    keywords: "Mac,PR,Premiere,缓存,媒体缓存,Media Cache Files,Peak Files,磁盘空间",
  },
  {
    title: "Mac 无法挂载 EMC 或 Clip2 服务器盘",
    category: "服务器 / NAS / 文件共享",
    symptoms: "访达左侧没有出现 EMC 或 Clip2，无法访问服务器素材。",
    cause: "服务器盘尚未加载，或挂盘指令没有执行。",
    resolution: "1. 打开“磁盘工具”，检查外置服务器盘是否已经加载。\n2. 如果磁盘工具中没有出现对应服务器盘，请联系技术管理中心 DIT。\n3. 如果服务器盘已经出现，在 EMC、Clip2 或智造工程盘中找到对应的挂盘指令并运行。\n4. 常用挂盘指令可以复制到桌面备用。",
    keywords: "EMC,Clip2,挂盘,服务器盘,磁盘工具,Mac,NAS",
  },
  {
    title: "Mac 挂载天合智造工程盘",
    category: "服务器 / NAS / 文件共享",
    symptoms: "智造电脑无法看到天合智造或天合智造工程盘。",
    cause: "工程盘没有挂载，或尚未选择需要挂载的盘符。",
    resolution: "1. 在桌面或智造工程盘目录中找到工程盘挂盘指令。\n2. 双击运行挂盘指令。\n3. 在弹出的宗卷列表中选中“天合智造”或“天合智造工程盘”。\n4. 点击“好”，等待访达左侧出现对应盘符。\n5. 如果列表中没有目标盘符或执行失败，请联系技术管理中心 DIT。",
    keywords: "天合智造,工程盘,挂盘,盘符,宗卷,Mac",
  },
  {
    title: "公司版权音乐库使用规则",
    category: "其他",
    symptoms: "需要查找公司已购买版权的配乐，或不确定音乐文件能否修改。",
    cause: "公司版权音乐分布在不同曲库，每个文件通过原始编号识别授权信息。",
    resolution: "公司版权音乐包括火花音悦和 VFine 曲库。请在服务器素材盘的版权音乐目录中按分类查找。每首音乐文件都有对应编号，编号用于识别授权信息。不得修改音乐文件名、编号或其他文件信息。找不到所需音乐时请联系技术管理中心确认。",
    keywords: "版权音乐,火花音悦,VFine,音乐编号,素材盘,配乐",
  },
  {
    title: "Premiere Pro 剪辑工程卡顿排查",
    category: "Adobe / PR / AE / PS",
    symptoms: "PR 工程打开缓慢、移动或切割素材后立即卡顿转圈，或者媒体长时间没有链接完成。",
    cause: "工程和暂存盘位于服务器、媒体缓存设置不合理、序列设置不匹配，或 PR 用户配置异常。",
    resolution: "先执行基础排查：\n1. 先打开 PR 软件，再打开工程。\n2. 新建测试工程和序列并保存在电脑本地。\n3. 在“文件 > 项目管理 > 暂存盘”中，将保存路径改为本地文稿或桌面。\n4. 在“首选项 > 媒体缓存”中确认缓存保存在本地，并设置自动删除较早的缓存文件。\n5. 检查序列设置是否与素材一致。\n6. 等待右上角媒体链接完成后再操作。\n如果移动或切割素材仍立即卡顿，可重置 PR：关闭 PR，先备份个人快捷键；进入对应 PR 版本目录，删除 Profile-edit 文件夹；恢复快捷键后重新打开 PR。重置会清除个人界面布局，请谨慎操作。",
    keywords: "PR,Premiere,工程卡顿,操作卡顿,转圈,媒体缓存,暂存盘,Profile-edit,重置PR",
  },
  {
    title: "动画电脑无法挂载服务器盘时的网络设置",
    category: "网络故障",
    symptoms: "动画电脑无法连接服务器盘，需要临时切换到服务器网段进行挂载。",
    cause: "电脑当前 IP 不在服务器使用的 100.31.1.x 网段。",
    resolution: "操作前先联系技术管理中心确认可用 IP，避免地址冲突。\nWindows：打开控制面板，切换为小图标，进入“网络和共享中心 > 更改适配器设置”，右键以太网选择属性，打开 Internet 协议版本 4（TCP/IPv4），临时设置为 100.31.1.x（原手册范围为 120-200）。连接服务器成功后改回自动获取。\nmacOS：打开系统设置中的网络，进入当前网卡的详细信息，手动设置为经确认的 100.31.1.x 地址；原手册指定 DNS 为 8.8.8.8。完成服务器连接后按公司网络要求恢复原设置。\n不清楚子网掩码、路由器或可用地址时不要自行尝试，直接联系 DIT。",
    keywords: "动画电脑,挂盘,服务器,IP,100.31.1,Windows,macOS,IPv4,网络设置",
  },
  {
    title: "使用 DiskGenius 检查硬盘 SMART 状态",
    category: "电脑故障",
    symptoms: "怀疑硬盘存在健康问题，需要查看硬盘自检和潜在故障信息。",
    cause: "硬盘可能出现坏道、读写异常或 SMART 健康指标告警。",
    resolution: "1. 从 DiskGenius 官方网站下载安装软件：https://www.diskgenius.cn/download.php\n2. 打开 DiskGenius，在左侧选择需要检查的物理硬盘。\n3. 点击“磁盘”菜单，选择“查看 S.M.A.R.T. 信息”。\n4. 查看弹出窗口中的健康状态和异常指标。\n5. 如果出现警告、错误或重要数据盘异常，请停止高强度读写并联系技术管理中心处理，不要自行执行修复或格式化。",
    keywords: "DiskGenius,SMART,硬盘检测,硬盘健康,坏道,磁盘",
  },
];

try {
  const configured = (process.env.WECOM_ADMIN_USER_IDS || "").split(",").map((item) => item.trim()).filter(Boolean);
  const publisher = await prisma.user.findFirst({ where: { active: true, ...(configured.length ? { wecomUserId: { in: configured } } : {}) }, orderBy: { createdAt: "asc" } });
  if (!publisher) throw new Error("No active publisher account found");
  for (const article of articles) {
    const existing = await prisma.knowledgeArticle.findFirst({ where: { title: article.title, sourceName } });
    if (existing) await prisma.knowledgeArticle.update({ where: { id: existing.id }, data: { ...article, publishedById: publisher.id } });
    else await prisma.knowledgeArticle.create({ data: { ...article, sourceName, publishedById: publisher.id } });
  }
  console.log(`Imported ${articles.length} knowledge articles from ${sourceName}`);
} finally {
  await prisma.$disconnect();
}
