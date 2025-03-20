"use client"

import { useEffect, useState } from "react"

export const InstallPrompt = () => {
  const [isIOS, setIsIOS] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)

  useEffect(() => {
    setIsIOS(/iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream)
    setIsStandalone(window.matchMedia('(display-mode: standalone)').matches)
  }, [])

  if (isStandalone) return null

  return (
    <div className="p-8 bg-white/30 backdrop-blur-lg rounded-2xl shadow-2xl transition-transform transform hover:scale-105">
      <h3 className="text-3xl font-bold mb-6 text-white drop-shadow-lg">アプリをインストール</h3>
      <button className="w-full mb-4 py-3 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold hover:from-purple-600 hover:to-pink-600 transition duration-200">
        ホーム画面に追加
      </button>
      {isIOS && (
        <p className="text-white text-sm">
          iOSデバイスの場合は、共有ボタン
          <span role="img" aria-label="share icon">  </span>
          をタップし、「ホーム画面に追加」
          <span role="img" aria-label="plus icon"> ➕ </span>
          を選択してください。
        </p>
      )}
    </div>
  )
}
