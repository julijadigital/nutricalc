import { useState, useCallback } from 'react';
import { Plus, Trash2, Flame, Target, ChefHat, Loader2 } from 'lucide-react';

// =====================================================================
// NUTRITION COACH PLUGIN (ISOLATED - NO MODIFICATIONS TO EXISTING LOGIC)
// =====================================================================
const nutritionCoach = {
  dailyTargets: (userWeight: number | null, calorieTarget: number = DEFAULT_CALORIE_TARGET, proteinMultiplier: number = DEFAULT_PROTEIN_MULTIPLIER) => ({
    calorieTarget,
    proteinTarget: userWeight ? Math.round(userWeight * proteinMultiplier) : Math.round(calorieTarget * 0.15 / 4),
  }),
  progress: (
    totalCalories: number,
    totalProtein: number,
    targets: { calorieTarget: number; proteinTarget: number }
  ) => ({
    calorieProgress: (totalCalories / targets.calorieTarget) * 100,
    proteinProgress: (totalProtein / targets.proteinTarget) * 100,
  }),
  insight: (data: {
    calories: number;
    protein: number;
    proteinProgress: number;
    calorieProgress: number;
    muscleGainScore: number;
    calorieTarget: number;
  }) => {
    const { calories, protein, proteinProgress, calorieProgress, muscleGainScore, calorieTarget } = data;
    if (proteinProgress >= 80 && muscleGainScore >= 70) return 'Good muscle-building meal. Protein intake is strong.';
    if (calories > 0 && calories < calorieTarget * 0.35 && proteinProgress >= 60) return 'Great fat-loss meal. High satiety and controlled calories.';
    if (proteinProgress < 50) return 'Add more protein (chicken, eggs, tofu, yogurt).';
    if (calorieProgress > 100) return `You are ${Math.round(calorieProgress - 100)}% above your daily calorie target.`;
    if (protein === 0 && calories > 0) return 'Complete your meal with protein-rich foods.';
    return 'Balanced meal with good nutrition quality.';
  },
};

interface Ingredient {
  id: string;
  name: string;
  originalName?: string;
  grams: number;
  kcalPer100g: number | null;
  proteinPer100g: number | null;
  status: 'idle' | 'loading' | 'found' | 'not_found';
}

const DEFAULT_CALORIE_TARGET = 2000;
const DEFAULT_PROTEIN_MULTIPLIER = 1.6;

function getUserCalorieTarget(): number {
  const stored = localStorage.getItem('daily_calorie_target');
  return stored ? Math.max(parseInt(stored), 500) : DEFAULT_CALORIE_TARGET;
}

function setUserCalorieTarget(value: number): void {
  localStorage.setItem('daily_calorie_target', String(Math.max(value, 500)));
}

function getUserProteinMultiplier(): number {
  const stored = localStorage.getItem('protein_multiplier');
  return stored ? parseFloat(stored) : DEFAULT_PROTEIN_MULTIPLIER;
}

function generateId() {
  return Math.random().toString(36).slice(2, 11);
}

function resolveIngredient(input: string): string {
  const name = input.trim().toLowerCase().replace(/\s+/g, ' ');
  const map: Record<string, string> = {
    bannana: 'banana', bananna: 'banana', appel: 'apple', aple: 'apple',
    chiken: 'chicken', chickn: 'chicken', chedken: 'chicken', chicked: 'chicken',
    chick: 'chicken', chikn: 'chicken', chicke: 'chicken', chciken: 'chicken',
    jogurt: 'yogurt', yoghurt: 'yogurt', yogourt: 'yogurt', yougurt: 'yogurt',
    rise: 'rice', patato: 'potato', potatos: 'potato', potatoe: 'potato',
    patatoes: 'potato', brocoli: 'broccoli', mushrom: 'mushrooms',
    mushroon: 'mushrooms', carrott: 'carrots', carrotts: 'carrots',
    carot: 'carrots', carots: 'carrots', caret: 'carrots',
    cucamber: 'cucumber', strawbery: 'strawberries', strawberyes: 'strawberries',
    tomatoe: 'tomatoes', tomatos: 'tomatoes', spnach: 'spinach', onin: 'onions',
    lens: 'lentils', lans: 'lentils', len: 'lentils', lentil: 'lentils',
    lental: 'lentils', lentilss: 'lentils',
    egg: 'eggs', mushroom: 'mushrooms', carrot: 'carrots', potato: 'potatoes',
    onion: 'onions', tomato: 'tomatoes', strawberry: 'strawberries',
    blueberry: 'blueberries', almond: 'almonds', peanut: 'peanuts', walnut: 'walnuts',
    bred: 'bread', berad: 'bread', braed: 'bread', bred: 'bread',
    salamon: 'salmon', samon: 'salmon', salamon: 'salmon', samlon: 'salmon',
    tuna: 'tuna', tunna: 'tuna', toona: 'tuna',
    bred: 'bread', avacado: 'avocado', avokado: 'avocado', avocato: 'avocado',
    sweat: 'sweet potato', sweeet: 'sweet potato',
  };
  return map[name] || name;
}

