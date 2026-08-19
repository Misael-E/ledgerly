import type { Transaction } from "./types";
import { uuid, isoNow, fp } from "./helpers";

interface ParsedRow {
  date: string;
  merchant: string;
  amount: number;
  type: "expense" | "income";
}

export type BankFormat = "scotiabank" | "bmo" | "amex" | "neo" | "cibc";

export async function parsePDF(file: File): Promise<string[]> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const pages: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const lines: { y: number; x: number; text: string }[] = [];

    for (const item of content.items) {
      if ("str" in item && item.str.trim()) {
        const tx = item.transform;
        lines.push({ y: Math.round(tx[5]), x: Math.round(tx[4]), text: item.str.trim() });
      }
    }

    // Group by Y position (same line), sort by X
    const grouped: Record<number, { x: number; text: string }[]> = {};
    for (const l of lines) {
      const key = l.y;
      // Merge items within 3px of each other vertically
      const existing = Object.keys(grouped).find((k) => Math.abs(Number(k) - key) <= 3);
      const gKey = existing ? Number(existing) : key;
      if (!grouped[gKey]) grouped[gKey] = [];
      grouped[gKey].push({ x: l.x, text: l.text });
    }

    const sorted = Object.entries(grouped)
      .sort(([a], [b]) => Number(b) - Number(a)) // PDF coords: top = higher Y
      .map(([, items]) =>
        items.sort((a, b) => a.x - b.x).map((i) => i.text).join("  ")
      );

    pages.push(sorted.join("\n"));
  }

  return pages;
}

