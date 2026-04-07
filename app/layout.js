export const metadata = { title: '訪問美容 シフト管理', description: 'シフト確認・変更通知システム' }

export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Hiragino Sans', sans-serif; background: #f5f5f3; color: #222; }
          input, select, button { font-family: inherit; }
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  )
}
