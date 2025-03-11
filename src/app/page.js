import { Cursor } from "@/components/cursor"

export default function Page() {
  return (
    <main>
      <Cursor/>
      <div className="absolute top-1/2 left-1/2 -translate-1/2 size-80 rounded-3xl shadow-xl bg-white/80">

      </div>
    </main>
  )
}