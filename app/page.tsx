'use client'
// reactの機能を読み込む
// useEffect: 画面が表示された後にデータ取得などの処理を実行
// useMemo: 計算結果を必要に応じて再利用
// useState: 画面で使用するデータを管理
import { useEffect, useMemo, useRef, useState } from 'react'
import { ensureSupabaseSession, supabase } from '@/lib/supabase'
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
type Dish = { id: number | string; name: string; ingredients: Ingredient[] }
type Meal = { type: MealType; dishes: Dish[] }

const mealTypes: MealType[] = ['朝食', '昼食', 'おやつ', '夕食']
const emptyMeals = (): Meal[] => mealTypes.map((type) => ({ type, dishes: [] }))
const nutritionLabels = [
  ['energy', 'エネルギー', 'kcal'],
  ['protein', 'たんぱく質', 'g'],
  ['fat', '脂質', 'g'],
  ['carbohydrate', '炭水化物', 'g'],
  ['fiber', '食物繊維', 'g'],
  ['salt', '食塩相当量', 'g'],
] as const

// 端末の現在日付を、日付入力と同じ形式で取得する
function getTodayDate() {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// 指定月から前後した月の1日を取得する
function getMonthStart(date: string, offset = 0) {
  const [year, month] = date.split('-').map(Number)
  const monthStart = new Date(Date.UTC(year, month - 1 + offset, 1))
  return monthStart.toISOString().slice(0, 10)
}

// 日付に対応する年月を日本語で表示する
function formatJapaneseMonth(date: string) {
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`))
}

function formatJapaneseDate(date: string) {
  const parsed = new Date(`${date}T00:00:00`)
  return new Intl.DateTimeFormat('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' }).format(parsed)
}

// RLSで取得できる指定日の献立を画面用データに変換する
async function fetchPlanForDate(date: string, foods: FoodData[]): Promise<Meal[] | null> {
  const { data: plan, error: planError } = await supabase
    .from('menu_plans')
    .select('id')
    .eq('target_date', date)
    .maybeSingle()

  if (planError) {
    throw planError
  }
  if (!plan) {
    return null
  }

  const { data: slots, error: slotsError } = await supabase
    .from('meal_slots')
    .select('id, meal_type')
    .eq('menu_plan_id', plan.id)

  if (slotsError) {
    throw slotsError
  }

  const result = emptyMeals()
  const slotRows = slots ?? []
  const slotIds = slotRows.map((slot) => slot.id)
  if (slotIds.length === 0) {
    return result
  }

  const { data: items, error: itemsError } = await supabase
    .from('menu_items')
    .select('id, meal_slot_id, dish_name')
    .in('meal_slot_id', slotIds)

  if (itemsError) {
    throw itemsError
  }

  const itemRows = items ?? []
  const dishById = new Map<string, Dish>()
  const slotById = new Map(slotRows.map((slot) => [slot.id, slot]))

  for (const item of itemRows) {
    const slot = slotById.get(item.meal_slot_id)
    if (!slot || !mealTypes.includes(slot.meal_type as MealType)) {
      throw new Error('保存済み献立の食事区分が正しくありません')
    }

    const dish: Dish = {
      id: item.id,
      name: item.dish_name,
      ingredients: [],
    }
    result.find((meal) => meal.type === slot.meal_type)?.dishes.push(dish)
    dishById.set(item.id, dish)
  }

  const itemIds = itemRows.map((item) => item.id)
  if (itemIds.length === 0) {
    return result
  }

  const { data: ingredients, error: ingredientsError } = await supabase
    .from('menu_item_ingredients')
    .select('menu_item_id, ingredient_id, quantity')
    .in('menu_item_id', itemIds)

  if (ingredientsError) {
    throw ingredientsError
  }

  for (const ingredient of ingredients ?? []) {
    const dish = dishById.get(ingredient.menu_item_id)
    const food = foods.find((item) => item.id === ingredient.ingredient_id)
    if (!dish || !food) {
      throw new Error('保存済み献立に食品一覧から確認できない食材があります')
    }

    dish.ingredients.push({
      name: food.name,
      quantity: Number(ingredient.quantity),
    })
  }

  return result
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

// 指定された週から前後の週へ移動
function shiftWeek(anchor: string, weeks: number) {
  const [year, month, day] = anchor.split('-').map(Number)  // 日付を年・月・日に分ける
  const date = new Date(Date.UTC(year, month - 1, day))    // UTCで日付を作成

  date.setUTCDate(date.getUTCDate() + weeks * 7)            // 指定した週数だけ移動（１週間分）

  // YYYY-MM-DD形式で戻す
  return date.toISOString().slice(0, 10)
}

// 献立データとSupabaseから取得した食品データを受け取る
function NutritionCard({
  meals,
  selectedMeal,
  foods,
  loadingFoods,
  foodsError,
}: {
  meals: Meal[]             //献立データ
  selectedMeal: MealType    // 選択中の食事区分
  foods: FoodData[]         // 取得した食品データ
  loadingFoods: boolean     // 食品データ取得中かどうか
  foodsError: string | null // 食品データ取得中に発生したエラー
}) {
  // 栄養価の表示範囲を管理…all: 1日全体、 meal: 選択中の食事
  const [nutritionView, setNutritionView] = useState<'all' | 'meal'>('all')
  // 栄養価を表示する食事区分を管理
  const [nutritionMeal, setNutritionMeal] = useState<MealType>(selectedMeal)

  // 献立編集画面で選択中の食事区分が変わったら、栄養価表示側も合わせる
  useEffect(() => {
    setNutritionMeal(selectedMeal)
  }, [selectedMeal])

  // 栄養価を計算
  const nutrition = useMemo(() => {
    // 6種類の栄養価を0で初期化
    const totals = {
      energy: 0,
      protein: 0,
      fat: 0,
      carbohydrate: 0,
      fiber: 0,
      salt: 0,
    }
  // 表示モードに応じて計算対象の食事を決める
  const targetMeals =
    nutritionView === 'all'
    ? meals
    : meals.filter((meal) => meal.type === nutritionMeal)
  // 選択された表示範囲の食事だけを計算
  for (const meal of targetMeals) {
    // 各食事に登録されている料理を確認
    for (const dish of meal.dishes) {
      // 各料理に登録されている食材を確認
      for (const ingredient of dish.ingredients) {
        // 食品が未選択の場合は栄養価を計算しない
        if (!ingredient.name) {
          continue
        }
        //  食材名からSupabaseの食品データを探す
        const food = foods.find(
          (item) => item.name === ingredient.name
        )
        // 食品データが見つからなかった場合はスキップ
        if (!food) {
          continue
        }
        // 100gあたりの栄養価を使用量に換算する
        const ratio = ingredient.quantity / 100
        totals.energy += food.energy * ratio // エネルギー（kcal）
        totals.protein += food.protein * ratio // たんぱく質（g）
        totals.fat += food.fat * ratio // 脂質（g）
        totals.carbohydrate += food.carbohydrate * ratio // 炭水化物（g）
        totals.fiber += food.fiber * ratio // 食物繊維（g）
        totals.salt += food.salt *ratio // 食塩相当量（g）
      }
    }
  }
  // 表示用に小数点を整理
  return [
    Math.round(totals.energy),
    Math.round(totals.protein * 10) / 10,
    Math.round(totals.fat * 10) / 10,
    Math.round(totals.carbohydrate * 10) / 10,
    Math.round(totals.fiber * 10) / 10,
    Math.round(totals.salt * 10) / 10,
  ]
  // 献立または食品データが変わったときに再計算
}, [meals, foods, nutritionView, nutritionMeal])

// Supabaseの食品データに存在しない食材を確認
const missingFoodNames = useMemo(() => {
  // 食品データがまだない場合は、ここでは判定しない
  if (foods.length === 0) {
    return []
  }

  // 現在表示している食事を判定対象に
  const targetMeals =
  nutritionView === 'all'
    ? meals
    : meals.filter((meal) => meal.type === nutritionMeal)

  // 対象の食事に含まれる食材名をすべて取得
  const ingredientNames = targetMeals
    .flatMap((meal) =>meal.dishes)
    .flatMap((dish) => dish.ingredients)
    .map((ingredient) => ingredient.name)
    .filter((name) => name !== '') // 未選択の食材は警告対象から除外

  // 対象の食事に含まれる食材名をすべて取得
  const missingNames = ingredientNames.filter(
    (name) => !foods.some((food) => food.name === name)
  )
  return [...new Set(missingNames)]   // 同じ食材名が複数ある場合は、重複を取り除く
}, [meals, foods, nutritionView, nutritionMeal])

  return (
    <section className="rounded-xl border border-[#dfe9df] bg-white p-5 shadow-[0_2px_10px_rgba(41,74,48,0.04)]">
      <div className="mb-4 flex items-center justify-between">
        <div><p className="text-xs font-semibold tracking-[0.16em] text-[#6c866e]">NUTRITION</p><h2 className="mt-1 text-lg font-bold text-[#27382b]">栄養価シミュレーション</h2></div>
      </div>
      {/* 栄養価の表示範囲を切り替える */}
      <div className="mb-4 flex gap-2 rounded-lg bg-[#f5f8f3] p-1">

        {/* 1日全体の栄養価を表示 */}
        <button
          onClick={() => setNutritionView('all')}
          className={`flex-1 rounded-md bg-white py-2 text-sm ${
            nutritionView === 'all'
            ? 'bg-white font-semibold text-[#355c3d] shadow-sm'
            : 'text-[#6d7e70]'
          }`}
        >
          1日全体
        </button>

        {/* 食事別の栄養価を表示 */}
        <button
          onClick={() => setNutritionView('meal')}
          className={`flex-1 rounded-md py-2 text-sm ${
            nutritionView === 'meal'
            ? 'bg-white font-semibold text-[#355c3d] shadow-sm'
            : 'text-[#6d7e70]'
          }`}
        >
          食事別
        </button>
      </div>

      {/* 食事別を選択したときに、栄養価を表示する食事区分を選ぶ */}
      {nutritionView === 'meal' && (
        <div className="mb-4 grid grid-cols-4 gap-1 rounded-lg bg-[#f5f8f3] p-1">
          {mealTypes.map((mealType) => (
            <button
              key={mealType}
              onClick={() => setNutritionMeal(mealType)}
              aria-pressed={nutritionMeal === mealType}
              className={`rounded-md py-2 text-xs ${
                nutritionMeal === mealType
                  ? 'bg-white font-semibold text-[#355c3d] shadow-sm'
                  : 'text-[#6d7e70]'
              }`}
            >
              {mealType}
            </button>
          ))}
        </div>
      )}

      {/* 食品データを読み込んでいる間だけメッセージを表示 */}
      {loadingFoods && (
        <p
          role='status'
          className="mb-4 rounded-lg bg-[#f5f8f3] p-3 text-sm text-[#6d7e70]"
        >
          食品データを読み込んでいます…
        </p>
      )}

      {/* 食品データの取得に失敗した場合はエラーを表示 */}
      {foodsError && (
        <p
          role="alert"
          className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800"
        >
          {foodsError}
          <span className="mt-1 block">
            栄養価の計算ができません。ページを再読み込みしてください。
          </span>
        </p>
      )}

      {/* 6種類の栄養価を2列で表示 */}
      <div className="grid grid-cols-2 gap-3">
        {nutritionLabels.map(([key, label, unit], index) => (
          <div
            key={key}
            className="rounded-lg border border-[#e7eee5] bg-[#fbfdfb] p-3"
          >
             {/* 栄養素の名前を表示 */}
            <p className="text-xs text-[#77877a]">
              {label}
            </p>
            {/* 読み込み中・エラー時は数値の代わりに「—」を表示 */}
            <p className="mt-1 text-xl font-bold text-[#2d4932]">
              {loadingFoods || foodsError ? '-': nutrition [index]}

              {/* 計算できている場合だけ単位を表示する */}
              {!loadingFoods && !foodsError &&(
                <span className="ml-1 text-xs font-nomal text-[#829084]">
                  {unit}
                </span>
              )}
            </p>
          </div>
        ))}
      </div>

      {/* 計算対象外の食材がある場合だけ注意を表示 */}
      {missingFoodNames.length > 0 && (
      <p
        role="alert"
        className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800"
      >
      {/* 計算に含まれなかった食材名を表示 */}
      計算対象外の食材：{missingFoodNames.join('、')}

      <span className="mt-1 block">
        食品データに見つからなかったため、
        これらの食材は栄養価の合計に含まれていません。
      </span>
    </p>
  )}
  </section>
  )
}

export default function Page() {
  const [selectedDate, setSelectedDate] = useState(getTodayDate)
  const [plans, setPlans] = useState<Record<string, Meal[]>>({})
  const [savedPlanDates, setSavedPlanDates] = useState<Set<string>>(new Set())
  const loadedPlanDates = useRef(new Set<string>())
  const editedPlanDates = useRef(new Set<string>())
  const planRequestId = useRef(0)
  const [authReady, setAuthReady] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [authRetry, setAuthRetry] = useState(0)
  const [planLoading, setPlanLoading] = useState(false)
  const [planError, setPlanError] = useState<string | null>(null)
  const [planRetry, setPlanRetry] = useState(0)
  const [savingPlan, setSavingPlan] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [deletingPlan, setDeletingPlan] = useState(false)
  const [deleteError, setDeleteError] = useState<{ date: string; message: string } | null>(null)
  const [reuseSourceDate, setReuseSourceDate] = useState(getTodayDate)
  const [reuseTargetDate, setReuseTargetDate] = useState(getTodayDate)
  const [reuseLoading, setReuseLoading] = useState(false)
  const [reuseError, setReuseError] = useState<string | null>(null)
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

  const [editing, setEditing] = useState(false)
  const [selectedMeal, setSelectedMeal] = useState<MealType>('朝食')
  const [selectedDishId, setSelectedDishId] = useState<number | string>(1)
  const [newDate, setNewDate] = useState(getTodayDate)
  const [weekAnchor, setWeekAnchor] = useState(getTodayDate)

  const meals = plans[selectedDate] ?? emptyMeals()
  const weekDates = getWeekDates(weekAnchor)
  const visibleWeekKey = weekDates.join(',')
  const selectedMealData = meals.find((meal) => meal.type === selectedMeal) ?? meals[0]
  const selectedDish = selectedMealData?.dishes.find((dish) => dish.id === selectedDishId) ?? selectedMealData?.dishes[0]

  // 既存セッションを再利用し、なければ匿名ユーザーを作成する
  useEffect(() => {
    let active = true

    async function initializeAuth() {
      try {
        await ensureSupabaseSession()
        if (active) {
          setAuthError(null)
          setAuthReady(true)
        }
      } catch (error) {
        console.error('匿名認証エラー', error)
        if (active) {
          setAuthError(error instanceof Error ? error.message : '認証に失敗しました')
        }
      }
    }

    initializeAuth()
    return () => {
      active = false
    }
  }, [authRetry])

  // 表示中の週と選択日について、認証後に保存済み献立を読み込む
  useEffect(() => {
    if (!authReady || loadingFoods) {
      return
    }

    const requestedDates = [...new Set([...weekDates, selectedDate])]
    const datesToLoad = requestedDates.filter((date) => !loadedPlanDates.current.has(date))

    if (datesToLoad.length === 0) {
      return
    }

    const requestId = ++planRequestId.current
    let active = true
    setPlanLoading(true)
    setPlanError(null)

    async function loadPlans() {
      try {
        if (foodsError) {
          throw new Error('食品一覧を取得できないため、献立の読み込みを完了できません')
        }

        const loadedPlans = await Promise.all(
          datesToLoad.map(async (date) => ({
            date,
            meals: await fetchPlanForDate(date, foods),
          })),
        )

        if (!active || requestId !== planRequestId.current) {
          return
        }

        // 読み込み中に編集された日付は、画面上の変更を上書きしない
        setPlans((current) => {
          const next = { ...current }
          for (const { date, meals: loadedMeals } of loadedPlans) {
            if (!editedPlanDates.current.has(date)) {
              next[date] = loadedMeals ?? emptyMeals()
            }
          }
          return next
        })

        for (const { date } of loadedPlans) {
          loadedPlanDates.current.add(date)
        }

        const datesWithPlans = new Set(
          loadedPlans.filter((plan) => plan.meals !== null).map((plan) => plan.date),
        )
        setSavedPlanDates((current) => {
          const next = new Set(current)
          for (const date of datesToLoad) {
            // 削除や編集後に完了した古い読み込みで、現在の状態を上書きしない
            if (editedPlanDates.current.has(date)) {
              continue
            }
            if (datesWithPlans.has(date)) {
              next.add(date)
            } else {
              next.delete(date)
            }
          }
          return next
        })
      } catch (error) {
        console.error('献立読み込みエラー', error)
        if (active && requestId === planRequestId.current) {
          setPlanError(error instanceof Error ? error.message : '献立を読み込めませんでした')
        }
      } finally {
        if (active && requestId === planRequestId.current) {
          setPlanLoading(false)
        }
      }
    }

    loadPlans()
    return () => {
      active = false
      if (requestId === planRequestId.current) {
        setPlanLoading(false)
      }
    }
  }, [authReady, foods, foodsError, loadingFoods, planRetry, selectedDate, visibleWeekKey])

  function updateCurrent(updater: (current: Meal[]) => Meal[]) {
    editedPlanDates.current.add(selectedDate)
    setPlans((current) => ({ ...current, [selectedDate]: updater(current[selectedDate] ?? mealTypes.map((type) => ({ type, dishes: [] }))) }))
  }
  function addDish() {
    const id = Date.now()
    updateCurrent((current) => current.map((meal) => meal.type === selectedMeal ? { ...meal, dishes: [...meal.dishes, { id, name: '新しい料理', ingredients: [] }] } : meal))
    setSelectedDishId(id)
  }
  function addIngredient() {
    if (!selectedDish) return
    // 新しい食材は、食品を選択するまで未選択の状態にする
    updateCurrent((current) => current.map((meal) => meal.type === selectedMeal ? { ...meal, dishes: meal.dishes.map((dish) => dish.id === selectedDish.id ? { ...dish, ingredients: [...dish.ingredients, { name: '', quantity: 50 }] } : dish) } : meal))
  }
  // 食品名を食品IDに変換して、原子的な保存用DB関数を呼び出す
  async function savePlan() {
    const dateToSave = selectedDate
    const mealsToSave = meals
    setSavingPlan(true)
    setSaveError(null)

    try {
      await ensureSupabaseSession()

      const mealsPayload = mealsToSave.map((meal) => ({
        type: meal.type,
        dishes: meal.dishes.map((dish) => {
          if (!dish.name.trim()) {
            throw new Error('料理名を入力してください')
          }

          return {
            name: dish.name.trim(),
            ingredients: dish.ingredients.map((ingredient) => {
              if (!ingredient.name) {
                throw new Error('食品を選択してください')
              }

              const food = foods.find((entry) => entry.name === ingredient.name)
              if (!food) {
                throw new Error(`食品一覧にない食材は保存できません: ${ingredient.name}`)
              }

              if (!Number.isFinite(ingredient.quantity) || ingredient.quantity <= 0) {
                throw new Error(`使用量を正しく入力してください: ${ingredient.name}`)
              }

              return {
                ingredient_id: food.id,
                quantity: ingredient.quantity,
                unit: 'g',
              }
            }),
          }
        }),
      }))

      const { data, error } = await supabase.rpc('save_menu_plan_atomic_v1', {
        p_target_date: dateToSave,
        p_meals: mealsPayload,
      })

      if (error) {
        throw error
      }
      if (!data) {
        throw new Error('献立の保存結果を確認できませんでした')
      }

      // 古い読み込み要求が保存内容を上書きしないよう、この日付を編集済みとして保持する
      loadedPlanDates.current.add(dateToSave)
      editedPlanDates.current.add(dateToSave)
      setPlans((current) => ({ ...current, [dateToSave]: mealsToSave }))
      setSavedPlanDates((current) => new Set(current).add(dateToSave))
      setPlanError(null)
      setEditing(false)
    } catch (error) {
      console.error('献立保存エラー', error)
      setSaveError(error instanceof Error ? error.message : '献立を保存できませんでした')
    } finally {
      setSavingPlan(false)
    }
  }

  // 確認後に削除RPCを呼び、成功した場合だけ画面の献立を空にする
  async function deletePlan() {
    const dateToDelete = selectedDate
    if (!window.confirm(`${formatJapaneseDate(dateToDelete)}の献立と、登録されている料理・食材をすべて削除します。この操作は取り消せません。よろしいですか？`)) {
      return
    }

    setDeletingPlan(true)
    setDeleteError(null)

    try {
      await ensureSupabaseSession()
      const { data, error } = await supabase.rpc('delete_menu_plan_atomic_v1', {
        p_target_date: dateToDelete,
      })

      if (error) {
        throw error
      }
      if (data !== true) {
        throw new Error(data === false
          ? '削除対象の献立が見つかりませんでした。表示を更新して確認してください。'
          : '献立の削除結果を確認できませんでした')
      }

      // 古い読み込み結果が削除済みの献立を復活させないようにする
      loadedPlanDates.current.add(dateToDelete)
      editedPlanDates.current.add(dateToDelete)
      setPlans((current) => ({ ...current, [dateToDelete]: emptyMeals() }))
      setSavedPlanDates((current) => {
        const next = new Set(current)
        next.delete(dateToDelete)
        return next
      })
      setPlanError(null)
    } catch (error) {
      console.error('献立全体の削除エラー', error)
      setDeleteError({
        date: dateToDelete,
        message: error instanceof Error ? error.message : '献立を削除できませんでした',
      })
    } finally {
      setDeletingPlan(false)
    }
  }

  // 保存済み献立を別の日付の編集画面へコピーする
  async function reusePlan() {
    if (reuseSourceDate === reuseTargetDate) {
      setReuseError('コピー元とコピー先には別の日付を指定してください')
      return
    }

    setReuseLoading(true)
    setReuseError(null)

    try {
      if (!authReady) {
        throw new Error('認証の準備が完了していません')
      }
      if (loadingFoods || foodsError) {
        throw new Error('食品データの読み込みが完了してから再利用してください')
      }

      await ensureSupabaseSession()
      const sourceMeals = await fetchPlanForDate(reuseSourceDate, foods)
      if (!sourceMeals) {
        throw new Error(`${reuseSourceDate} に保存済みの献立がありません`)
      }

      const targetMeals = await fetchPlanForDate(reuseTargetDate, foods)
      if (targetMeals && !window.confirm(
        `${reuseTargetDate} にはすでに献立があります。コピー先の編集内容を置き換えますか？保存するまでは、Supabase上の献立は変更されません。`,
      )) {
        return
      }

      // 料理IDだけ新しくし、料理名・食材・使用量・食事区分を複製する
      let nextDishId = Date.now()
      const copiedMeals = sourceMeals.map((meal) => ({
        ...meal,
        dishes: meal.dishes.map((dish) => ({
          ...dish,
          id: nextDishId++,
          ingredients: dish.ingredients.map((ingredient) => ({ ...ingredient })),
        })),
      }))

      loadedPlanDates.current.add(reuseTargetDate)
      editedPlanDates.current.add(reuseTargetDate)
      setPlans((current) => ({ ...current, [reuseTargetDate]: copiedMeals }))
      setSavedPlanDates((current) => {
        const next = new Set(current)
        if (targetMeals) {
          next.add(reuseTargetDate)
        } else {
          next.delete(reuseTargetDate)
        }
        return next
      })
      setSelectedDate(reuseTargetDate)
      setWeekAnchor(reuseTargetDate)
      setSelectedMeal('朝食')
      setSelectedDishId(copiedMeals.find((meal) => meal.type === '朝食')?.dishes[0]?.id ?? 0)
      setSaveError(null)
      setEditing(true)
    } catch (error) {
      console.error('献立の再利用エラー', error)
      setReuseError(error instanceof Error ? error.message : '献立を再利用できませんでした')
    } finally {
      setReuseLoading(false)
    }
  }

  function selectDate(date: string) {
    setSelectedDate(date)
    setWeekAnchor(date)
    setReuseSourceDate(date)
    setEditing(false)
    setSelectedMeal('朝食')
    setSaveError(null)
    setDeleteError(null)
    setReuseError(null)
  }
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
      </div>
    </header>
    <div className="mx-auto max-w-[1440px] px-5 py-6 md:px-10 md:py-8">
      {authError && (
        <p role="alert" className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          {authError}
          <button
            onClick={() => {
              setAuthReady(false)
              setAuthRetry((retry) => retry + 1)
            }}
            className="ml-3 font-semibold underline"
          >
            再試行
          </button>
        </p>
      )}
      {!authReady && !authError && (
        <p role="status" className="mb-4 text-sm text-[#718274]">認証を準備しています…</p>
      )}
      {planError && (
        <p role="alert" className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          {planError}
          <button
            onClick={() => setPlanRetry((retry) => retry + 1)}
            className="ml-3 font-semibold underline"
          >
            再読み込み
          </button>
        </p>
      )}
      {planLoading && (
        <p role="status" className="mb-4 text-sm text-[#718274]">保存済みの献立を読み込んでいます…</p>
      )}
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
              {savedPlanDates.has(selectedDate) &&
              <div className="flex items-center gap-2">
                <button onClick={() => setEditing(true)} className="flex items-center gap-2 rounded-lg border border-[#b8ceb9] px-3 py-2 text-sm font-semibold text-[#4c7451] hover:bg-[#f0f7ef]">
                  <Pencil size={15} />編集
                </button>
                <button
                  onClick={deletePlan}
                  disabled={!authReady || deletingPlan || planLoading}
                  className="flex items-center gap-2 rounded-lg border border-[#e2bdb8] px-3 py-2 text-sm font-semibold text-[#a95e56] hover:bg-[#fff1ef] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Trash2 size={15} />{deletingPlan ? '削除中…' : '献立全体を削除'}
                </button>
              </div>}
            </div>
            {deleteError?.date === selectedDate && (
              <p role="alert" className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                {deleteError.message}
              </p>
            )}
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
            </div>{!savedPlanDates.has(selectedDate) &&
            <button onClick={() => setEditing(true)} disabled={!authReady || planLoading || !loadedPlanDates.current.has(selectedDate)} className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-[#547d59] py-3 text-sm font-semibold text-white hover:bg-[#466b4b] disabled:cursor-not-allowed disabled:opacity-50">
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
                <button onClick={() => { setSelectedDate(newDate); setWeekAnchor(newDate); setEditing(true); setSelectedMeal('朝食'); setSaveError(null) }} disabled={!authReady} className="rounded-lg bg-[#547d59] px-4 py-2 text-sm font-semibold text-white hover:bg-[#466b4b] disabled:cursor-not-allowed disabled:opacity-50">Go
                </button>
              </div>
            </section>
            {/* 保存済み献立を別の日付へコピーし、保存前に編集できるようにする */}
            <section className="rounded-xl border border-[#dfe9df] bg-white p-5">
              <h2 className="font-bold text-[#2e4532]">献立を再利用</h2>
              <p className="mt-2 text-sm leading-relaxed text-[#6c806d]">
                保存済み献立をコピー先の日付の編集画面に複製します。内容を確認してから保存してください。
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-semibold text-[#67806b]">
                  コピー元の日付
                  <input
                    type="date"
                    value={reuseSourceDate}
                    onChange={(event) => setReuseSourceDate(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-[#cbdcca] bg-white px-3 py-2.5 text-sm font-normal text-[#405443] outline-none focus:border-[#719d76]"
                  />
                </label>
                <label className="text-xs font-semibold text-[#67806b]">
                  コピー先の日付
                  <input
                    type="date"
                    value={reuseTargetDate}
                    onChange={(event) => setReuseTargetDate(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-[#cbdcca] bg-white px-3 py-2.5 text-sm font-normal text-[#405443] outline-none focus:border-[#719d76]"
                  />
                </label>
              </div>
              {reuseError && (
                <p role="alert" className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                  {reuseError}
                </p>
              )}
              <button
                onClick={reusePlan}
                disabled={!authReady || reuseLoading || loadingFoods || !!foodsError}
                className="mt-4 w-full rounded-lg border border-[#b8ceb9] py-2.5 text-sm font-semibold text-[#4c7451] hover:bg-[#f0f7ef] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {reuseLoading ? '献立を読み込んでいます…' : 'コピーして編集'}
              </button>
            </section>
            {/* 献立と食品データを栄養価表示コンポーネントへ渡す */}
            <NutritionCard
              meals={meals}
              selectedMeal={selectedMeal}
              foods={foods}
              loadingFoods={loadingFoods}
              foodsError={foodsError}
            />
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
              <div className="flex gap-2">{[0, -1, -2].map((offset) => {
                const monthStart = getMonthStart(selectedDate, offset)
                return (
                  <button
                    key={monthStart}
                    onClick={() => selectDate(monthStart)}
                    className={`flex-1 rounded-lg px-2 py-3 text-xs font-semibold ${offset === 0 ? 'bg-[#eef6ed] text-[#4b7651]' : 'bg-[#fafcf9] text-[#91a092]'}`}
                  >
                    {formatJapaneseMonth(monthStart)}
                  </button>
                )
              })}
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-[#edf1eb] pt-4 text-sm">
                <button onClick={() => selectDate(getMonthStart(selectedDate, -1))} className="flex items-center gap-1 text-[#78927b]">
                  <ChevronLeft size={15} />前月
                </button>
                <span className="font-bold text-[#4c644f]">{formatJapaneseMonth(selectedDate)}
                </span>
                <button onClick={() => selectDate(getMonthStart(selectedDate, 1))} className="flex items-center gap-1 text-[#78927b]">次月
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
            <button onClick={savePlan} disabled={!authReady || savingPlan || loadingFoods || !!foodsError || !loadedPlanDates.current.has(selectedDate)} className="flex items-center gap-2 rounded-lg bg-[#547d59] px-4 py-2 text-sm font-semibold text-white hover:bg-[#466b4b] disabled:cursor-not-allowed disabled:opacity-50">
              <Save size={16} />{savingPlan ? '保存中…' : '保存'}
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
          {saveError && (
            <p role="alert" className="mb-5 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              {saveError}
            </p>
          )}
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
              <NutritionCard
                meals={meals}
                selectedMeal={selectedMeal}
                foods={foods}
                loadingFoods={loadingFoods}
                foodsError={foodsError}
              />
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
                        {/* 食品を選択するまで未選択の状態を表示する */}
                        <option value="">食品を選択してください</option>
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
