"use client"

import { useEffect, useRef, useState } from "react"

export function MiniPlay({children}) {

  const ref = useRef(null)
  const [isOpen, setIsOpen] = useState(false)

  const handleClick = e => {
    setIsOpen( e.target.id === "open" ? true: false)
    ref.current.style.width = isOpen ? "40px": `${Math.min(innerWidth-40,400)}px`
    ref.current.style.height = isOpen ? "40px": "200px"
    ref.current.style.border = isOpen ? "dashed 1px #33333333": "solid 1px #33333333"
  }

  const handleDown = e => {
    ref.current.isDrag = true
    ref.current.style.transition = "width 500ms, height 750ms" 
  }

  const handleMove = e => {
    if (!ref.current.isDrag) return
    ref.current.style.top = `${e.clientY}px`
    ref.current.style.left = `${e.clientX}px`
    ref.current.style.boxShadow = "0 10px 10px 0 #333"
    ref.current.style.transform = "translate(-50%,-50%)"
  }

  const handleUp = e => {
    ref.current.isDrag = false
    ref.current.style.transition = "width 500ms, height 750ms, top 750ms, left 750ms"
    ref.current.style.top = `${e.clientY > innerHeight/2 ? "calc(100% - 20px)": "20px"}`
    ref.current.style.left = `${e.clientX > innerWidth/2 ? "calc(100% - 20px)": "20px"}`
    ref.current.style.boxShadow = "0 1px 2px #333"
    ref.current.style.transform = `translate(${e.clientX > innerWidth/2 ? "-100%": "0%"},${e.clientY > innerHeight/2 ? "-100%": "0%"})`
  }

  useEffect(() => {
    if (!ref.current) return
    ref.current.style.transition = "width 500ms, height 750ms"
    ref.current.style.position = "absolute"
    ref.current.style.top = "20px"
    ref.current.style.left = "20px"
    ref.current.style.width = "40px"
    ref.current.style.height = "40px"
    ref.current.style.border = "dashed 1px #33333333"
    ref.current.style.borderRadius = "10px"
  }, [])

  return (
    <div ref={ref} className="overflow-hidden" onPointerDown={handleDown} onPointerMove={handleMove} onPointerUp={handleUp}>
      {isOpen ?
      <div className="absolute px-4 top-0 w-full h-10 flex justify-between items-center">
        <div className="space-x-2 flex items-center">
          <div id="close" onClick={handleClick} className="size-3 border border-red-500 bg-red-400 rounded-xl"/>
          <div className="size-3 border border-yellow-500 bg-yellow-400 rounded-xl"/>
          <div className="size-3 border border-green-500 bg-green-400 rounded-xl"/>
        </div>
        {children}
        <iframe className="w-full h-fit" src="https://www.youtube.com/embed/hTQw6RcHvGs?si=1wI5qR7DpdBLLJNM"/>
      </div>:
      <div id="open" className="size-full bg-[url(/minyi.png)] bg-no-repeat bg-center bg-[size:40px]" onClick={handleClick}/>
      }
    </div>
  )
}