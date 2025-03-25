import { MiniPlay } from "@/cmp/miniplay"
import { Notification } from "@/cmp/notification"

export default function Page() {
  return (
    <main className="p-safe">
      <MiniPlay>
        <Notification/>
      </MiniPlay>
    </main>
  )
}
