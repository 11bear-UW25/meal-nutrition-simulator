// Supabaseに接続するためのcreateClient関数を読み込む
import { createClient } from "@supabase/supabase-js"
import type { Session } from "@supabase/supabase-js"

// .env.localに設定したSupabaseのURLと公開用anonキーを取得
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// URLまたはanonキーが設定されていない場合はエラーを表示する
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabaseの環境変数が設定されていません")
}

// Supabaseへのクライアント（接続口）を作成
// exportをつけることで、他のファイルからも利用できるようにする
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// 同時に認証処理が実行されないよう、進行中の処理を管理する
let pendingSessionInitialization: Promise<Session> | null = null

// 既存の認証セッションを再利用し、なければ匿名ユーザーとしてログインする
export function ensureSupabaseSession(): Promise<Session> {
  if (!pendingSessionInitialization) {
    pendingSessionInitialization = (async () => {

      // 現在のログイン状態を確認する
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession()

      // 認証状態の取得に失敗した場合
      if (sessionError) {
        throw new Error(
          `認証状態を確認できませんでした: ${sessionError.message}`
        )
      }

      // 既存のセッションがあれば、そのまま再利用する
      if (sessionData.session) {
        return sessionData.session
      }

      // セッションがなければ匿名ログインする
      const { data, error } =
        await supabase.auth.signInAnonymously()

      // 匿名認証に失敗した場合
      if (error) {
        throw new Error(`匿名認証に失敗しました: ${error.message}`)
      }

      // 匿名認証のセッションを取得できなかった場合
      if (!data.session) {
        throw new Error("匿名認証セッションを取得できませんでした")
      }

      // 作成した匿名セッションを返す
      return data.session

    })().finally(() => {
      // 認証処理が終わったら管理用の変数を初期化する
      pendingSessionInitialization = null
    })
  }

  // 進行中、または新たに開始した認証処理の結果を返す
  return pendingSessionInitialization
}