const DATE_RE = /^(\d{4}[-/]\d{2}[-/]\d{2}|\w{3}\s+\d{1,2},?\s*\d{4}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/;
const AMOUNT_RE = /\$?([\d,]+\.\d{2})/;

function parseDate(raw: string, year?: number): string | null {
  const cleaned = raw.replace(/,/g, "").trim();
  let d = new Date(cleaned);
  if (isNaN(d.getTime())) {
    // Try Mon DD format (no year)
    const match = cleaned.match(/^(\w{3})\s+(\d{1,2})$/);
    if (match && year) {
      d = new Date(`${match[1]} ${match[2]}, ${year}`);
    }
  }
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function extractYear(pages: string[]): number {
  const text = pages.join("\n");
  const match = text.match(/(?:statement\s+(?:date|period)|as\s+of|ending|through)[:\s]*.*?(\d{4})/i)
    || text.match(/(\d{4})/);
  return match ? parseInt(match[1]) : new Date().getFullYear();
}

// --- Scotiabank PDF (credit card) ---
// Format: REF#  TransDate  PostDate  MERCHANT LOCATION PROV  AMOUNT
// e.g. "001  Jun 15  Jun 16  REAL CDN SUPERSTORE #1  CALGARY  AB  32.55"
// Credits have trailing minus: "902.99-"
// Lines may have icon prefixes (scissors, clock symbols) before ref#
function parseScotiabank(pages: string[]): ParsedRow[] {
  const rows: ParsedRow[] = [];
  const year = extractYear(pages);
  const lines = pages.join("\n").split("\n");

  const skipPatterns = /^(statement|scotiabank|account|page|trans|ref|mr\s|ms\s|mrs\s|sub-total|information|review|scene|points|borrower|continued|please|payment|credit\s+limit|available|interest|annual|estimate|previous|new\s+balance|total\s+minimum|due\s+this)/i;

  for (const line of lines) {
    if (skipPatterns.test(line.trim())) continue;

    // Match: optional ref# then two short dates "Mon DD  Mon DD  rest"
    // Ref# can be like "001", "013", etc. with optional icon chars
    const match = line.match(/^\D{0,4}(\d{3})\s+(\w{3}\s+\d{1,2})\s+(\w{3}\s+\d{1,2})\s{2,}(.+)/);
    if (!match) continue;

    // Use transaction date (first date)
    const date = parseDate(match[2], year);
    if (!date) continue;

    const rest = match[4];

    // Find amount at end (may have trailing minus for credits)
    const amtMatch = rest.match(/([\d,]+\.\d{2})(-?)\s*$/);
    if (!amtMatch) continue;

    const amount = parseFloat(amtMatch[1].replace(/,/g, ""));
    if (amount === 0) continue;

    const isCredit = amtMatch[2] === "-";

    // Merchant is everything before the amount
    const merchant = rest.slice(0, rest.lastIndexOf(amtMatch[0])).replace(/\s{2,}/g, " ").trim();
    if (!merchant || merchant.length < 2) continue;

    rows.push({
      date,
      merchant,
      amount,
      type: isCredit ? "income" : "expense",
    });
  }
  return rows;
}

// --- BMO PDF (chequing/banking AND credit card) ---
// Chequing format: Date  Description  AmtDeducted  AmtAdded  Balance
// Credit card format: "Mon. DD Mon. DD  MERCHANT LOCATION PROV  AMOUNT [CR]"
// Detect credit card by presence of abbreviated months with periods (Jun. 18)
function parseBMO(pages: string[]): ParsedRow[] {
  const text = pages.join("\n");
  const isCreditCard = /\w{3}\.\s+\d{1,2}\s+\w{3}\.\s+\d{1,2}\s{2,}/.test(text);
  return isCreditCard ? parseBMOCreditCard(pages) : parseBMOChequing(pages);
}

function parseBMOCreditCard(pages: string[]): ParsedRow[] {
  const rows: ParsedRow[] = [];
  const year = extractYear(pages);
  const lines = pages.join("\n").split("\n");

  const skipPatterns = /^(bmo|summary|card\s+number|previous|payment|total|new\s+install|cash\s+advance|fee|minimum|include|your\s|balance|credit\s+limit|available|reward|point|important|interest|we\s|if\s|page\s|get\s|effective)/i;

  for (const line of lines) {
    if (skipPatterns.test(line.trim())) continue;

    // "Mon. DD Mon. DD  MERCHANT..."  or  "Mon. DD  Mon. DD  MERCHANT..."
    const match = line.match(/^(\w{3}\.?\s+\d{1,2})\s+(\w{3}\.?\s+\d{1,2})\s{2,}(.+)/);
    if (!match) continue;

    const date = parseDate(match[1].replace(".", ""), year);
    if (!date) continue;

    const rest = match[3];

    const amtMatch = rest.match(/([\d,]+\.\d{2})\s*(CR)?\s*$/);
    if (!amtMatch) continue;

    const amount = parseFloat(amtMatch[1].replace(/,/g, ""));
    if (amount === 0) continue;

    const isCredit = !!amtMatch[2];
    const merchant = rest.slice(0, rest.lastIndexOf(amtMatch[0])).replace(/\s{2,}/g, " ").trim();
    if (!merchant || merchant.length < 2) continue;

    rows.push({ date, merchant, amount, type: isCredit ? "income" : "expense" });
  }
  return rows;
}

function parseBMOChequing(pages: string[]): ParsedRow[] {
  const rows: ParsedRow[] = [];
  const year = extractYear(pages);
  const lines = pages.join("\n").split("\n");

  const skipPatterns = /^(your\s|for\s+the|summary|account|opening|closing|date\s|description|amounts|balance|primary|owner|page\s|bmo|continued|here|please|registration|gst|qst|get\s+your|effective|important|as\s+part|if\s+there|alternatively|to\s+help|changes|we\s+are|current|revised|verification|\d{5}e)/i;

  for (const line of lines) {
    if (skipPatterns.test(line.trim())) continue;

    const dateMatch = line.match(/^(\w{3}\s+\d{1,2})\s{2,}(.+)/i);
    if (!dateMatch) continue;

    const date = parseDate(dateMatch[1], year);
    if (!date) continue;

    const rest = dateMatch[2];

    if (/^(opening\s+balance|closing\s+total)/i.test(rest)) continue;

    const amounts: { value: number; index: number }[] = [];
    const amtRe = /([\d,]+\.\d{2})/g;
    let m;
    while ((m = amtRe.exec(rest)) !== null) {
      amounts.push({ value: parseFloat(m[1].replace(/,/g, "")), index: m.index });
    }

    if (amounts.length < 2) continue;

    const merchant = rest.slice(0, amounts[0].index).replace(/\s{2,}/g, " ").trim();
    if (!merchant || merchant.length < 2) continue;

    const isIncome = /deposit|received|added|cancelled|refund/i.test(merchant);

    let txAmount: number;
    let type: "expense" | "income";

    if (amounts.length >= 3) {
      const deducted = amounts[0].value;
      const added = amounts[1].value;
      if (deducted > 0 && added === 0) {
        txAmount = deducted; type = "expense";
      } else if (added > 0 && deducted === 0) {
        txAmount = added; type = "income";
      } else {
        txAmount = amounts[0].value;
        type = isIncome ? "income" : "expense";
      }
    } else {
      txAmount = amounts[0].value;
      type = isIncome ? "income" : "expense";
    }

    if (txAmount === 0) continue;

    rows.push({ date, merchant, amount: txAmount, type });
  }
  return rows;
}

// --- Amex PDF ---
// Format: TransDate  PostDate  Description  Location  Amount
// Two short dates (Mon DD), then merchant, then amount at end
// Negative amounts = payments/credits, positive = charges
function parseAmex(pages: string[]): ParsedRow[] {
  const rows: ParsedRow[] = [];
  const year = extractYear(pages);
  const lines = pages.join("\n").split("\n");

  const skipPatterns = /^(total|page\s|prepared|account\s*number|opening|closing|transaction\s+posting|date\s+date|your\s+transactions|new\s+(payments|transactions)|other\s+account|amount\s*\(\$\)|details|statement|american\s+express|misael|credit\s+limit|available|minimum|equals|less|plus|previous|we\s+value|membership|reference)/i;

  for (const line of lines) {
    if (skipPatterns.test(line.trim())) continue;

    // Match two dates: "Mon DD  Mon DD  rest..."
    const twoDateMatch = line.match(/^(\w{3}\s+\d{1,2})\s{2,}(\w{3}\s+\d{1,2})\s{2,}(.+)/);
    if (!twoDateMatch) continue;

    // Use posting date (second date)
    const date = parseDate(twoDateMatch[2], year);
    if (!date) continue;

    const rest = twoDateMatch[3];

    // Find amount at end of line (may be negative)
    const amtMatch = rest.match(/(-?)([\d,]+\.\d{2})\s*$/);
    if (!amtMatch) continue;

    const isNeg = amtMatch[1] === "-";
    const amount = parseFloat(amtMatch[2].replace(/,/g, ""));
    if (amount === 0) continue;

    // Merchant is everything before the amount
    const merchant = rest.slice(0, rest.lastIndexOf(amtMatch[0])).replace(/\s{2,}/g, " ").trim();
    if (!merchant || merchant.length < 2) continue;

    rows.push({
      date,
      merchant,
      amount,
      type: isNeg ? "income" : "expense",
    });
  }
  return rows;
}

// --- Neo Financial PDF ---
// Format: TransDate  PostDate  MERCHANT LOCATION COUNTRY  AMOUNT
// e.g. "Jul 9  Jul 10  PEMBRIDGE INS CO.  MARKHAM  CAN  -201.37"
// Negative amounts = expenses/purchases, positive = payments/credits (income)
function parseNeo(pages: string[]): ParsedRow[] {
  const rows: ParsedRow[] = [];
  const year = extractYear(pages);
  const lines = pages.join("\n").split("\n");

  const skipPatterns = /^(neo\s|misael|page\s|\d+\s+seagreen|chestermere|payment|account\s+summary|amount\s|new\s+balance|minimum|due\s+date|previous|rewards|cashed|total\s+available|instalments|credit\s+limit|credit\s+available|amount\s+past|amount\s+over|annual\s+interest|transaction\s*$|date\s+date|important|applying|interest-free|billing|enquiries|for\s+more|if\s+you|when\s+we|please|outstanding|the\s+entire|however)/i;

  for (const line of lines) {
    if (skipPatterns.test(line.trim())) continue;

    // Match two short dates: "Mon DD  Mon DD  rest..." or "Mon D  Mon D  rest..."
    const twoDateMatch = line.match(/^(\w{3}\s+\d{1,2})\s{2,}(\w{3}\s+\d{1,2})\s{2,}(.+)/);
    if (!twoDateMatch) continue;

    // Use transaction date (first date)
    const date = parseDate(twoDateMatch[1], year);
    if (!date) continue;

    const rest = twoDateMatch[3];

    // Find amount at end (may be negative)
    const amtMatch = rest.match(/(-?)([\d,]+\.\d{2})\s*$/);
    if (!amtMatch) continue;

    const isNeg = amtMatch[1] === "-";
    const amount = parseFloat(amtMatch[2].replace(/,/g, ""));
    if (amount === 0) continue;

    // Merchant is everything before the amount
    const merchant = rest.slice(0, rest.lastIndexOf(amtMatch[0])).replace(/\s{2,}/g, " ").trim();
    if (!merchant || merchant.length < 2) continue;

    // Neo: negative = expense, positive = income (payment)
    rows.push({
      date,
      merchant,
      amount,
      type: isNeg ? "expense" : "income",
    });
  }
  return rows;
}

// --- CIBC PDF (credit card) ---
// Format: "Mon DD  Mon DD  [Ý]  MERCHANT  LOCATION  PROV  [Category]  AMOUNT"
// Payments are separate lines like "Jun 16  Jun 17  PAYMENT THANK YOU/...  4,676.61"
function parseCIBC(pages: string[]): ParsedRow[] {
  const rows: ParsedRow[] = [];
  const year = extractYear(pages);
  const lines = pages.join("\n").split("\n");

  const skipPatterns = /^(cibc|marissa|account\s+number|statement\s+date|your\s|previous|contact|customer|lost|tty|online|summary|credit|available|interest|amount\s+due|minimum\s+payment|please|tear\s+off|page\s|\*\d|payment\s+option|institution|mail|money|total|®)/i;

  for (const line of lines) {
    if (skipPatterns.test(line.trim())) continue;

    const twoDateMatch = line.match(/^(\w{3}\s+\d{1,2})\s{2,}(\w{3}\s+\d{1,2})\s{2,}(.+)/);
    if (!twoDateMatch) continue;

    const date = parseDate(twoDateMatch[1], year);
    if (!date) continue;

    let rest = twoDateMatch[3];

    // Strip leading Ý icon character
    rest = rest.replace(/^[\xDDÝ]\s+/, "");

    const amtMatch = rest.match(/([\d,]+\.\d{2})\s*$/);
    if (!amtMatch) continue;

    const amount = parseFloat(amtMatch[1].replace(/,/g, ""));
    if (amount === 0) continue;

    // Merchant is everything before the amount; strip trailing category words
    let merchant = rest.slice(0, rest.lastIndexOf(amtMatch[0])).replace(/\s{2,}/g, " ").trim();
    // CIBC appends category labels like "Restaurants", "Retail and Grocery" at the end
    merchant = merchant.replace(/\s+(Restaurants|Retail and Grocery|Transportation|Health and Education|Home and Office Improvement|Personal and Household Expenses|Entertainment|Travel|Insurance|Government|Other)\s*$/i, "").trim();
    if (!merchant || merchant.length < 2) continue;

    const isPayment = /payment|thank\s+you|paiement|merci|refund|credit|return/i.test(merchant);

    rows.push({ date, merchant, amount, type: isPayment ? "income" : "expense" });
  }
  return rows;
}

// --- Generic fallback ---
function parseGeneric(pages: string[]): ParsedRow[] {
  const rows: ParsedRow[] = [];
  const year = extractYear(pages);
  const lines = pages.join("\n").split("\n");

  for (const line of lines) {
    const dateMatch = line.match(/^(\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\w{3}\s+\d{1,2},?\s*\d{0,4})\s{2,}(.+)/);
    if (!dateMatch) continue;

    const date = parseDate(dateMatch[1], year);
    if (!date) continue;

    const rest = dateMatch[2];
    const amounts: { value: number; index: number; neg: boolean }[] = [];
    const amtRe = /(-?\$?)([\d,]+\.\d{2})(-?)/g;
    let m;
    while ((m = amtRe.exec(rest)) !== null) {
      amounts.push({
        value: parseFloat(m[2].replace(/,/g, "")),
        index: m.index,
        neg: m[1].includes("-") || m[3].includes("-"),
      });
    }
    if (amounts.length === 0) continue;

    const merchant = rest.slice(0, amounts[0].index).replace(/\s{2,}/g, " ").trim();
    if (!merchant || merchant.length < 2) continue;

    const amt = amounts[amounts.length - 1];
    rows.push({ date, merchant, amount: amt.value, type: amt.neg ? "income" : "expense" });
  }
  return rows;
}

const PARSERS: Record<BankFormat, (pages: string[]) => ParsedRow[]> = {
  scotiabank: parseScotiabank,
  bmo: parseBMO,
  amex: parseAmex,
  neo: parseNeo,
  cibc: parseCIBC,
};

export function parseStatementRows(pages: string[], bank: BankFormat): ParsedRow[] {
  const parser = PARSERS[bank] || parseGeneric;
  return parser(pages);
}

export function rowsToTransactions(rows: ParsedRow[], bankName: string): Transaction[] {
  return rows.map((r) => {
    const tx: Transaction = {
      id: uuid(),
      date: r.date,
      merchant: r.merchant,
      category: "Needs review",
      amount: r.amount,
      type: r.type,
      account: "Imported account",
      bank: bankName,
      tags: [],
      receipt: false,
      source: "csv",
      fingerprint: "",
      createdAt: isoNow(),
    };
    tx.fingerprint = fp(tx);
    return tx;
  });
}

export interface StatementInfo {
  balance: number | null;
  dueDate: string | null;
  statementDate: string | null;
}

export function extractStatementInfo(pages: string[], bank: BankFormat): StatementInfo {
  const text = pages.join("\n");
  const year = extractYear(pages);
  let balance: number | null = null;
  let dueDate: string | null = null;
  let statementDate: string | null = null;

  if (bank === "scotiabank") {
    // The "New Balance" label is followed by a superscript glyph (U+0087), "=",
    // and "$" before the amount, all on the same line. Consume any run of
    // non-digit chars (but not a newline, to stay on the label's line) then grab
    // the amount. The original [^$\d]* failed because it stopped at the "$".
    const balMatch = text.match(/New\s+Balance[^\d\n]*([\d,]+\.\d{2})/i);
    if (balMatch) balance = parseFloat(balMatch[1].replace(/,/g, ""));
    const dueMatch = text.match(/Payment\s+Due\s+Date\s+(\w{3,9}\s+\d{1,2},?\s*\d{4})/i);
    if (dueMatch) dueDate = parseDate(dueMatch[1], year);
    const stmtMatch = text.match(/Statement\s+Date\s+(\w{3,9}\s+\d{1,2},?\s*\d{4})/i);
    if (stmtMatch) statementDate = parseDate(stmtMatch[1], year);
  } else if (bank === "neo") {
    const balMatch = text.match(/New\s+(?:Balance|Amount\s+Owing)\s*([\d,]+\.\d{2})/i);
    if (balMatch) balance = parseFloat(balMatch[1].replace(/,/g, ""));
    const dueMatch = text.match(/Due\s+Date\s+(\w{3,9}\s+\d{1,2},?\s*\d{4})/i);
    if (dueMatch) dueDate = parseDate(dueMatch[1], year);
    const stmtMatch = text.match(/(\w{3,9}\s+\d{1,2},?\s*\d{4})\s*[-–]\s*(\w{3,9}\s+\d{1,2},?\s*\d{4})/i);
    if (stmtMatch) statementDate = parseDate(stmtMatch[2], year);
  } else if (bank === "amex") {
    const balMatch = text.match(/New\s+Balance\s*\$?([\d,]+\.\d{2})/i)
      || text.match(/Total\s+Amount\s+Due\s*\$?([\d,]+\.\d{2})/i);
    if (balMatch) balance = parseFloat(balMatch[1].replace(/,/g, ""));
    const dueMatch = text.match(/Payment\s+Due\s+Date[:\s]*(\w{3,9}\s+\d{1,2},?\s*\d{4})/i);
    if (dueMatch) dueDate = parseDate(dueMatch[1], year);
    const stmtMatch = text.match(/Statement\s+(?:Date|Closing\s+Date)[:\s]*(\w{3,9}\s+\d{1,2},?\s*\d{4})/i);
    if (stmtMatch) statementDate = parseDate(stmtMatch[1], year);
  } else if (bank === "bmo") {
    // Credit card: "Balance due  $558.17" or "Total balance  $558.17"
    // Chequing: "Closing balance ... 1,234.56"
    const balMatch = text.match(/Balance\s+due\s+\$?([\d,]+\.\d{2})/i)
      || text.match(/Total\s+balance\s+\$?([\d,]+\.\d{2})/i)
      || text.match(/Closing\s+balance.*?([\d,]+\.\d{2})/i)
      || text.match(/balance\s*\(\$\)\s+on.*?([\d,]+\.\d{2})/i);
    if (balMatch) balance = parseFloat(balMatch[1].replace(/,/g, ""));
    // Credit card: "Statement date  Jul. 16, 2026" (on same line as previous balance)
    const stmtMatch = text.match(/Statement\s+date\s+(\w{3,9}\.?\s+\d{1,2},?\s*\d{4})/i)
      || text.match(/period\s+ending\s+(\w{3,9}\s+\d{1,2},?\s*\d{4})/i);
    if (stmtMatch) statementDate = parseDate(stmtMatch[1].replace(".", ""), year);
    // Credit card: "Payment due date: Aug. 6, 2026"
    const dueMatch = text.match(/Payment\s+due\s+date:?\s+(\w{3,9}\.?\s+\d{1,2},?\s*\d{4})/i);
    if (dueMatch) dueDate = parseDate(dueMatch[1].replace(".", ""), year);
  } else if (bank === "cibc") {
    // "Total balance  =  $2,824.15" or "Amount Due ... $2,824.15"
    const balMatch = text.match(/Total\s+balance[^\d\n]*([\d,]+\.\d{2})/i)
      || text.match(/Amount\s+Due[^\d\n]*([\d,]+\.\d{2})/i);
    if (balMatch) balance = parseFloat(balMatch[1].replace(/,/g, ""));
    // "Statement Date" on one line, date on the next: "July 12, 2026"
    const stmtMatch = text.match(/Statement\s+Date\s*\n\s*(\w{3,9}\s+\d{1,2},?\s*\d{4})/i)
      || text.match(/Statement\s+Date\s+(\w{3,9}\s+\d{1,2},?\s*\d{4})/i);
    if (stmtMatch) statementDate = parseDate(stmtMatch[1], year);
    // "Please pay this amount by  Aug 04, 2026" or "Minimum Payment due by ... Aug 04, 2026"
    const dueMatch = text.match(/pay\s+(?:this\s+amount|.*?)\s+by\s+(\w{3,9}\s+\d{1,2},?\s*\d{4})/i);
    if (dueMatch) dueDate = parseDate(dueMatch[1], year);
  }

  return { balance, dueDate, statementDate };
}

export function getRawText(pages: string[]): string {
  return pages.join("\n\n--- Page Break ---\n\n");
}
