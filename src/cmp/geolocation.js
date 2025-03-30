"use client"

import { useState, useRef, useEffect } from "react"

export function Geolocation() {
  const [geolocation, setGeolocation] = useState(false)
  const watchIdRef = useRef(null)

  const subscribe = () => {
    if ("geolocation" in navigator) {
      const id = navigator.geolocation.watchPosition(
        (position) => {
          console.log("位置情報取得:", position.coords.latitude, position.coords.longitude)
        },
        (error) => {
          console.error("位置情報取得エラー:", error)
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      )
      watchIdRef.current = id
      setGeolocation(true)
    } else {
      console.error("Geolocationはこのブラウザではサポートされていません")
    }
  }

  const unsubscribe = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    setGeolocation(false)
  }

  useEffect(() => {
    if ("permissions" in navigator) {
      navigator.permissions.query({name: "geolocation"})
        .then((permissionStatus) => {
          permissionStatus.state === "granted" ? subscribe(): setGeolocation(false)
        })
    }
  }, [])

  return (
    <div className="m-2 p-1 w-20 h-8 bg-indigo-100 rounded-3xl flex justify-between items-center">
      <div className={`size-6 rounded-3xl bg-indigo-400 ${geolocation ? "shadow-inner" : "shadow"} shadow-black flex justify-center items-center`} onClick={geolocation ? unsubscribe : subscribe}>
        📌
      </div>
      <div className="flex-1 text-center text-sm text-indigo-400 font-bold">
        {geolocation ? "ON" : "OFF"}
      </div>
    </div>
  )
}