type FoodNutrient = { kcal: number; protein: number; quality: number };
const INTERNAL_FOOD_DATABASE: Record<string, FoodNutrient> = {
  'chicken breast': { kcal: 165, protein: 31, quality: 1.0 },
  'chicken': { kcal: 165, protein: 31, quality: 1.0 },
  'beef steak': { kcal: 271, protein: 26, quality: 1.0 },
  'beef': { kcal: 250, protein: 26, quality: 1.0 },
  'ground beef': { kcal: 250, protein: 26, quality: 1.0 },
  'pork chops': { kcal: 242, protein: 27, quality: 1.0 },
  'pork': { kcal: 242, protein: 27, quality: 1.0 },
  'bacon': { kcal: 541, protein: 37, quality: 1.0 },
  'pork sausage': { kcal: 339, protein: 28, quality: 1.0 },
  'turkey breast': { kcal: 135, protein: 29, quality: 1.0 },
  'turkey': { kcal: 135, protein: 29, quality: 1.0 },
  'ham': { kcal: 145, protein: 26, quality: 1.0 },
  'egg': { kcal: 131, protein: 11, quality: 1.0 },
  'eggs': { kcal: 131, protein: 11, quality: 1.0 },
  'chicken egg': { kcal: 131, protein: 11, quality: 1.0 },
  'whole milk': { kcal: 61, protein: 3.2, quality: 1.0 },
  'milk': { kcal: 61, protein: 3.2, quality: 1.0 },
  'cheddar cheese': { kcal: 403, protein: 23, quality: 1.0 },
  'cheese': { kcal: 403, protein: 23, quality: 1.0 },
  'butter': { kcal: 717, protein: 0.9, quality: 0.6 },
  'plain yogurt': { kcal: 59, protein: 3.5, quality: 1.0 },
  'yogurt': { kcal: 59, protein: 3.5, quality: 1.0 },
  'heavy cream': { kcal: 340, protein: 2.3, quality: 0.6 },
  'cream': { kcal: 340, protein: 2.3, quality: 0.6 },
  'white rice': { kcal: 365, protein: 6.6, quality: 0.6 },
  'rice': { kcal: 365, protein: 6.6, quality: 0.6 },
  'brown rice': { kcal: 367, protein: 7.9, quality: 0.6 },
  'pasta': { kcal: 131, protein: 5, quality: 0.6 },
  'spaghetti': { kcal: 131, protein: 5, quality: 0.6 },
  'egg noodles': { kcal: 138, protein: 5.3, quality: 0.6 },
  'noodles': { kcal: 138, protein: 5.3, quality: 0.6 },
  'white bread': { kcal: 265, protein: 7.6, quality: 0.6 },
  'bread': { kcal: 265, protein: 7.6, quality: 0.6 },
  'whole wheat bread': { kcal: 247, protein: 8.5, quality: 0.6 },
  'rolled oats': { kcal: 389, protein: 17, quality: 0.6 },
  'oats': { kcal: 389, protein: 17, quality: 0.6 },
  'oatmeal': { kcal: 68, protein: 2.4, quality: 0.6 },
  'quinoa': { kcal: 120, protein: 4.4, quality: 0.6 },
  'carrots': { kcal: 41, protein: 0.9, quality: 0.6 },
  'carrot': { kcal: 41, protein: 0.9, quality: 0.6 },
  'potatoes': { kcal: 77, protein: 2.1, quality: 0.6 },
  'potato': { kcal: 77, protein: 2.1, quality: 0.6 },
  'tomatoes': { kcal: 18, protein: 0.9, quality: 0.6 },
  'tomato': { kcal: 18, protein: 0.9, quality: 0.6 },
  'onions': { kcal: 40, protein: 1.1, quality: 0.6 },
  'onion': { kcal: 40, protein: 1.1, quality: 0.6 },
  'mushrooms': { kcal: 22, protein: 3.1, quality: 0.6 },
  'mushroom': { kcal: 22, protein: 3.1, quality: 0.6 },
  'broccoli': { kcal: 34, protein: 2.8, quality: 0.6 },
  'spinach': { kcal: 23, protein: 2.7, quality: 0.6 },
  'lettuce': { kcal: 15, protein: 1.2, quality: 0.6 },
  'cucumber': { kcal: 16, protein: 0.7, quality: 0.6 },
  'bell pepper': { kcal: 31, protein: 1, quality: 0.6 },
  'pepper': { kcal: 31, protein: 1, quality: 0.6 },
  'garlic': { kcal: 149, protein: 6.4, quality: 0.6 },
  'sweet corn': { kcal: 86, protein: 3.3, quality: 0.6 },
  'corn': { kcal: 86, protein: 3.3, quality: 0.6 },
  'green peas': { kcal: 81, protein: 5.4, quality: 0.9 },
  'peas': { kcal: 81, protein: 5.4, quality: 0.9 },
  'black beans': { kcal: 132, protein: 8.9, quality: 0.9 },
  'beans': { kcal: 132, protein: 8.9, quality: 0.9 },
  'lentils': { kcal: 116, protein: 9.0, quality: 0.9 },
  'celery': { kcal: 16, protein: 0.7, quality: 0.6 },
  'zucchini': { kcal: 17, protein: 1.6, quality: 0.6 },
  'butternut squash': { kcal: 45, protein: 1.1, quality: 0.6 },
  'squash': { kcal: 45, protein: 1.1, quality: 0.6 },
  'apple': { kcal: 52, protein: 0.3, quality: 0.6 },
  'banana': { kcal: 89, protein: 1.1, quality: 0.6 },
  'orange': { kcal: 47, protein: 0.9, quality: 0.6 },
  'strawberries': { kcal: 32, protein: 0.8, quality: 0.6 },
  'blueberries': { kcal: 57, protein: 0.7, quality: 0.6 },
  'grapes': { kcal: 67, protein: 0.6, quality: 0.6 },
  'mango': { kcal: 60, protein: 0.8, quality: 0.6 },
  'pineapple': { kcal: 50, protein: 0.5, quality: 0.6 },
  'watermelon': { kcal: 30, protein: 0.6, quality: 0.6 },
  'olive oil': { kcal: 884, protein: 0, quality: 0.6 },
  'vegetable oil': { kcal: 884, protein: 0, quality: 0.6 },
  'oil': { kcal: 884, protein: 0, quality: 0.6 },
  'coconut oil': { kcal: 862, protein: 0, quality: 0.6 },
  'almonds': { kcal: 579, protein: 21, quality: 0.9 },
  'peanuts': { kcal: 567, protein: 26, quality: 0.9 },
  'walnuts': { kcal: 654, protein: 9, quality: 0.9 },
};

