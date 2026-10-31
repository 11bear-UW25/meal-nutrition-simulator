
import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'

// 新しく作成した認証メニューを読み込む
import AuthNavigation from '@/components/auth-navigation'

import './globals.css'

export const metadata: Metadata = {
  title: '自炊献立の栄養価シミュレーター',
  description: '献立を考えながら、食材の使用量と1日の栄養価をシミュレーションできます。',
  generator: 'v0.app',
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#f6f8f3',
  userScalable: true,
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body className="antialiased">

        {/* 全ページ共通の認証メニュー */}
        <AuthNavigation />

        {/* 各ページの内容 */}
        {children}

        {/* 本番環境の場合だけアクセス解析を有効にする */}
        {process.env.NODE_ENV === 'production' && <Analytics />}

      </body>
    </html>
  )
}
