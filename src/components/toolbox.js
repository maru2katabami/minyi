"use client"

import { useRef, useState } from "react"

export const ToolBox = () => {

  const [isOpen, setIsOpen] = useState(false)

  const handleClick = (e) => {    
    setIsOpen(e.target.id === "close" ? false: true)
  }

  return (
    <div className={`absolute top-5 right-5 ${isOpen ? "size-80": "size-20"} rounded-xl shadow-xl duration-500`} onClick={handleClick}>
      <canvas className="size-full"/>
      <div className={`absolute top-2 right-2 size-10 rounded-3xl bg-black ${isOpen ? "block": "hidden"}`} id="close"/>
    </div>
  )
}