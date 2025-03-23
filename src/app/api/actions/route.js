"use server"

import { NextResponse } from "next/server"
import webpush from "web-push"

webpush.setVapidDetails(
  "mailto:maru2katabami@gmail.com",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
)

export async function POST(request) {
  try {
    const { action, subscription, message } = await request.json()

    switch (action) {
      case "subscribe":
        return NextResponse.json({ success: true })
      case "unsubscribe":
        return NextResponse.json({ success: true })
      case "sendNotification":
        if (!subscription) return NextResponse.json({ success: false, error: "No subscription provided"})
        try {
          await webpush.sendNotification(
            subscription,
            JSON.stringify({
              title: "Test Notification",
              body: message,
              icon: "/minyi.png",
            })
          )
          return NextResponse.json({ success: true })
        } catch (error) {
          return NextResponse.json({ success: false, error: "Failed to send notification" })
        }
      default:
        return NextResponse.json({ success: false, error: "Invalid action" })
    }
  } catch (error) {
    return NextResponse.json({ success: false, error: "Server error" })
  }
}
