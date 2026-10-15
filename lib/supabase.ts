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
// exportをつけることで、他のファイルからも利用できるように
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

let pendingSessionInitialization: Promise<Session> | null = null

// 既存の認証セッションを再利用し、なければ匿名ユーザーとしてログインする
export function ensureSupabaseSession(): Promise<Session> {
  if (!pendingSessionInitialization) {
    pendingSessionInitialization = (async () => {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession()

      if (sessionError) {
        throw new Error(`認証状態を確認できませんでした: ${sessionError.message}`)
      }

      if (sessionData.session) {
        return sessionData.session
      }

      const { data, error } = await supabase.auth.signInAnonymously()

      if (error) {
        throw new Error(`匿名認証に失敗しました: ${error.message}`)
      }

      if (!data.session) {
        throw new Error("匿名認証セッションを取得できませんでした")
      }

      return data.session
    })().finally(() => {
      pendingSessionInitialization = null
    })
  }

  return pendingSessionInitialization
}