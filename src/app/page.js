import { MiniDisPlay } from "@/cmp/minidisplay"
import { Notification } from "@/cmp/notification"
import { Geolocation } from "@/cmp/geolocation"

export default function Page() {
  return (
    <main>
      <MiniDisPlay>
        <Notification/>
        <Geolocation/>
      </MiniDisPlay>
    </main>
  )
}
