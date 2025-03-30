"use client"

import { useState } from "react"

export function Geolocation() {

  const [geolocation, setGeolocation] = useState(false)

  return (
    <div className="m-2 p-1 w-20 h-8 bg-indigo-100 rounded-3xl flex justify-between items-center">
      <div className="size-6 rounded-3xl bg-indigo-400 shadow-inner shadow-black flex justify-center items-center">
        📌
      </div>
      <div className="flex-1 text-center text-sm text-indigo-400 font-bold">
        {geolocation ? "ON": "OFF"}
      </div>
    </div>
  )
}