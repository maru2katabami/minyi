"use client"

import { useEffect, useState } from "react"

export const Content = () => {

  const [space, setSpace] = useState(0)

  useEffect(() => {
    setSpace(Math.min(window.innerWidth % 369, 30))
  }, [])

  return (
    <div
      className="absolute top-0 p-5 size-full grid-line flex flex-wrap justify-between overflow-hidden">
      <div
        className="absolute top-0 left-0 w-full h-56 flex items-center overflow-x-scroll"
        style={{paddingLeft: `${space/2}px`, paddingRight: `${space/2}px`, gap: `${space}px`}}>
        <div className="w-[369px] h-52 rounded-2xl bg-black shrink-0">

        </div>
        <div className="w-[369px] h-52 rounded-2xl bg-black shrink-0">

        </div>
        <iframe
          className="w-[369px] h-52 rounded-2xl shrink-0"
          src="https://www.youtube.com/embed/G-_w5PDL9yw"
          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen/>
        <div className="w-[369px] h-52 rounded-2xl bg-black shrink-0">

        </div>
      </div>
      <div></div>
    </div>
  )
}