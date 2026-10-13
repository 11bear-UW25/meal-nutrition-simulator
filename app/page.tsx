'use client'
// reactの機能を読み込む
// useEffect: 画面が表示された後にデータ取得などの処理を実行
// useMemo: 計算結果を必要に応じて再利用
// useState: 画面で使用するデータを管理
import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CirclePlus,
  Clock3,
  FileText,
  Leaf,
  Minus,
  Pencil,
  Plus,
  Save,
  Trash2,
  Utensils,
  X,
} from 'lucide-react'

type MealType = '朝食' | '昼食' | 'おやつ' | '夕食'
type Ingredient = { name: string; quantity: number }

// Supabaseのingredientsテーブルから取得する食品データの型
type FoodData = {
  id: string           // id: 食品を識別するためのID
  name: string          // name: 食品名
  energy: number        // ～saltまで: 食品100gあたりの栄養価
  protein: number 
  fat: number
  carbohydrate: number
  fiber: number
  salt: number
}
type Dish = { id: number; name: string; ingredients: Ingredient[] }
type Meal = { type: MealType; dishes: Dish[] }

const mealTypes: MealType[] = ['朝食', '昼食', 'おやつ', '夕食']
const nutritionLabels = [
  ['energy', 'エネルギー', 'kcal'],
  ['protein', 'たんぱく質', 'g'],
  ['fat', '脂質', 'g'],
  ['carbohydrate', '炭水化物', 'g'],
  ['fiber', '食物繊維', 'g'],
  ['salt', '食塩相当量', 'g'],
] as const

const initialMeals: Meal[] = [
  { type: '朝食', dishes: [{ id: 1, name: 'トーストと目玉焼き', ingredients: [{ name: '食パン', quantity: 60 }, { name: '卵', quantity: 50 }, { name: 'バター', quantity: 5 }] }] },
  { type: '昼食', dishes: [{ id: 2, name: '鶏むね肉のサラダ', ingredients: [{ name: '鶏むね肉', quantity: 100 }, { name: 'ブロッコリー', quantity: 50 }] }] },
  { type: 'おやつ', dishes: [{ id: 3, name: 'ヨーグルト', ingredients: [{ name: 'ヨーグルト', quantity: 100 }] }] },
  { type: '夕食', dishes: [{ id: 4, name: '肉じゃが', ingredients: [{ name: '鶏むね肉', quantity: 120 }, { name: 'じゃがいも', quantity: 150 }, { name: '玉ねぎ', quantity: 60 }, { name: 'にんじん', quantity: 40 }] }] },
]

const seedPlans: Record<string, Meal[]> = {
  '2024-10-01': initialMeals,
  '2024-10-02': initialMeals.map((meal) => ({ ...meal, dishes: meal.type === '夕食' ? [{ ...meal.dishes[0], name: '鮭の塩焼き' }] : [] })),
  '2024-10-04': initialMeals.map((meal) => ({ ...meal, dishes: meal.type === '朝食' ? [{ ...meal.dishes[0], name: '納豆ごはん' }] : [] })),
}

function formatJapaneseDate(date: string) {
  const parsed = new Date(`${date}T00:00:00`)
  return new Intl.DateTimeFormat('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' }).format(parsed)
}

function getWeekDates(anchor: string) {
  const [year, month, day] = anchor.split("-").map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))

  const weekday = date.getUTCDay()
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday

  date.setUTCDate(date.getUTCDate() + mondayOffset)

  return Array.from({ length: 7 }, (_, index) => {
    const current = new Date(date)
    current.setUTCDate(date.getUTCDate() + index)
    return current.toISOString().slice(0, 10)
  })
}

// 指定された週から前後の週へ移動する
function shiftWeek(anchor: string, weeks: number) {
  const [year, month, day] = anchor.split('-').map(Number)  // 日付を年・月・日に分ける
  const date = new Date(Date.UTC(year, month - 1, day))    // UTCで日付を作成する

  date.setUTCDate(date.getUTCDate() + weeks * 7)            // 指定した週数だけ移動する（１週間分）
  
  // YYYY-MM-DD形式で戻す
  return date.toISOString().slice(0, 10)
}

