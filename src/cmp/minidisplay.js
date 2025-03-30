"use client"

import { useEffect, useRef, useState } from "react"

export function MiniDisPlay({children}) {

  const ref = useRef(null)

  const [isOpen, setIsOpen] = useState(false)

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

  const handleUp = (e) => {
    ref.current.isDrag = false;
    ref.current.style.transition =
      "width 500ms, height 750ms, top 750ms, left 750ms, transform 750ms";
  
    // 現在のスタイル値を保持（条件に合致しなければ変更しない）
    let newTop = ref.current.style.top;
    let newLeft = ref.current.style.left;
    let translateX = "0%";
    let translateY = "0%";
  
    // 縦方向の条件: 上端20px以下、または下端20px以上（通常は innerHeight - 20px とするのが一般的）
    if (e.clientY <= 20) {
      newTop = "20px";
      translateY = "0%";
    } else if (e.clientY >= innerHeight - 20) {
      newTop = "calc(100% - 20px)";
      translateY = "-100%";
    }
  
    // 横方向の条件: 左端20px以下、または右端20px以上（通常は innerWidth - 20px とするのが一般的）
    if (e.clientX <= 20) {
      newLeft = "20px";
      translateX = "0%";
    } else if (e.clientX >= innerWidth - 20) {
      newLeft = "calc(100% - 20px)";
      translateX = "-100%";
    }
  
    // 条件に合致している場合のみスタイルを更新
    if (e.clientY <= 20 || e.clientY >= innerHeight - 20) {
      ref.current.style.top = newTop;
    }
    if (e.clientX <= 20 || e.clientX >= innerWidth - 20) {
      ref.current.style.left = newLeft;
    }
  
    // どちらかの条件に合致している場合、transform を更新
    if (
      e.clientY <= 20 ||
      e.clientY >= innerHeight - 20 ||
      e.clientX <= 20 ||
      e.clientX >= innerWidth - 20
    ) {
      ref.current.style.transform = `translate(${translateX}, ${translateY})`;
    }
  
    ref.current.style.boxShadow = "0 2px 2px 0 #333";
  };
  

  const handleClick = e => {
    setIsOpen(!isOpen)
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
      className="size-auto bg-white border border-dashed rounded-3xl flex flex-wrap justify-around overflow-visible"
      onPointerDown={handleDown}
      onPointerMove={handleMove}
      onPointerUp={handleUp}>
      {isOpen ?
      <>
        {children}
        <div
          className="absolute -top-2 -right-2 size-6 bg-[url(/close.png)] bg-no-repeat bg-center bg-[size:100%]"
          onClick={handleClick}/>
      </>:
      <div
        className="m-1 size-8 bg-[url(/minyi.png)] bg-no-repeat bg-center bg-[size:80%]"
        onClick={handleClick}/>
      }
    </div>
  )
}