function lookupInternalDatabase(ingredient: string): FoodNutrient | null {
  const normalized = ingredient.toLowerCase().trim();
  if (INTERNAL_FOOD_DATABASE[normalized] !== undefined) return INTERNAL_FOOD_DATABASE[normalized];
  const singular = normalized.endsWith('s') ? normalized.slice(0, -1) : normalized;
  if (INTERNAL_FOOD_DATABASE[singular] !== undefined) return INTERNAL_FOOD_DATABASE[singular];
  const plural = normalized + 's';
  if (INTERNAL_FOOD_DATABASE[plural] !== undefined) return INTERNAL_FOOD_DATABASE[plural];
  for (const [key, value] of Object.entries(INTERNAL_FOOD_DATABASE)) {
    if (normalized.includes(key) || key.includes(normalized)) return value;
  }
  return null;
}

function isValidKcal(kcal: number): boolean {
  return typeof kcal === 'number' && !isNaN(kcal) && kcal > 0 && kcal <= 900;
}

const USDA_API_URL = 'https://fdc.nal.usda.gov/portal-bit/api';
const BRAND_INDICATORS = ['inc','corp','llc','ltd','co.','company','brand','organic','natural','classic','original','kroger','walmart','target','costco','whole foods','great value','simple truth','market pantry'];
const PROCESSED_INDICATORS = ['with','added','enriched','flavored','sweetened','ready-to-eat','prepared','canned','packaged','microwaveable','instant','quick','pre-cooked','seasoned','marinated','breaded','battered','sauce','glazed','coated','stuffed'];

function isBrandedOrProcessed(description: string): boolean {
  const desc = description.toLowerCase();
  return BRAND_INDICATORS.some(b => desc.includes(b)) || PROCESSED_INDICATORS.some(p => desc.includes(p));
}

function scoreUSDAFood(description: string, query: string, dataType: string): number {
  const desc = description.toLowerCase();
  const queryLower = query.toLowerCase();
  let score = 0;
  const descWords = desc.split(/\s+/);
  const queryWords = queryLower.split(/\s+/);
  if (descWords[0] === queryWords[0]) score += 15;
  else if (descWords.some(w => queryWords.includes(w))) score += 8;
  if (desc.includes(queryLower)) score += 10;
  if (dataType === 'Foundation') score += 20;
  if (dataType === 'SR Legacy') score += 15;
  if (dataType === 'Survey (FNDDS)') score += 10;
  if (desc.includes('raw')) score += 12;
  if (desc.includes('fresh')) score += 10;
  if (descWords.length <= 3) score += 8;
  else if (descWords.length <= 5) score += 4;
  else if (descWords.length > 8) score -= 5;
  if (dataType === 'Branded') score -= 15;
  if (isBrandedOrProcessed(desc)) score -= 10;
  return score;
}

type NutritionResult = { kcal: number; protein: number } | null;

