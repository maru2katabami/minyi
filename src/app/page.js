import { PushNotif } from "@/cmp/notification"
import { InstallPrompt } from "@/cmp/install"

export default function Page() {
  return (
    <div className="min-h-screen bg-gray-300 flex items-center justify-center p-8">
      <div className="space-y-8 w-full max-w-lg">
        <PushNotif/>
        <InstallPrompt/>
      </div>
    </div>
  )
}
