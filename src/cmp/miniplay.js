"use client"

import { useEffect, useRef, useState } from "react"

export function MiniPlay({children}) {

  const ref = useRef(null)

  const handleDown = e => {
    ref.current.isDrag = true
    ref.current.style.transition = "width 500ms, height 750ms" 
  }

  const handleMove = e => {
    if (!ref.current.isDrag) return
    ref.current.style.top = `${e.clientY}px`
    ref.current.style.left = `${e.clientX}px`
    ref.current.style.boxShadow = "0 15px 10px 0 #333"
    ref.current.style.transform = "translate(-50%,-50%)"
  }

  const handleUp = e => {
    ref.current.isDrag = false
    ref.current.style.transition = "width 500ms, height 750ms, top 750ms, left 750ms, boxShadow 750ms, transform 750ms"
    ref.current.style.top = `${e.clientY > innerHeight/2 ? "calc(100% - 20px)": "20px"}`
    ref.current.style.left = `${e.clientX > innerWidth/2 ? "calc(100% - 20px)": "20px"}`
    ref.current.style.boxShadow = "0 2px 2px 0 #333"
    ref.current.style.transform = `translate(${e.clientX > innerWidth/2 ? "-100%": "0%"},${e.clientY > innerHeight/2 ? "-100%": "0%"})`
  }

  useEffect(() => {
    if (!ref.current) return
    ref.current.style.transition = "width 500ms, height 750ms"
    ref.current.style.position = "absolute"
    ref.current.style.top = "20px"
    ref.current.style.left = "20px"
    ref.current.style.boxShadow = "0 2px 2px 0 #333"
  }, [])

  return (
    <div ref={ref} className="p-2 size-auto bg-gray-50 rounded-3xl flex flex-wrap justify-around overflow-visible" onPointerDown={handleDown} onPointerMove={handleMove} onPointerUp={handleUp}>
      {children}
    </div>
  )
}