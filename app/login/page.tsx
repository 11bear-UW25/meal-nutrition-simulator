
"use client"

// Reactの機能を読み込む
// useState：入力値や画面の状態を管理する
// FormEvent：フォーム送信時のイベントの型
import { useState, SyntheticEvent } from "react"

// ログイン成功後に画面を移動するための機能
import { useRouter } from "next/navigation"

// 既存のSupabaseクライアントを使用する
import { supabase } from "@/lib/supabase"

// ログイン画面を表示するコンポーネント
export default function LoginPage() {
  // ページ移動に使用する
  const router = useRouter()

  // 入力されたメールアドレスとパスワードを管理する
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  // ログイン処理中かどうかを管理する
  const [isSubmitting, setIsSubmitting] = useState(false)

  // エラーメッセージを管理する
  const [message, setMessage] = useState("")

  // ログインボタンを押したときの処理
  async function handleSubmit(event:  SyntheticEvent<HTMLFormElement>) {
    // フォーム送信によるページの再読み込みを防ぐ
    event.preventDefault()

    // 二重送信を防ぐ
    if (isSubmitting) return

    // ログイン処理を開始する
    setIsSubmitting(true)
    setMessage("")

    try {
      // Supabase Authでメールアドレスとパスワードを確認する
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      })

      // 認証に失敗した場合はエラーとして処理する
      if (error) {
        throw error
      }

      // ログインに成功したらトップページへ移動する
      router.replace("/")

      // Next.jsに画面の情報を更新するよう依頼する
      router.refresh()
    } catch (error) {
      // ログインに失敗した場合は画面にメッセージを表示する
      console.error("ログインエラー:", error)

      setMessage(
        "ログインできませんでした。メールアドレスとパスワードを確認してください。"
      )

      // 再びログインできるようにする
      setIsSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f8f3] px-4 py-12">
      <div className="mx-auto w-full max-w-md rounded-xl border border-[#dfe9df] bg-white p-6 shadow-sm">

        {/* 画面のタイトル */}
        <h1 className="text-center text-2xl font-bold text-[#29352c]">
          ログイン
        </h1>

        {/* 入力の案内 */}
        <p className="mt-3 text-center text-sm text-[#6d7e70]">
          登録したメールアドレスとパスワードを入力してください。
        </p>

        {/* ログイン用フォーム */}
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">

          {/* メールアドレス入力欄 */}
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-semibold text-[#29352c]"
            >
              メールアドレス
            </label>

            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
              disabled={isSubmitting}
              className="mt-2 w-full rounded-lg border border-[#dfe9df] px-3 py-2"
            />
          </div>

          {/* パスワード入力欄 */}
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-semibold text-[#29352c]"
            >
              パスワード
            </label>

            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
              disabled={isSubmitting}
              className="mt-2 w-full rounded-lg border border-[#dfe9df] px-3 py-2"
            />
          </div>

          {/* ログインボタン */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-[#547d59] px-4 py-3 font-semibold text-white disabled:opacity-50"
          >
            {isSubmitting ? "ログイン中..." : "ログインする"}
          </button>

          {/* ログインに失敗した場合のメッセージ */}
          {message && (
            <p
              role="alert"
              className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
            >
              {message}
            </p>
          )}

        </form>
      </div>
    </main>
  )
}
