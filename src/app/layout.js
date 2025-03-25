import "./globals.css"

export const metadata = {
  title: "MINYI",
  description: "",
}

export default function RootLayout({children}) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  )
}
