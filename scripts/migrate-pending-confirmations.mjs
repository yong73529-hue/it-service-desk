import { PrismaClient } from "@prisma/client";
const prisma=new PrismaClient();
try{const candidates=await prisma.ticket.findMany({where:{status:"COMPLETED",userConfirmedAt:null},select:{id:true,completedAt:true}});for(const ticket of candidates){await prisma.ticket.update({where:{id:ticket.id},data:{status:"PENDING_CONFIRMATION",resolvedAt:ticket.completedAt||new Date(),completedAt:null}});}console.log(JSON.stringify({migrated:candidates.length}));}finally{await prisma.$disconnect();}
