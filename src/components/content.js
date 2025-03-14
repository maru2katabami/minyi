"use client"

import { useEffect, useRef, useState, useCallback } from "react"

const ITEM_WIDTH = 369
const MAX_SPACE = 30

// 複製する項目群を独立したコンポーネントに
const Items = () => (
  <>
    <div className="w-[369px] h-52 rounded-2xl bg-black shrink-0" />
    <div className="w-[369px] h-52 rounded-2xl bg-black shrink-0" />
    <iframe
      className="w-[369px] h-52 rounded-2xl shrink-0"
      src="https://www.youtube-nocookie.com/embed/G-_w5PDL9yw"
      allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
    />
    <div className="w-[369px] h-52 rounded-2xl bg-black shrink-0" />
  </>
)

export const Content = () => {
  const headerRef = useRef(null)
  const scrollTimeout = useRef(null)
  const [space, setSpace] = useState(0)

  // space の計算とウィンドウリサイズ時の更新
  useEffect(() => {
    const calcSpace = () => {
      setSpace(Math.min(window.innerWidth % ITEM_WIDTH, MAX_SPACE))
    }
    calcSpace()
    window.addEventListener("resize", calcSpace)
    return () => window.removeEventListener("resize", calcSpace)
  }, [])

  // 初期スクロール位置の設定
  useEffect(() => {
    const container = headerRef.current
    if (container) {
      const oneSetWidth = container.scrollWidth / 2
      container.scrollLeft = oneSetWidth
    }
  }, [space])

  // 一セット分の幅を取得するヘルパー関数
  const getOneSetWidth = () => {
    const container = headerRef.current
    return container ? container.scrollWidth / 2 : 0
  }

  // スクロール終了後に中央に最も近いアイテムへスナップする関数
  const handleSnapToCenter = useCallback(() => {
    const container = headerRef.current
    if (!container) return

    const center = container.scrollLeft + container.clientWidth / 2
    let closestTarget = null
    let minDistance = Infinity

    // container.children には複製されたアイテム群が含まれる
    Array.from(container.children).forEach((child) => {
      const childCenter = child.offsetLeft + child.offsetWidth / 2
      const distance = Math.abs(center - childCenter)
      if (distance < minDistance) {
        minDistance = distance
        // 子要素の中央をコンテナ中央に合わせるためのスクロール位置
        closestTarget = childCenter - container.clientWidth / 2
      }
    })

    if (closestTarget !== null) {
      container.scrollTo({
        left: closestTarget,
        behavior: "smooth",
      })
    }
  }, [])

  // 無限スクロール用ハンドラにスナップ機能を追加
  const handleScroll = useCallback(() => {
    const container = headerRef.current
    if (!container) return

    const oneSetWidth = getOneSetWidth()
    if (container.scrollLeft <= 0) {
      container.scrollLeft += oneSetWidth
    } else if (container.scrollLeft >= container.scrollWidth - container.clientWidth) {
      container.scrollLeft -= oneSetWidth
    }

    // スクロール中はタイマーをクリアし、スクロール終了後にhandleSnapToCenterを実行
    if (scrollTimeout.current) {
      clearTimeout(scrollTimeout.current)
    }
    scrollTimeout.current = setTimeout(() => {
      handleSnapToCenter()
    }, 150)
  }, [handleSnapToCenter])

  // クリーンアップ用のエフェクト
  useEffect(() => {
    return () => {
      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current)
      }
    }
  }, [])

  // クリック時に、現在のスクロール位置に最も近いiframeへスムーズスクロール
  const handleYoutubeScroll = useCallback(() => {
    const container = headerRef.current
    if (!container) return

    const iframes = container.querySelectorAll("iframe")
    if (iframes.length === 0) return

    let closestTarget = null
    let minDistance = Infinity
    const currentScroll = container.scrollLeft

    iframes.forEach((iframe) => {
      const targetScroll =
        iframe.offsetLeft - (container.clientWidth - iframe.clientWidth) / 2
      const distance = Math.abs(currentScroll - targetScroll)
      if (distance < minDistance) {
        minDistance = distance
        closestTarget = targetScroll
      }
    })

    if (closestTarget !== null) {
      container.scrollTo({
        left: closestTarget,
        behavior: "smooth",
      })
    }
  }, [])

  return (
    <div className="absolute top-0 size-full grid-line flex flex-wrap justify-between overflow-hidden">
      <div
        ref={headerRef}
        onScroll={handleScroll}
        className="relative w-full h-56 flex items-center overflow-x-scroll scroll-none"
        style={{
          paddingLeft: `${space / 2}px`,
          paddingRight: `${space / 2}px`,
          gap: `${space}px`,
        }}
      >
        {/* 内容を複製して無限スクロールを実現 */}
        <Items />
        <Items />
      </div>
      <div
        className="relative w-full h-[calc(100%-224px)]"
        onClick={handleYoutubeScroll}
      >
        {/* 他のコンテンツ */}
      </div>
    </div>
  )
}