async function fetchFromUSDA(query: string): Promise<NutritionResult> {
  try {
    const url = `${USDA_API_URL}/foodsearch?api_key=DEMO_KEY&query=${encodeURIComponent(query)}&pageSize=15&pageNumber=1`;
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!res.ok) return null;
    const data = await res.json();
    const foods = data.foods as Array<{ description: string; fdcId: number; foodNutrients: Array<{ nutrientName: string; value: number; unitName: string }>; dataType: string }>;
    if (!foods || foods.length === 0) return null;
    const scored = foods.map(food => {
      const score = scoreUSDAFood(food.description, query, food.dataType);
      const energyNutrient = food.foodNutrients?.find(n => n.nutrientName?.toLowerCase().includes('energy') && !n.nutrientName?.toLowerCase().includes('atwater'));
      const kcal = energyNutrient && typeof energyNutrient.value === 'number' ? Math.round(energyNutrient.value) : null;
      const proteinNutrient = food.foodNutrients?.find(n => n.nutrientName?.toLowerCase().includes('protein') && !n.nutrientName?.toLowerCase().includes('atwater'));
      const protein = proteinNutrient && typeof proteinNutrient.value === 'number' ? Math.round(proteinNutrient.value * 10) / 10 : 0;
      return { kcal, protein, score };
    }).filter(s => s.kcal !== null && isValidKcal(s.kcal!)).sort((a, b) => b.score - a.score);
    if (scored.length > 0 && scored[0].score >= 10) return { kcal: scored[0].kcal!, protein: scored[0].protein };
    return null;
  } catch { return null; }
}

function extractKcalFromOFF(product: Record<string, unknown>): number | null {
  const nutriments = product.nutriments as Record<string, unknown> | undefined;
  if (!nutriments) return null;
  const kcal = nutriments['energy-kcal_100g'] ?? nutriments['energy-kcal'] ?? nutriments['energy_100g'];
  if (typeof kcal === 'number' && kcal > 0) return Math.round(kcal);
  const kj = nutriments['energy-kj_100g'] ?? nutriments['energy-kj'];
  if (typeof kj === 'number' && kj > 0) return Math.round(kj / 4.184);
  return null;
}

function extractProteinFromOFF(product: Record<string, unknown>): number {
  const nutriments = product.nutriments as Record<string, unknown> | undefined;
  if (!nutriments) return 0;
  const protein = nutriments['proteins_100g'] ?? nutriments['proteins'];
  if (typeof protein === 'number' && protein >= 0) return Math.round(protein * 10) / 10;
  return 0;
}

function scoreOFFProduct(productName: string, categories: string, query: string): number {
  const nameLower = productName.toLowerCase();
  const queryLower = query.toLowerCase();
  let score = 0;
  const nameWords = nameLower.split(/\s+/);
  const queryWords = queryLower.split(/\s+/);
  if (nameWords[0] === queryWords[0]) score += 12;
  else if (nameWords.some(w => queryWords.includes(w))) score += 6;
  if (nameLower.includes(queryLower)) score += 8;
  const catLower = categories.toLowerCase();
  if (catLower.includes('fresh')) score += 8;
  if (catLower.includes('raw')) score += 6;
  if (catLower.includes('vegetable') || catLower.includes('fruit')) score += 5;
  if (nameWords.length <= 3) score += 5;
  else if (nameWords.length > 6) score -= 3;
  if (isBrandedOrProcessed(nameLower)) score -= 8;
  return score;
}

