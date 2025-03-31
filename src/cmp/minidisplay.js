"use client"

import { useEffect, useRef, useState } from "react"
import { useSession, signIn, signOut } from "next-auth/react"

export function MiniDisPlay({ children }) {

  const ref = useRef(null)
  const [isOpen, setIsOpen] = useState(false)
  const { data } = useSession()

  const handleDown = e => {
    e.target.setPointerCapture(e.pointerId)
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
    // ポインターキャプチャをリリース
    e.target.releasePointerCapture(e.pointerId)
    const current = ref.current
    current.isDrag = false
    current.style.transition = "width 500ms, height 750ms, top 750ms, left 750ms, transform 750ms"    
    const rect = current.getBoundingClientRect()
    const { innerHeight, innerWidth } = window   
    const isOverlapping = rect.top < 20 || rect.bottom > innerHeight - 20 || rect.left < 20 || rect.right > innerWidth - 20

    if (rect.top < 20) {
      current.style.top = "20px"
    } else if (rect.bottom > innerHeight - 20) {
      current.style.top = "calc(100% - 20px)"
    }
    
    if (rect.left < 20) {
      current.style.left = "20px"
    } else if (rect.right > innerWidth - 20) {
      current.style.left = "calc(100% - 20px)"
    }
    
    if (isOverlapping) {
      current.style.transform = `translate(${e.clientX > innerWidth / 2 ? "-100%" : "0%"}, ${e.clientY > innerHeight / 2 ? "-100%" : "0%"})`;
    }
    
    current.style.boxShadow = "0 2px 2px 0 #333"
  }
  
  const handleClick = e => {
    data ? setIsOpen(!isOpen) : signIn()
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
    <div
      ref={ref}
      className="bg-white border border-dashed rounded-3xl flex flex-wrap justify-around overflow-visible"
      onPointerDown={handleDown}
      onPointerMove={handleMove}
      onPointerUp={handleUp}>
      {isOpen ?
      <>
      {children}
      <div
        className="m-2 p-1 w-20 h-8 bg-indigo-100 rounded-3xl text-sm font-bold text-indigo-400 flex justify-center items-center"
        onClick={signOut}>
        LOGOUT
      </div>
      <div
        className="absolute -top-2 -right-2 size-6 bg-[url(/close.png)] bg-no-repeat bg-center bg-[size:100%]"
        onClick={handleClick}/>
      </>:
      <div
        className="size-10 rounded-3xl"
        style={{ background: `url(${data ? data.user.image : "/minyi.png"}) no-repeat center center /80%`}}
        onClick={handleClick}/>
      }
    </div>
  )
}
