"use client"

export const Content = ({children}) => {
  return (
    <div className="absolute top-0 p-5 size-full grid-line flex flex-wrap justify-between">
      {children}
    </div>
  )
}