async function fetchFromOpenFoodFacts(query: string): Promise<NutritionResult> {
  try {
    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&json=1&page_size=15&page=1`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const products = (data.products ?? []) as Record<string, unknown>[];
    const scored = products.map(p => {
      const productName = String(p.product_name ?? '');
      const categories = String(p.categories ?? '');
      const score = scoreOFFProduct(productName, categories, query);
      const kcal = extractKcalFromOFF(p);
      const protein = extractProteinFromOFF(p);
      return { score, kcal, protein };
    }).filter(s => s.kcal !== null && isValidKcal(s.kcal!)).sort((a, b) => b.score - a.score);
    if (scored.length > 0 && scored[0].score >= 10) return { kcal: scored[0].kcal!, protein: scored[0].protein };
    return null;
  } catch { return null; }
}

async function fetchNutrition(query: string): Promise<NutritionResult> {
  const internalResult = lookupInternalDatabase(query);
  if (internalResult !== null && isValidKcal(internalResult.kcal)) return { kcal: internalResult.kcal, protein: internalResult.protein };
  const usdaResult = await fetchFromUSDA(query);
  if (usdaResult !== null && isValidKcal(usdaResult.kcal)) return usdaResult;
  const offResult = await fetchFromOpenFoodFacts(query);
  if (offResult !== null && isValidKcal(offResult.kcal)) return offResult;
  return null;
}

function kcalForIngredient(ing: Ingredient): number | null {
  if (ing.kcalPer100g === null) return null;
  return Math.round((ing.kcalPer100g * ing.grams) / 100);
}

function proteinForIngredient(ing: Ingredient): number | null {
  if (ing.kcalPer100g === null) return null;
  if (ing.proteinPer100g === null || ing.proteinPer100g === 0) return 0;
  return (ing.proteinPer100g * ing.grams) / 100;
}

function calculateMuscleGainScore(totalCalories: number, totalProtein: number, avgProteinQuality: number): number {
  if (totalCalories === 0) return 0;
  const proteinRatio = (totalProtein / totalCalories) * 1000;
  return Math.round(Math.min(proteinRatio * avgProteinQuality, 100));
}

function generateDietRecommendation(totalCalories: number, totalProtein: number, muscleGainScore: number, avgHealthScore: number): string {
  if (totalCalories === 0) return 'Add ingredients to get recommendations.';
  const proteinPercentage = (totalProtein / totalCalories) * 100;
  if (proteinPercentage >= 25 && muscleGainScore >= 70) return 'Muscle Gain Meal: High protein supports muscle growth and recovery.';
  if (totalCalories < 700 && proteinPercentage >= 20 && avgHealthScore >= 7) return 'Fat Loss Meal: High satiety, supports fat loss while preserving muscle.';
  if (proteinPercentage >= 15 && proteinPercentage < 25 && avgHealthScore >= 7) return 'Balanced Meal: Good nutrient balance for general health and maintenance.';
  if (avgHealthScore < 6) return 'Low Nutritional Quality: Improve with whole foods, protein, and fiber.';
  return 'Mixed Meal: Consider increasing protein or whole foods.';
}

function PasswordGate({ onUnlock }: { onUnlock: () => void }) {
  const [input, setInput] = useState('');
  const [error, setError] = useState(false);
  const CORRECT_PASSWORD = 'nutri2024';

  const handleSubmit = () => {
    if (input === CORRECT_PASSWORD) {
      onUnlock();
    } else {
      setError(true);
      setTimeout(() => setError(false), 2000);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm text-center">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">NutriCalc Pro</h1>
        <p className="text-gray-500 text-sm mb-6">Enter your access password</p>
        <input
          type="password"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          placeholder="Password"
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-emerald-400"
        />
        {error && <p className="text-red-400 text-xs mb-2">Incorrect password. Try again.</p>}
        <button
          onClick={handleSubmit}
          className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 rounded-xl transition-colors"
        >
          Access App
        </button>
      </div>
    </div>
  );
}
export default function App() {
  const [ingredients, setIngredients] = useState<Ingredient[]>(() => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const saved = localStorage.getItem('ingredients');
    return saved ? JSON.parse(saved) : [];
  });
  const [inputName, setInputName] = useState('');
  const [inputGrams, setInputGrams] = useState('');
  const [inputKcal, setInputKcal] = useState('');
  const [target, setTarget] = useState(() => getUserCalorieTarget());
  const [editingTarget, setEditingTarget] = useState(false);
  const [tempTarget, setTempTarget] = useState(String(getUserCalorieTarget()));
  const [userWeight, setUserWeight] = useState<number | null>(() => {
    const saved = localStorage.getItem('user_weight');
    return saved ? parseFloat(saved) : null;
  });
  const [editingWeight, setEditingWeight] = useState(false);
  const [tempWeight, setTempWeight] = useState('');

  const addIngredient = useCallback(async () => {
    const rawName = inputName.trim();
    if (!rawName || !inputGrams) return;
    const grams = parseFloat(inputGrams);
    if (isNaN(grams) || grams <= 0) return;
    const correctedName = resolveIngredient(rawName);
    const wasCorrected = correctedName !== rawName.toLowerCase().trim();
    const manualKcal = inputKcal !== '' ? parseFloat(inputKcal) : null;
    const hasManual = manualKcal !== null && !isNaN(manualKcal) && manualKcal >= 0;
    const id = generateId();
    const newIng: Ingredient = { id, name: correctedName, originalName: wasCorrected ? rawName : undefined, grams, kcalPer100g: hasManual ? manualKcal : null, proteinPer100g: null, status: hasManual ? 'found' : 'loading' };
    setIngredients(prev => {
      const updated = [...prev, newIng];
      localStorage.setItem('ingredients', JSON.stringify(updated));
      return updated;
    });
    setInputName(''); setInputGrams(''); setInputKcal('');
    if (!hasManual) {
      const internalData = lookupInternalDatabase(correctedName);
      if (internalData) {
        setIngredients(prev => prev.map(ing => ing.id === id ? { ...ing, kcalPer100g: internalData.kcal, proteinPer100g: internalData.protein, status: 'found' } : ing));
      } else {
        const result = await fetchNutrition(correctedName);
        setIngredients(prev => prev.map(ing => ing.id === id ? { ...ing, kcalPer100g: result !== null ? result.kcal : null, proteinPer100g: result !== null ? result.protein : 0, status: result !== null ? 'found' : 'not_found' } : ing));
      }
    }
  }, [inputName, inputGrams, inputKcal]);

  const removeIngredient = (id: string) => setIngredients(prev => {
    const updated = prev.filter(ing => ing.id !== id);
    localStorage.setItem('ingredients', JSON.stringify(updated));
    return updated;
  });
  const updateGrams = (id: string, val: string) => { const g = parseFloat(val); if (!isNaN(g) && g >= 0) setIngredients(prev => prev.map(ing => ing.id === id ? { ...ing, grams: g } : ing)); };
  const updateKcal = (id: string, val: string) => { const k = val === '' ? null : parseFloat(val); setIngredients(prev => prev.map(ing => ing.id === id ? { ...ing, kcalPer100g: k !== null && !isNaN(k) ? k : null, status: val !== '' ? 'found' : ing.status } : ing)); };

  const totalKcal = ingredients.reduce((sum, ing) => sum + (kcalForIngredient(ing) ?? 0), 0);
  const totalProtein = ingredients.reduce((sum, ing) => sum + (proteinForIngredient(ing) ?? 0), 0);

  let avgProteinQuality = 0.8;
  let proteinCount = 0;
  ingredients.forEach(ing => {
    if (ing.proteinPer100g !== null && ing.proteinPer100g > 0) {
      const internalData = lookupInternalDatabase(ing.name);
      const quality = internalData?.quality ?? 0.8;
      avgProteinQuality = (avgProteinQuality * proteinCount + quality) / (proteinCount + 1);
      proteinCount++;
    }
  });

  const muscleGainScore = calculateMuscleGainScore(totalKcal, totalProtein, avgProteinQuality);
  const dietRecommendation = generateDietRecommendation(totalKcal, totalProtein, muscleGainScore, 7);
  const coachTargets = nutritionCoach.dailyTargets(userWeight, target, getUserProteinMultiplier());
  const coachProgress = nutritionCoach.progress(totalKcal, totalProtein, coachTargets);
  const aiInsight = nutritionCoach.insight({ calories: totalKcal, protein: totalProtein, proteinProgress: coachProgress.proteinProgress, calorieProgress: coachProgress.calorieProgress, muscleGainScore, calorieTarget: target });
  const pct = Math.min(Math.round((totalKcal / target) * 100), 999);
  const isOver = totalKcal > target;

  const handleTargetSave = () => { const t = parseInt(tempTarget); if (!isNaN(t) && t > 500) { setTarget(t); setUserCalorieTarget(t); } setEditingTarget(false); };
  const handleWeightSave = () => { const w = parseFloat(tempWeight); if (!isNaN(w) && w > 0) { setUserWeight(w); localStorage.setItem('user_weight', String(w)); } setEditingWeight(false); };
  if (!isAuthenticated) return <PasswordGate onUnlock={() => setIsAuthenticated(true)} />;

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ChefHat className="text-emerald-500" size={26} />
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">NutriCalc Pro</h1>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Target size={15} className="text-emerald-500" />
            {editingTarget ? (
              <form onSubmit={e => { e.preventDefault(); handleTargetSave(); }} className="flex items-center gap-1">
                <input autoFocus type="number" min={1} value={tempTarget} onChange={e => setTempTarget(e.target.value)} onBlur={handleTargetSave} className="w-20 border border-emerald-400 rounded px-2 py-0.5 text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-emerald-400" />
                <span className="text-gray-400">kcal goal</span>
              </form>
            ) : (
              <button onClick={() => { setTempTarget(String(target)); setEditingTarget(true); }} className="hover:text-emerald-600 transition-colors" title="Click to edit calorie goal">
                <span className="font-semibold text-gray-700">{target.toLocaleString()}</span> kcal goal
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Add Ingredient</h2>
          <div className="flex flex-col sm:flex-row gap-3">
            <input type="text" placeholder="Ingredient name" value={inputName} onChange={e => setInputName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addIngredient()} className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition" />
            <input type="number" placeholder="Grams" min={0} value={inputGrams} onChange={e => setInputGrams(e.target.value)} onKeyDown={e => e.key === 'Enter' && addIngredient()} className="w-full sm:w-28 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition" />
            <input type="number" placeholder="kcal/100g (opt)" min={0} value={inputKcal} onChange={e => setInputKcal(e.target.value)} onKeyDown={e => e.key === 'Enter' && addIngredient()} className="w-full sm:w-36 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition" />
            <button onClick={addIngredient} disabled={!inputName.trim() || !inputGrams} className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors duration-150 whitespace-nowrap">
              <Plus size={16} /> Add
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-400">Leave kcal/100g empty to auto-fetch from USDA FoodData Central.</p>
        </section>

        {ingredients.length > 0 && (
          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Ingredients</h2>
            </div>
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left text-xs text-gray-400 uppercase tracking-wider">
                    <th className="px-5 py-3 font-medium">Ingredient</th>
                    <th className="px-3 py-3 font-medium">Grams</th>
                    <th className="px-3 py-3 font-medium">kcal/100g</th>
                    <th className="px-3 py-3 font-medium">Calories</th>
                    <th className="px-3 py-3 font-medium">protein/100g</th>
                    <th className="px-3 py-3 font-medium">Protein</th>
                    <th className="px-3 py-3 font-medium w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {ingredients.map(ing => {
                    const cal = kcalForIngredient(ing);
                    const prot = proteinForIngredient(ing);
                    return (
                      <tr key={ing.id} className="hover:bg-gray-50/60 transition-colors">
                        <td className="px-5 py-3 font-medium text-gray-800 capitalize">{ing.name}{ing.originalName && <span className="ml-1.5 text-[10px] font-normal text-teal-500 bg-teal-50 px-1.5 py-0.5 rounded-full">auto-corrected</span>}</td>
                        <td className="px-3 py-3"><input type="number" min={0} value={ing.grams} onChange={e => updateGrams(ing.id, e.target.value)} className="w-20 border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400" /></td>
                        <td className="px-3 py-3">{ing.status === 'loading' ? <span className="flex items-center gap-1 text-gray-400"><Loader2 size={13} className="animate-spin" /> fetching…</span> : <input type="number" min={0} value={ing.kcalPer100g ?? ''} placeholder={ing.status === 'not_found' ? 'unknown' : ''} onChange={e => updateKcal(ing.id, e.target.value)} className={`w-24 border rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400 ${ing.status === 'not_found' ? 'border-amber-200 bg-amber-50 placeholder-amber-400' : 'border-gray-200'}`} />}</td>
                        <td className="px-3 py-3">{ing.status === 'loading' ? <span className="text-gray-300">—</span> : cal !== null ? <span className="font-semibold text-emerald-600">{cal} kcal</span> : <span className="text-amber-500 text-xs font-medium">unknown</span>}</td>
                        <td className="px-3 py-3"><span className="text-sm text-gray-600">{ing.status === 'loading' ? '...' : (ing.proteinPer100g ?? 0)}g</span></td>
                        <td className="px-3 py-3">{ing.status === 'loading' ? <span className="text-gray-300 text-xs">...</span> : prot !== null ? <span className="font-semibold text-blue-600">{prot.toFixed(1)}g</span> : <span className="text-gray-300 text-xs">—</span>}</td>
                        <td className="px-3 py-3"><button onClick={() => removeIngredient(ing.id)} className="text-gray-300 hover:text-red-400 transition-colors"><Trash2 size={15} /></button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="sm:hidden divide-y divide-gray-100">
              {ingredients.map(ing => {
                const cal = kcalForIngredient(ing);
                const prot = proteinForIngredient(ing);
                return (
                  <div key={ing.id} className="p-4 space-y-2">
                    <div className="flex items-start justify-between">
                      <span className="font-semibold text-gray-800 capitalize text-sm">{ing.name}{ing.originalName && <span className="ml-1 text-[10px] font-normal text-teal-500 bg-teal-50 px-1.5 py-0.5 rounded-full">auto-corrected</span>}</span>
                      <button onClick={() => removeIngredient(ing.id)} className="text-gray-300 hover:text-red-400 transition-colors ml-2"><Trash2 size={15} /></button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div><p className="text-gray-400 mb-1">Grams</p><input type="number" min={0} value={ing.grams} onChange={e => updateGrams(ing.id, e.target.value)} className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400" /></div>
                      <div><p className="text-gray-400 mb-1">kcal/100g</p>{ing.status === 'loading' ? <span className="flex items-center gap-1 text-gray-400 pt-1"><Loader2 size={12} className="animate-spin" /> …</span> : <input type="number" min={0} value={ing.kcalPer100g ?? ''} placeholder={ing.status === 'not_found' ? 'unknown' : ''} onChange={e => updateKcal(ing.id, e.target.value)} className={`w-full border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400 ${ing.status === 'not_found' ? 'border-amber-200 bg-amber-50 placeholder-amber-400' : 'border-gray-200'}`} />}</div>
                      <div><p className="text-gray-400 mb-1">Calories</p><p className="pt-1 font-semibold">{ing.status === 'loading' ? <span className="text-gray-300">—</span> : cal !== null ? <span className="text-emerald-600">{cal} kcal</span> : <span className="text-amber-500 text-xs">unknown</span>}</p></div>
                      <div><p className="text-gray-400 mb-1">Protein</p><p className="pt-1 font-semibold">{ing.status === 'loading' ? <span className="text-gray-300 text-xs">...</span> : prot !== null ? <span className="text-blue-600">{prot.toFixed(1)}g</span> : <span className="text-gray-300 text-xs">—</span>}</p></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Summary</h2>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><Flame size={20} className={isOver ? 'text-red-400' : 'text-emerald-500'} /><span className="text-gray-600 text-sm">Total calories</span></div>
            <span className={`text-2xl font-bold ${isOver ? 'text-red-500' : 'text-emerald-600'}`}>{totalKcal.toLocaleString()} <span className="text-base font-normal text-gray-400">kcal</span></span>
          </div>
          <div>
            <div className="flex justify-between text-xs text-gray-400 mb-1.5"><span>{pct}% of daily goal</span><span>{Math.max(target - totalKcal, 0).toLocaleString()} kcal remaining</span></div>
            <div className="h-3 rounded-full bg-gray-100 overflow-hidden"><div className={`h-full rounded-full transition-all duration-500 ${isOver ? 'bg-red-400' : pct > 80 ? 'bg-amber-400' : 'bg-emerald-400'}`} style={{ width: `${Math.min(pct, 100)}%` }} /></div>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <div className="flex items-center gap-2"><Target size={20} className="text-blue-500" /><span className="text-gray-600 text-sm">Total protein</span></div>
            <span className="text-2xl font-bold text-blue-600">{totalProtein.toFixed(1)} <span className="text-base font-normal text-gray-400">g</span></span>
          </div>
          <div>
            <div className="flex justify-between text-xs text-gray-400 mb-1.5"><span>{Math.round(coachProgress.proteinProgress)}% of target</span><span>{Math.max(coachTargets.proteinTarget - totalProtein, 0).toFixed(1)}g remaining</span></div>
            <div className="h-3 rounded-full bg-gray-100 overflow-hidden"><div className={`h-full rounded-full transition-all duration-500 ${coachProgress.proteinProgress > 100 ? 'bg-blue-400' : coachProgress.proteinProgress > 80 ? 'bg-amber-400' : 'bg-blue-300'}`} style={{ width: `${Math.min(coachProgress.proteinProgress, 100)}%` }} /></div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
            <Stat label="Cal Target" value={`${target.toLocaleString()} kcal`} />
            <Stat label="Cal Remaining" value={isOver ? `+${(totalKcal - target).toLocaleString()}` : `${(target - totalKcal).toLocaleString()}`} highlight={isOver ? 'red' : 'green'} />
            <Stat label="Protein Target" value={`${coachTargets.proteinTarget}g`} />
            <Stat label="Ingredients" value={String(ingredients.length)} />
          </div>
          {isOver && <p className="text-xs text-red-400 bg-red-50 rounded-xl px-4 py-2.5">You have exceeded your daily calorie goal by {(totalKcal - target).toLocaleString()} kcal.</p>}
        </section>

        {ingredients.length > 0 && (
          <section className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-2xl shadow-sm border border-blue-100 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-blue-700 uppercase tracking-wider">AI Nutrition Coach</h2>
            <p className="text-sm text-blue-900 leading-relaxed">{aiInsight}</p>
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Protein Target" value={`${coachTargets.proteinTarget}g`} />
              <Stat label="Protein Progress" value={`${Math.round(coachProgress.proteinProgress)}%`} highlight={coachProgress.proteinProgress >= 80 ? 'green' : undefined} />
              <Stat label="Daily Calorie Target" value={`${coachTargets.calorieTarget.toLocaleString()} kcal`} />
              <Stat label="Calorie Progress" value={`${Math.round(coachProgress.calorieProgress)}%`} highlight={coachProgress.calorieProgress > 100 ? 'red' : undefined} />
            </div>
            {!userWeight && <button onClick={() => setEditingWeight(true)} className="w-full text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-2 rounded-lg font-medium transition-colors">+ Set Your Weight for Personalized Targets</button>}
            {editingWeight && (
              <form onSubmit={e => { e.preventDefault(); handleWeightSave(); }} className="flex gap-2 items-center">
                <input type="number" value={tempWeight} onChange={e => setTempWeight(e.target.value)} placeholder="Weight (kg)" className="flex-1 px-3 py-2 text-sm border border-blue-200 rounded-lg" autoFocus />
                <button type="submit" className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">Save</button>
                <button type="button" onClick={() => setEditingWeight(false)} className="px-3 py-2 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">Cancel</button>
              </form>
            )}
            {userWeight && <p className="text-xs text-blue-600 bg-blue-100 rounded-lg px-3 py-2">Targets calculated for {userWeight}kg • <button onClick={() => setEditingWeight(true)} className="underline hover:font-semibold">Edit</button></p>}
          </section>
        )}

        {ingredients.length === 0 && (
          <div className="text-center py-16 text-gray-300">
            <ChefHat size={48} className="mx-auto mb-3 opacity-50" />
            <p className="text-base font-medium text-gray-400">No ingredients yet</p>
            <p className="text-sm text-gray-300 mt-1">Add your first ingredient above to get started.</p>
          </div>
        )}
      </main>

      <footer className="text-center text-xs text-gray-300 py-8">
        Nutrition data from <span className="text-gray-400">USDA FoodData Central</span> &amp; OpenFoodFacts
      </footer>
    </div>
  );
}
function Stat({ label, value, highlight }: { label: string; value: string; highlight?: 'red' | 'green' }) {
  return (
    <div className="bg-gray-50 rounded-xl px-4 py-3">
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className={`font-semibold text-sm ${highlight === 'red' ? 'text-red-500' : highlight === 'green' ? 'text-emerald-600' : 'text-gray-700'}`}>{value}</p>
    </div>
  );
}
