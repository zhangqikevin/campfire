import { redirect } from "next/navigation";

export default function ChatIndex() {
  // Default persona is `main` on the gateway; multi-agent picker comes later.
  redirect("/workspace/chat/main");
}
