// Next.jsでJSON形式のレスポンスを返すための機能を読み込む
import { NextResponse } from "next/server"

// lib/supabase.tsで作成したSupabaseクライアントを読み込む
import { supabase } from "@/lib/supabase"

// export async function GET(): GETリクエストを受け取る
export async function GET() {
    const { data, error } = await supabase
    .from("ingredients")                // .from("ingredients"): 食品テーブルを指定
    .select("*")                        // select("*"): すべてのカラムを取得
    .order("name", { ascending: true }) // order("name"): 食品名順に並べる（昇順）

// if (error): データ取得失敗時の処理
if (error) {
    console.error("食品データの取得に失敗しました", error.message)  // エラー内容をvs codeターミナルに表示

    // ブラウザにエラーメッセージを返す
return NextResponse.json(
    { error: "食品データを取得できませんでした" },
    { status: 500 }
  )
}

// 取得したデータをJSON形式で返す
return NextResponse.json(data)
}
