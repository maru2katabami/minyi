"use client"

import { useRef } from "react"

export const ToolBox = () => {

  const toolBoxRef = useRef(null)

  return (
    <div ref={toolBoxRef} className="absolute top-5 right-5 size-20 rounded-3xl bg-white">
      <canvas/>
    </div>
  )
}