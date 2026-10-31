
"use client"

// Reactの機能を読み込む
// useEffect：画面表示時に認証状態を確認
// useState：認証状態や処理中の状態を管理
import { useEffect, useState } from "react"

// Next.jsの画面遷移用リンク
import Link from "next/link"

// 既存のSupabaseクライアントと匿名認証処理を使用
import { supabase, ensureSupabaseSession } from "@/lib/supabase"

// 認証状態を表す型
// checking：確認中
// guest：未ログイン、または匿名ユーザー
// member：メールアドレスでログインしたユーザー
type AuthStatus = "checking" | "guest" | "member"

// 認証操作用のナビゲーション
export default function AuthNavigation() {
  // 現在の認証状態
  const [authStatus, setAuthStatus] =
    useState<AuthStatus>("checking")

  // ログアウト処理中かどうか
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  // エラーメッセージ
  const [errorMessage, setErrorMessage] = useState("")

  // 画面を表示したときに認証状態を確認
  useEffect(() => {
    // コンポーネントが有効かを管理
    let active = true

    // Supabaseの認証状態が変わったときに実行
    const { data: authListener } =
      supabase.auth.onAuthStateChange((_event, session) => {
        if (!active) return

        // メール認証ユーザーかどうかを判定
        // is_anonymous が true の場合は匿名ユーザー
        if (session && session.user.is_anonymous !== true) {
          setAuthStatus("member")
        } else {
          setAuthStatus("guest")
        }
      })

    // 現在保存されているセッションを確認
    async function checkAuth() {
      const { data, error } = await supabase.auth.getSession()

      if (!active) return

      if (error) {
        setErrorMessage("認証状態を確認できませんでした。")
        setAuthStatus("guest")
        return
      }

      if (data.session && data.session.user.is_anonymous !== true) {
        setAuthStatus("member")
      } else {
        setAuthStatus("guest")
      }
    }

    void checkAuth()

    // 画面から離れたときに監視を解除
    return () => {
      active = false
      authListener.subscription.unsubscribe()
    }
  }, [])

  // ログアウトボタンを押したときの処理
  async function handleLogout() {
    // ログアウト処理の二重実行を防ぐ
    if (isLoggingOut) return

    setIsLoggingOut(true)
    setErrorMessage("")

    try {
      // Supabaseからログアウト
      const { error } = await supabase.auth.signOut()

      if (error) {
        throw error
      }
    } catch (error) {
      console.error("ログアウトエラー:", error)
      setErrorMessage("ログアウトできませんでした。再度お試しください。")
      setIsLoggingOut(false)
      return
    }

    try {
      // ログアウト後もアプリを使えるよう匿名認証を開始
      await ensureSupabaseSession()
    } catch (error) {
      // 匿名認証が失敗した場合も、ログアウト済みの状態は維持
      console.error("匿名認証の再開に失敗しました:", error)
    }

    // トップページを再読み込み
    // 以前のユーザーの献立が画面に残らないように
    window.location.replace("/")
  }

  return (
    // アプリ共通の認証メニュー
    <nav
      aria-label="アカウント操作"
      className="border-b border-[#dfe9df] bg-white px-4 py-3"
    >
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-end gap-2">

        {/* 認証状態を確認している間 */}
        {authStatus === "checking" && (
          <span className="text-sm text-[#6d7e70]">
            認証状態を確認中...
          </span>
        )}

        {/* 匿名ユーザーの場合 */}
        {authStatus === "guest" && (
          <>
            <Link
              href="/login"
              className="rounded-lg border border-[#547d59] px-4 py-2 text-sm font-semibold text-[#547d59]"
            >
              ログイン
            </Link>

            <Link
              href="/signup"
              className="rounded-lg bg-[#547d59] px-4 py-2 text-sm font-semibold text-white"
            >
              新規登録
            </Link>
          </>
        )}

        {/* メール認証ユーザーの場合 */}
        {authStatus === "member" && (
          <>
            <span className="text-sm text-[#547d59]">
              ログイン中
            </span>

            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="rounded-lg border border-[#547d59] px-4 py-2 text-sm font-semibold text-[#547d59] disabled:opacity-50"
            >
              {isLoggingOut ? "ログアウト中..." : "ログアウト"}
            </button>
          </>
        )}
      </div>

      {/* 認証処理でエラーが起きた場合 */}
      {errorMessage && (
        <p
          role="alert"
          className="mt-2 text-center text-sm text-red-700"
        >
          {errorMessage}
        </p>
      )}
    </nav>
  )
}
