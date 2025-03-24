"use client"

import { useEffect, useState } from "react"

function b64ToUint8(str) {
  const pad = "=".repeat((4 - (str.length % 4)) % 4)
  const b64 = (str + pad).replace(/-/g, "+").replace(/_/g, "/")
  const raw = window.atob(b64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

export function Notification() {
  const [isSpported, setIsSupported] = useState(false)
  const [subscription, setSubscription] = useState(null)

  useEffect(() => {
    if ("serviceWorker" in navigator && "PushManager" in window) {
      setIsSupported(true)
      initSW()
    }
  }, [])

  async function initSW() {
    const reg = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    })
    const sub = await reg.pushManager.getSubscription()
    setSubscription(sub)
  }

  async function subscribe() {
    const reg = await navigator.serviceWorker.ready
    const newSub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: b64ToUint8(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
    })
    setSubscription(newSub)
    const subJson = JSON.parse(JSON.stringify(newSub))
    await fetch("/api/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "subscribe", subscription: subJson }),
    })
  }

  async function unsubscribe() {
    await subscription?.unsubscribe()
    setSubscription(null)
    await fetch("/api/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "unsubscribe" }),
    })
  }

  async function sendTest() {
    if (!subscription) return
    const msg = prompt("通知テスト")
    const subJson = JSON.parse(JSON.stringify(subscription))
    await fetch("/api/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "sendNotification", subscription: subJson, message: msg }),
    })
  }

  if (!isSpported) return

  return (
    // 実装のonClickは sendTest❌ unsubscribe⭕️
    <div className="text-2xl" onClick={() => subscription ? sendTest(): subscribe()}>
      {subscription ? "🔔": "🔕"}
    </div> 
  )
}