function NutritionCard({ meals, selectedMeal }: { meals: Meal[]; selectedMeal: MealType }) {
  const nutrition = useMemo(() => {
    const total = meals.flatMap((meal) => meal.dishes).flatMap((dish) => dish.ingredients).reduce((sum, ingredient) => sum + ingredient.quantity, 0)
    return [
      Math.round(total * 2.14),
      Math.round(total * 0.18 * 10) / 10,
      Math.round(total * 0.08 * 10) / 10,
      Math.round(total * 0.24 * 10) / 10,
      Math.round(total * 0.035 * 10) / 10,
      Math.round(total * 0.012 * 10) / 10,
    ]
  }, [meals])

  return (
    <section className="rounded-xl border border-[#dfe9df] bg-white p-5 shadow-[0_2px_10px_rgba(41,74,48,0.04)]">
      <div className="mb-4 flex items-center justify-between">
        <div><p className="text-xs font-semibold tracking-[0.16em] text-[#6c866e]">NUTRITION</p><h2 className="mt-1 text-lg font-bold text-[#27382b]">栄養価シミュレーション</h2></div>
        <span className="rounded-full bg-[#edf5ec] px-3 py-1 text-xs font-semibold text-[#5b795e]">計算中</span>
      </div>
      <div className="mb-4 flex gap-2 rounded-lg bg-[#f5f8f3] p-1">
        <button className="flex-1 rounded-md bg-white py-2 text-sm font-semibold text-[#355c3d] shadow-sm">1日全体</button>
        <button className="flex-1 rounded-md py-2 text-sm text-[#6d7e70]">{selectedMeal}</button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {nutritionLabels.map(([key, label, unit], index) => <div key={key} className="rounded-lg border border-[#e7eee5] bg-[#fbfdfb] p-3"><p className="text-xs text-[#77877a]">{label}</p><p className="mt-1 text-xl font-bold text-[#2d4932]">{nutrition[index]}<span className="ml-1 text-xs font-normal text-[#829084]">{unit}</span></p></div>)}
      </div>
      <button className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-[#b5ceb8] py-2.5 text-sm font-semibold text-[#47734d] transition hover:bg-[#f0f7ef]"><Leaf size={15} />栄養価を再計算</button>
    </section>
  )
}

export default function Page() {
  const [selectedDate, setSelectedDate] = useState('2024-10-01')
  // Supabaseから取得した食品一覧を保存
  // 最初はデータがないため、空の配列で初期化
  const [foods, setFoods] = useState<FoodData[]>([])
  // 食品一覧の取得中かどうかを管理
  const [loadingFoods, setLoadingFoods] = useState(true)
  // 食品一覧の取得で発生したエラーを管理
  const [foodsError, setFoodsError] = useState<string | null>(null)

// 画面が表示されたときに食品一覧を取得
useEffect(() => {
  // APIから食品一覧を取得する非同期関数
  async function fetchFoods(){
    try {
      const response = await fetch('/api/ingredients') // Next.jsで作成した食品一覧取得APIを呼び出す

      if (!response.ok) {
        throw new Error('食品一覧の取得に失敗しました') // APIがエラーを返した場合は処理を中断
      }

      // APIから返されたJSONデータを読み込む
      const data: FoodData[] = await response.json()
      // 取得した食品一覧をReactのstateに保存
      setFoods(data)

      // 正常に取得できた場合はエラーを消す
      setFoodsError(null)
    } catch (error) {
      console.error('食品一覧取得エラー', error) // エラーが発生した場合はコンソールに表示

      // 画面表示用のエラーメッセージを保存
      setFoodsError('食品一覧を取得できませんでした')
    } finally {
      setLoadingFoods(false) // 成功・失敗にかかわらず読み込み中の状態を終了
    }
  }

  // 食品一覧の取得処理を実行
  fetchFoods()
}, [])

  const [plans, setPlans] = useState(seedPlans)
  const [editing, setEditing] = useState(false)
  const [selectedMeal, setSelectedMeal] = useState<MealType>('朝食')
  const [selectedDishId, setSelectedDishId] = useState(1)
  const [newDate, setNewDate] = useState('2024-10-05')
  const [weekAnchor, setWeekAnchor] = useState('2024-10-01')
  useEffect(() => {
    const today = new Date()  // パソコンやスマートフォンの現在の日付を取得
    // 年月日をそれぞれ取得
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1). padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')
    // YYYY-MM-DD形式に
    const todayString = `${year}-${month}-${day}`

    setSelectedDate(todayString) // 選択中の日付を今日に
    setWeekAnchor(todayString)   // 週間カレンダーに今日を含む週を表示
    setNewDate(todayString)      // 新しい献立を作成するときの初期日付を今日に 
  }, [])

  const meals = plans[selectedDate] ?? mealTypes.map((type) => ({ type, dishes: [] }))
  const weekDates = getWeekDates(weekAnchor)
  const selectedMealData = meals.find((meal) => meal.type === selectedMeal) ?? meals[0]
  const selectedDish = selectedMealData?.dishes.find((dish) => dish.id === selectedDishId) ?? selectedMealData?.dishes[0]

  function updateCurrent(updater: (current: Meal[]) => Meal[]) {
    setPlans((current) => ({ ...current, [selectedDate]: updater(current[selectedDate] ?? mealTypes.map((type) => ({ type, dishes: [] }))) }))
  }
  function addDish() {
    const id = Date.now()
    updateCurrent((current) => current.map((meal) => meal.type === selectedMeal ? { ...meal, dishes: [...meal.dishes, { id, name: '新しい料理', ingredients: [] }] } : meal))
    setSelectedDishId(id)
  }
  function addIngredient() {
    if (!selectedDish) return
    updateCurrent((current) => current.map((meal) => meal.type === selectedMeal ? { ...meal, dishes: meal.dishes.map((dish) => dish.id === selectedDish.id ? { ...dish, ingredients: [...dish.ingredients, { name: '食パン', quantity: 50 }] } : dish) } : meal))
  }
  function savePlan() { setEditing(false); setPlans((current) => ({ ...current, [selectedDate]: meals })) }
  function selectDate(date: string) { setSelectedDate(date); setEditing(false); setSelectedMeal('朝食') }
  // 今日の日付を取得し、週間カレンダーを今週に戻す
  function goToThisWeek() {
    const today = new Date() //  端末の現在の日付を取得
    // 年・月・日をYYYY-MM-DD形式に
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')

    const todayString = `${year}-${month}-${day}`

    // 今週を含む週に異動
    setWeekAnchor(todayString)
    // 選択中の日付も今日に戻す
    setSelectedDate(todayString)
  }
  return (
  <main className="min-h-screen bg-[#f6f8f3] text-[#29352c]">
    <header className="border-b border-[#e0e8dc] bg-[#fbfcf8]">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between px-5 py-4 md:px-10">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-[#dfeede] text-[#4d7652]">
            <Utensils size={20} />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-wide text-[#2e4432] md:text-lg">自炊献立の栄養価シミュレーター
            </h1>
            <p className="hidden text-xs text-[#7a8a7d] sm:block">献立を考える時間を、もっと心地よく。
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-[#789078]">
          <span className="hidden sm:inline">プロトタイプ
          </span>
          <span className="size-2 rounded-full bg-[#7ba67e]" />
        </div>
      </div>
    </header>
    <div className="mx-auto max-w-[1440px] px-5 py-6 md:px-10 md:py-8">
      <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-semibold text-[#718274]">WELCOME BACK
          </p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-[#293d2e] md:text-3xl">今日の献立を整える
          </h2>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-[#dbe6d9] bg-white px-3 py-2 text-sm text-[#67806b]">
          <CalendarDays size={16} />
          {formatJapaneseDate(selectedDate)}
        </div>
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(340px,0.8fr)]">
        <div className="space-y-6">
          <section className="rounded-xl border border-[#dfe9df] bg-white p-5 shadow-[0_2px_10px_rgba(41,74,48,0.04)]">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold tracking-[0.16em] text-[#6c866e]">THIS WEEK
                </p>
                <h2 className="mt-1 text-lg font-bold text-[#27382b]">週間カレンダー
                </h2>
              </div>
              <div className="flex items-center gap-1">
                {/* 今週に戻るボタン */}
                <button
                  onClick={goToThisWeek}
                  className="rounded-md border border-[#b8ceb9] px-3 py-1.5 text-xs font-semibold text-[#4c7451] hover:bg-[#eef5ed]"
                >
                  今週
                </button>
                {/* 1週間前へ移動 */}
                <button
                  onClick={() => setWeekAnchor((current) => shiftWeek(current, -1))}
                  aria-label="前の週"
                  className="rounded-md p-2 text-[#718774] hover:bg-[#eef5ed]"
                >
                  <ChevronLeft size={18} />
                </button>
                {/* 1週間後へ移動 */}
                <button
                  onClick={() => setWeekAnchor((current) => shiftWeek(current, 1))}
                  aria-label="次の週"
                  className="rounded-md p-2 text-[#718774] hover:bg-[#eef5ed]"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
            {/* 週間カレンダーの日付一覧 */}
            <div className="grid grid-cols-7 gap-2 overflow-x-auto pb-1">
              {weekDates.map((date) => { const dayMeals = plans[date] ?? []; const day = new Date(`${date}T00:00:00`).getDate(); const weekday = new Intl.DateTimeFormat('ja-JP', { weekday: 'short' }).format(new Date(`${date}T00:00:00`)); return (
              <button key={date} onClick={() => selectDate(date)} className={`min-w-[74px] rounded-lg border p-2 text-left transition ${date === selectedDate ? 'border-[#79a17c] bg-[#edf6ec] shadow-sm' : 'border-[#e8eee6] bg-[#fcfdfb] hover:border-[#bdd3be]'}`}>
                <div className="flex items-baseline justify-between">
                  <span className="text-[11px] text-[#809081]">
                    {weekday}
                  </span>
                  <span className="text-lg font-bold text-[#36543b]">
                     {/* 毎月1日は「月/日」で表示し、それ以外は「日」だけ表示 */}
                    {day === 1 ? `${Number(date.slice(5, 7))}/${day}` : day}  
                  </span>
                </div>
                <div className="mt-3 flex flex-col gap-1 text-[10px] text-[#6c7f6d]">
                  {mealTypes.map((type) => { const dish = dayMeals.find((meal) => meal.type === type)?.dishes[0]; return (
                  <span key={type} className="truncate">
                    {dish ? dish.name : '—'}
                  </span>
                  ); })}
                </div>
              </button>
              ); })}
            </div>
          </section>
          <section className="rounded-xl border border-[#dfe9df] bg-white p-5 shadow-[0_2px_10px_rgba(41,74,48,0.04)]">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold tracking-[0.16em] text-[#6c866e]">SELECTED DAY
                </p>
                <h2 className="mt-1 text-xl font-bold text-[#27382b]">
                  {formatJapaneseDate(selectedDate)}の献立
                </h2>
              </div>
              {plans[selectedDate] &&
              <button onClick={() => setEditing(true)} className="flex items-center gap-2 rounded-lg border border-[#b8ceb9] px-3 py-2 text-sm font-semibold text-[#4c7451] hover:bg-[#f0f7ef]">
                <Pencil size={15} />編集
              </button>}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {meals.map((meal) =>
              <button key={meal.type} onClick={() => { setSelectedMeal(meal.type); setEditing(true); setSelectedDishId(meal.dishes[0]?.id ?? 0) }} className="flex min-h-[88px] flex-col justify-between rounded-lg border border-[#e5ece3] bg-[#fbfdfb] p-4 text-left hover:border-[#aac8ad]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold tracking-wide text-[#67836a]">
                    {meal.type}
                  </span>
                  <ArrowRight size={15} className="text-[#a0b0a2]" />
                </div>
                <span className="mt-2 text-sm font-semibold text-[#354b38]">
                  {meal.dishes.length ? meal.dishes.map((dish) => dish.name).join(' / ') :
                  <span className="font-normal text-[#9aa89b]">未登録
                  </span>}
                </span>
              </button>)}
            </div>{!plans[selectedDate] &&
            <button onClick={() => setEditing(true)} className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-[#547d59] py-3 text-sm font-semibold text-white hover:bg-[#466b4b]">
              <Plus size={17} />この日付で献立を作成
            </button>}
          </section>
        </div>
        <aside className="space-y-6">
          <section className="rounded-xl border border-[#dfe9df] bg-[#eaf3e8] p-5">
            <div className="flex items-center gap-2 text-[#4f7654]">
              <CirclePlus size={18} />
              <h2 className="font-bold">新しい献立を作成
              </h2>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-[#6c806d]">日付を選んで、今日の食事を組み立てましょう。
            </p>
            <div className="mt-4 flex gap-2">
              <input type="date" value={newDate} onChange={(event) => setNewDate(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-[#cbdcca] bg-white px-3 py-2.5 text-sm text-[#405443] outline-none focus:border-[#719d76]" />
                <button onClick={() => { setSelectedDate(newDate); setEditing(true); setSelectedMeal('朝食') }} className="rounded-lg bg-[#547d59] px-4 py-2 text-sm font-semibold text-white hover:bg-[#466b4b]">Go
                </button>
              </div>
            </section>
            <NutritionCard meals={meals} selectedMeal={selectedMeal} />
            <section className="rounded-xl border border-[#dfe9df] bg-white p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold tracking-[0.16em] text-[#6c866e]">ARCHIVE
                  </p>
                  <h2 className="mt-1 text-lg font-bold text-[#27382b]">アーカイブ
                  </h2>
                </div>
                <FileText size={18} className="text-[#91aa94]" />
              </div>
              <div className="flex gap-2">{['2024年10月', '2024年9月', '2024年8月'].map((month, index) =>
                <button key={month} onClick={() => index === 0 && selectDate('2024-10-01')} className={`flex-1 rounded-lg px-2 py-3 text-xs font-semibold ${index === 0 ? 'bg-[#eef6ed] text-[#4b7651]' : 'bg-[#fafcf9] text-[#91a092]'}`}>
                  {month}
                </button>)}
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-[#edf1eb] pt-4 text-sm">
                <button className="flex items-center gap-1 text-[#78927b]">
                  <ChevronLeft size={15} />前月
                </button>
                <span className="font-bold text-[#4c644f]">2024年10月
                </span>
                <button className="flex items-center gap-1 text-[#78927b]">次月
                  <ChevronRight size={15} />
                </button>
              </div>
            </section>
          </aside>
        </div>
      </div>
      {editing &&
      <div className="fixed inset-0 z-10 overflow-y-auto bg-[#f6f8f3]">
        <header className="border-b border-[#e0e8dc] bg-[#fbfcf8]">
          <div className="mx-auto flex max-w-[1440px] items-center justify-between px-5 py-4 md:px-10">
            <button onClick={() => setEditing(false)} className="flex items-center gap-2 text-sm font-semibold text-[#557458]">
              <ArrowLeft size={17} />戻る
            </button>
            <button onClick={savePlan} className="flex items-center gap-2 rounded-lg bg-[#547d59] px-4 py-2 text-sm font-semibold text-white hover:bg-[#466b4b]">
              <Save size={16} />保存
            </button>
          </div>
        </header>
        <div className="mx-auto max-w-[1440px] px-5 py-7 md:px-10">
          <div className="mb-6">
            <p className="text-sm font-semibold text-[#718274]">MENU EDITOR
            </p>
            <h2 className="mt-1 text-2xl font-bold text-[#293d2e]">
              {formatJapaneseDate(selectedDate)}の献立
            </h2>
          </div>
          <div className="grid gap-6 xl:grid-cols-[minmax(260px,0.7fr)_minmax(0,1.5fr)]">
            <div className="space-y-6">
              <section className="rounded-xl border border-[#dfe9df] bg-white p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-bold text-[#2e4532]">1日の献立
                  </h3>
                  <Clock3 size={17} className="text-[#91a793]" />
                </div>
                <div className="flex flex-col gap-2">
                  {meals.map((meal) =>
                  <button key={meal.type} onClick={() => { setSelectedMeal(meal.type); setSelectedDishId(meal.dishes[0]?.id ?? 0) }} className={`rounded-lg p-3 text-left ${meal.type === selectedMeal ? 'bg-[#edf6ec]' : 'hover:bg-[#f6f9f5]'}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#638065]">
                        {meal.type}
                      </span>
                      <ChevronDown size={14} className="text-[#9aad9d]" />
                    </div>
                    <p className="mt-1 text-sm text-[#3d5340]">
                      {meal.dishes.length ? meal.dishes.map((dish) => dish.name).join(' / ') :
                      <span className="text-[#a3afa5]">未登録
                      </span>}
                    </p>
                  </button>)}
                </div>
              </section>
              <NutritionCard meals={meals} selectedMeal={selectedMeal} />
            </div>
            <section className="rounded-xl border border-[#dfe9df] bg-white p-5">
              <div className="flex flex-col justify-between gap-3 border-b border-[#edf1eb] pb-5 sm:flex-row sm:items-start">
                <div>
                  <p className="text-xs font-semibold tracking-[0.16em] text-[#6c866e]">MEAL EDITOR
                  </p>
                  <h3 className="mt-1 text-xl font-bold text-[#2d4732]">時間帯：{selectedMeal}
                  </h3>
                </div>
                <button onClick={addDish} className="flex items-center justify-center gap-2 rounded-lg border border-[#b8ceb9] px-3 py-2 text-sm font-semibold text-[#4d7752] hover:bg-[#f0f7ef]">
                  <Plus size={16} />料理を追加
                </button>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {selectedMealData.dishes.map((dish) =>
                <button key={dish.id} onClick={() => setSelectedDishId(dish.id)} className={`rounded-full px-3 py-2 text-sm font-semibold ${dish.id === selectedDish?.id ? 'bg-[#557d5a] text-white' : 'bg-[#edf4eb] text-[#607b63]'}`}>
                  {dish.name}
                </button>)}
              </div>
              {selectedDish ?
              <div className="mt-6 rounded-xl border border-[#e5ece3] bg-[#fbfdfb] p-4">
                <div className="flex items-center gap-3">
                  <input value={selectedDish.name} onChange={(event) => updateCurrent((current) => current.map((meal) => meal.type === selectedMeal ? { ...meal, dishes: meal.dishes.map((dish) => dish.id === selectedDish.id ? { ...dish, name: event.target.value } : dish) } : meal))} className="min-w-0 flex-1 rounded-lg border border-[#d7e3d5] bg-white px-3 py-2.5 text-sm font-semibold text-[#3c513f] outline-none focus:border-[#719d76]" />
                    <button onClick={() => { updateCurrent((current) => current.map((meal) => meal.type === selectedMeal ? { ...meal, dishes: meal.dishes.filter((dish) => dish.id !== selectedDish.id) } : meal)); setSelectedDishId(0) }} aria-label="料理を削除" className="rounded-lg p-2 text-[#bb7770] hover:bg-[#fff1ef]">
                      <Trash2 size={17} />
                    </button>
                  </div>
                  <div className="mt-5 flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-[#3b513e]">食材と使用量
                      </h4>
                      <p className="mt-1 text-xs text-[#89988b]">食材は100gあたりの栄養価で計算されます
                      </p>
                    </div>
                    <button onClick={addIngredient} className="flex items-center gap-1.5 rounded-lg border border-[#c7d9c5] px-3 py-2 text-xs font-semibold text-[#4e7955] hover:bg-[#f0f7ef]">
                      <Plus size={14} />食材を追加
                    </button>
                  </div>
                  <div className="mt-4 flex flex-col gap-3">
                    {selectedDish.ingredients.map((ingredient, index) =>
                    <div key={`${ingredient.name}-${index}`} className="flex items-center gap-2">
                      <select value={ingredient.name} onChange={(event) => updateCurrent((current) => current.map((meal) => meal.type === selectedMeal ? { ...meal, dishes: meal.dishes.map((dish) => dish.id === selectedDish.id ? { ...dish, ingredients: dish.ingredients.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item) } : dish) } : meal))} className="min-w-0 flex-1 rounded-lg border border-[#d7e3d5] bg-white px-3 py-2.5 text-sm text-[#455a47] outline-none focus:border-[#719d76]">
                        {/* Supabaseから取得した食品一覧を選択肢として表示する */}
                        {foods.map((food) => (
                          <option key={food.id} value={food.name}>
                            {food.name}
                          </option>
                          ))}
                        </select>
                        <input type="number" value={ingredient.quantity} onChange={(event) => updateCurrent((current) => current.map((meal) => meal.type === selectedMeal ? { ...meal, dishes: meal.dishes.map((dish) => dish.id === selectedDish.id ? { ...dish, ingredients: dish.ingredients.map((item, itemIndex) => itemIndex === index ? { ...item, quantity: Number(event.target.value) } : item) } : dish) } : meal))} className="w-20 rounded-lg border border-[#d7e3d5] bg-white px-3 py-2.5 text-sm text-[#455a47] outline-none focus:border-[#719d76]" min="1" />
                          <span className="text-xs font-semibold text-[#8a9a8c]">g
                          </span>
                          <button onClick={() => updateCurrent((current) => current.map((meal) => meal.type === selectedMeal ? { ...meal, dishes: meal.dishes.map((dish) => dish.id === selectedDish.id ? { ...dish, ingredients: dish.ingredients.filter((_, itemIndex) => itemIndex !== index) } : dish) } : meal))} aria-label="食材を削除" className="rounded-md p-2 text-[#b77871] hover:bg-[#fff1ef]">
                            <X size={16} />
                          </button>
                        </div>)}
                      </div>
                    </div> :
                    <div className="mt-6 rounded-xl border border-dashed border-[#cbdcca] p-10 text-center text-sm text-[#849586]">料理を追加すると、食材を登録できます。
                    </div>}
                  </section>
                </div>
              </div>
            </div>}
          </main>
        )
      }
