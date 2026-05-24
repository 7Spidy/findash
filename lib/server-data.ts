/**
 * Server-only data loader. Never import this from client components.
 * Uses `fs` to read JSON directly from disk — fast, no HTTP round-trip.
 */
import fs from "fs";
import path from "path";
import type { Transaction, AccountsData, CreditCardsData, InsightsData, LastUpdated } from "@/types";

function readDataFile<T>(filename: string): T {
  const filePath = path.join(process.cwd(), "public", "data", filename);
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as T;
}

export function getTransactions(): Transaction[] {
  return readDataFile<Transaction[]>("transactions.json");
}

export function getAccountsData(): AccountsData {
  return readDataFile<AccountsData>("accounts.json");
}

export function getCreditCardsData(): CreditCardsData {
  return readDataFile<CreditCardsData>("credit_cards.json");
}

export function getInsightsData(): InsightsData {
  return readDataFile<InsightsData>("insights.json");
}

export function getLastUpdated(): LastUpdated {
  return readDataFile<LastUpdated>("last_updated.json");
}
