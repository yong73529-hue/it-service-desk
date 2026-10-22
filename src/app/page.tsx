import { redirect } from "next/navigation";
import { getCurrentUser, homeForUser } from "@/lib/auth";
export default async function Home() { const user = await getCurrentUser(); redirect(user ? homeForUser(user) : "/login"); }
