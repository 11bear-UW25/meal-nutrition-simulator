
"use client"

// Reactの機能を読み込む
// useState：画面内で変化するデータを管理する
// FormEvent：フォーム送信時のイベントの型
import { useState, SyntheticEvent } from "react"

// 既存のSupabaseクライアントを読み込む
// 新しい接続を作らず、アプリと同じ接続設定を使用する
import { supabase } from "@/lib/supabase"

// 新規登録画面を表示するコンポーネント
export default function SignupPage() {
  // メールアドレスとパスワードの入力値を管理
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  // 登録処理中かどうかを管理
  const [isSubmitting, setIsSubmitting] = useState(false)

  // 登録結果を利用者に知らせるためのメッセージ
  const [message, setMessage] = useState("")
  const [isError, setIsError] = useState(false)

  // 登録ボタンが押されたときに実行する関数
  async function handleSubmit(
    event: SyntheticEvent<HTMLFormElement>
  ) {
    // フォーム送信によるページの再読み込みを防ぐ
    event.preventDefault()

    // 処理中の二重送信を防ぐ
    if (isSubmitting) return

    // 新しい処理を始める前に表示を初期化する
    setIsSubmitting(true)
    setMessage("")
    setIsError(false)

    try {
      // Supabase Authに新規ユーザー登録を依頼する
      // trim()：メールアドレスの前後の空白を除く
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: password,
        options: {
          // メール認証後に戻るURLを指定する
          // Supabase側の許可済みURLにも登録が必要
          emailRedirectTo: window.location.origin,
        },
      })

      // Supabaseからエラーが返されたらcatchへ進む
      if (error) {
        throw error
      }

      // メール確認が不要な設定では、
      // 登録直後にログイン状態になる場合がある
      if (data.session) {
        setMessage("新規登録が完了しました。")
      } else {
        // メール確認が必要な場合など
        setMessage(
          "登録リクエストを受け付けました。確認メールが届いているかご確認ください。"
        )
      }
    } catch (error) {
      // エラー発生時には画面に内容を表示する
      setIsError(true)
      setMessage(
        error instanceof Error
          ? error.message
          : "新規登録に失敗しました。"
      )
    } finally {
      // 成功・失敗にかかわらず処理中の状態を解除
      setIsSubmitting(false)
    }
  }

  // 画面に表示する内容
  return (
    <main className="min-h-screen bg-[#f6f8f3] px-4 py-12">

      {/* 新規登録画面の白いカード */}
      <div className="mx-auto w-full max-w-md rounded-xl border border-[#dfe9df] bg-white p-6 shadow-sm">

        {/* 画面のタイトル */}
        <h1 className="text-center text-2xl font-bold text-[#29352c]">
          新規登録
        </h1>

        {/* 入力案内 */}
        <p className="mt-3 text-center text-sm text-[#6d7e70]">
          メールアドレスとパスワードを入力してください。
        </p>

        {/*
          form：入力内容をまとめて送信する
          onSubmit：送信時にhandleSubmitを実行する
        */}
        <form
          onSubmit={handleSubmit}
          className="mt-6 space-y-4"
        >

          {/* メールアドレス入力欄 */}
          <div>
            {/*
              htmlForとid：ラベルと入力欄を関連付ける
            */}
            <label
              htmlFor="email"
              className="block text-sm font-semibold text-[#29352c]"
            >
              メールアドレス
            </label>

            {/*
              type="email"：メールアドレス形式の入力欄
              value：useStateのemailを表示する
              onChange：変更時にsetEmailで値を更新する
              required：未入力のまま送信することを防ぐ
            */}
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

            {/*
              type="password"：入力文字を伏せて表示する
              value：useStateのpasswordを使用する
              onChange：変更時にsetPasswordで値を更新する
              autoComplete="new-password"：新規登録用と伝える
            */}
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              required
              disabled={isSubmitting}
              className="mt-2 w-full rounded-lg border border-[#dfe9df] px-3 py-2"
            />
          </div>

          {/* 新規登録の送信ボタン */}
          {/* 処理中はボタンを無効にして二重送信を防ぐ */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-[#547d59] px-4 py-3 font-semibold text-white disabled:opacity-50"
          >
            {isSubmitting ? "登録中..." : "新規登録する"}
          </button>

          {/* 登録結果やエラーを画面に表示する */}
          {message && (
            <p
              role={isError ? "alert" : "status"}
              className={`rounded-lg p-3 text-sm ${
                isError
                  ? "bg-red-50 text-red-700"
                  : "bg-green-50 text-green-800"
              }`}
            >
              {message}
            </p>
          )}

        </form>
      </div>
    </main>
  )
}
