// Supabaseに接続するためのcreateClient関数を読み込む
import { createClient } from "@supabase/supabase-js"

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