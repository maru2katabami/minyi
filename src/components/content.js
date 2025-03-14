"use client";

import { useLayoutEffect, useEffect, useRef, useState, useCallback } from "react";

const ITEM_WIDTH = 369;
const MAX_SPACE = 30;

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
);

export const Content = () => {
  const headerRef = useRef(null);
  const scrollTimeout = useRef(null);
  const [space, setSpace] = useState(0);

  // リサイズ時に余白(space)を更新（debounce 化）
  useEffect(() => {
    const calcSpace = () => {
      setSpace(Math.min(window.innerWidth % ITEM_WIDTH, MAX_SPACE));
    };
    calcSpace();
    let resizeTimer;
    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(calcSpace, 100);
    };
    window.addEventListener("resize", handleResize);
    return () => {
      clearTimeout(resizeTimer);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // 初期スクロール位置の設定（useLayoutEffect でちらつきを防止）
  useLayoutEffect(() => {
    const container = headerRef.current;
    if (container) {
      container.scrollLeft = container.scrollWidth / 2;
    }
  }, [space]);

  // 一セット分の幅を取得
  const getOneSetWidth = useCallback(() => {
    const container = headerRef.current;
    return container ? container.scrollWidth / 2 : 0;
  }, []);

  // 中央に最も近いアイテムへスナップする関数
  const snapToCenter = useCallback(() => {
    const container = headerRef.current;
    if (!container) return;
    const containerCenter = container.scrollLeft + container.clientWidth / 2;
    let closestScroll = null;
    let minDistance = Infinity;

    Array.from(container.children).forEach(child => {
      const childCenter = child.offsetLeft + child.offsetWidth / 2;
      const distance = Math.abs(containerCenter - childCenter);
      if (distance < minDistance) {
        minDistance = distance;
        closestScroll = childCenter - container.clientWidth / 2;
      }
    });

    if (closestScroll !== null) {
      container.scrollTo({ left: closestScroll, behavior: "smooth" });
    }
  }, []);

  // スクロールイベント処理（無限スクロール＋スナップ機能）
  const handleScroll = useCallback(() => {
    const container = headerRef.current;
    if (!container) return;
    const oneSetWidth = getOneSetWidth();
    if (container.scrollLeft <= 0) {
      container.scrollLeft += oneSetWidth;
    } else if (container.scrollLeft >= container.scrollWidth - container.clientWidth) {
      container.scrollLeft -= oneSetWidth;
    }
    if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
    scrollTimeout.current = setTimeout(snapToCenter, 150);
  }, [getOneSetWidth, snapToCenter]);

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
    };
  }, []);

  // クリック時に最も近い iframe へスムーズスクロール
  const handleYoutubeScroll = useCallback(() => {
    const container = headerRef.current;
    if (!container) return;
    const iframes = container.querySelectorAll("iframe");
    if (!iframes.length) return;

    let closestTarget = null;
    let minDistance = Infinity;
    const currentScroll = container.scrollLeft;

    iframes.forEach(iframe => {
      const targetScroll = iframe.offsetLeft - (container.clientWidth - iframe.clientWidth) / 2;
      const distance = Math.abs(currentScroll - targetScroll);
      if (distance < minDistance) {
        minDistance = distance;
        closestTarget = targetScroll;
      }
    });

    if (closestTarget !== null) {
      container.scrollTo({ left: closestTarget, behavior: "smooth" });
    }
  }, []);

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
        {/* コンテンツを複製して無限スクロールを実現 */}
        <Items />
        <Items />
      </div>
      <div className="relative w-full h-[calc(100%-224px)]" onClick={handleYoutubeScroll}>
        {/* 他のコンテンツ */}
      </div>
    </div>
  );
};
