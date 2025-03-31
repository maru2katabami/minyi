import "./globals.css"
import { NextAuthProvider } from "@/cmp/providers"

export const metadata = {
  title: "MINYI",
  description: "",
}

export default function RootLayout({children}) {
  return (
    <html lang="en">
      <body>
        <NextAuthProvider>
          {children}
        </NextAuthProvider>
      </body>
    </html>
  )
}
