import "./globals.css"

export const metadata = {
  title: "MINYI",
  description: "",
}

export default function RootLayout({children}) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=no"/>
        <meta name="apple-mobile-web-app-capable" content="yes"/>
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"/>
      </head>
      <body>
        {children}
      </body>
    </html>
  )
}
