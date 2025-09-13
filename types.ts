export interface DataPoint {
  name: string;
  homeLoan?: number;
  offset?: number;
  netLoan?: number;
  homeLoanMissing?: number;
  offsetMissing?: number;
  homeLoanTrend?: number;
  offsetTrend?: number;
  netLoanTrend?: number;
}

export interface Transaction {
  date: string; // YYYY-MM-DD
  amount: number;
  memo: string;
}

export interface AccountData {
  startingBalance: string;
  startingDate: string;
  transactions: Transaction[];
  fileName: string;
}

export interface ProjectData {
  homeLoan?: AccountData;
  offset?: AccountData;
}