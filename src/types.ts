export type TransactionType = "expense" | "income" | "transfer";

export interface Account {
  id: string;
  name: string;
  currency: string;
  type: "cash" | "card";
  color: string;
  openingBalance: number;
  currentBalance?: number;
}

export interface Category {
  id: string;
  name: string;
  type: "expense" | "income" | "mixed";
  icon: string;
  color: string;
}

export interface Transaction {
  id: string;
  date: string;
  type: TransactionType;
  categoryId: string;
  categoryName: string;
  originalCategoryName?: string;
  payee?: string;
  comment?: string;
  fromAccount: string;
  fromAmount: number;
  fromCurrency: string;
  toAccount: string;
  toAmount: number;
  toCurrency: string;
  createdAt: string;
  updatedAt?: string;
  tags?: string[];
  location?: string;
  repeat?: boolean;
}

export interface Budget {
  id: string;
  categoryId: string;
  limit: number;
  currency?: string;
  items?: BudgetItem[];
}

export interface BudgetItem {
  id: string;
  name: string;
  amount: number;
  completed: boolean;
  transactionId?: string;
}

export interface SavingsGoal {
  id: string;
  name: string;
  balance: number;
  target?: number;
  color: string;
  icon: string;
  createdAt: string;
}

export interface AppData {
  version: number;
  generatedAt: string;
  updatedAt?: string;
  profile: { name: string; currency: string; locale: string };
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  budgets: Budget[];
  savingsGoals: SavingsGoal[];
}

export type Route =
  | "overview"
  | "transactions"
  | "budgets"
  | "savings"
  | "categories"
  | "analytics"
  | "accounts"
  | "settings";
