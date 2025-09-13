import { useState, useEffect, useCallback } from 'react';
import { DataPoint, Transaction } from '../types';

interface UseLoanCalculationsProps {
  homeLoanTransactions: Transaction[];
  offsetTransactions: Transaction[];
  homeLoanStartBalance: number;
  offsetStartBalance: number;
  homeLoanStartDate: string;
  offsetStartDate: string;
}

interface LinearRegressionResult {
  trendFn: (x: number) => number | null;
  slope: number;
  intercept: number;
}

export const useLoanCalculations = ({
  homeLoanTransactions,
  offsetTransactions,
  homeLoanStartBalance,
  offsetStartBalance,
  homeLoanStartDate,
  offsetStartDate,
}: UseLoanCalculationsProps) => {
  const [baseChartData, setBaseChartData] = useState<DataPoint[] | null>(null);
  const [displayData, setDisplayData] = useState<DataPoint[] | null>(null);
  const [forecasts, setForecasts] = useState<{ 
    homeLoan?: string; 
    offset?: string; 
    netLoan?: string 
  }>({});

  // Calculate linear regression
  const calculateLinearRegression = (points: { x: number; y: number }[]): LinearRegressionResult => {
    if (points.length < 2) {
      return {
        trendFn: () => null,
        slope: 0,
        intercept: 0
      };
    }

    const n = points.length;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;

    points.forEach(point => {
      sumX += point.x;
      sumY += point.y;
      sumXY += point.x * point.y;
      sumXX += point.x * point.x;
    });

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    return {
      trendFn: (x: number) => slope * x + intercept,
      slope,
      intercept
    };
  };

  // Process transactions and generate chart data
  const processTransactions = useCallback(() => {
    if (!homeLoanStartDate || !offsetStartDate) return null;

    const startDate = new Date(Math.min(
      new Date(homeLoanStartDate).getTime(),
      new Date(offsetStartDate).getTime()
    ));
    
    const endDate = new Date();
    const data: DataPoint[] = [];
    const currentDate = new Date(startDate);
    
    // Initialize balances
    let homeLoanBalance = homeLoanStartBalance;
    let offsetBalance = offsetStartBalance;
    
    // Group transactions by date
    const homeLoanByDate = new Map<string, number>();
    const offsetByDate = new Map<string, number>();

    homeLoanTransactions.forEach(trans => {
      const date = trans.date;
      homeLoanByDate.set(date, (homeLoanByDate.get(date) || 0) + trans.amount);
    });

    offsetTransactions.forEach(trans => {
      const date = trans.date;
      offsetByDate.set(date, (offsetByDate.get(date) || 0) + trans.amount);
    });

    // Generate data points for each day
    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      
      // Update balances if there are transactions for this date
      if (homeLoanByDate.has(dateStr)) {
        homeLoanBalance += homeLoanByDate.get(dateStr)!;
      }
      
      if (offsetByDate.has(dateStr)) {
        offsetBalance += offsetByDate.get(dateStr)!;
      }

      // Only add data point if it's the first of the month or has transactions
      if (currentDate.getDate() === 1 || homeLoanByDate.has(dateStr) || offsetByDate.has(dateStr)) {
        data.push({
          name: dateStr,
          homeLoan: currentDate >= new Date(homeLoanStartDate) ? homeLoanBalance : undefined,
          homeLoanMissing: currentDate < new Date(homeLoanStartDate) ? homeLoanBalance : undefined,
          offset: currentDate >= new Date(offsetStartDate) ? offsetBalance : undefined,
          offsetMissing: currentDate < new Date(offsetStartDate) ? offsetBalance : undefined,
          netLoan: homeLoanBalance - offsetBalance
        });
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return data;
  }, [homeLoanTransactions, offsetTransactions, homeLoanStartBalance, offsetStartBalance, homeLoanStartDate, offsetStartDate]);

  // Update chart data when inputs change
  useEffect(() => {
    const newData = processTransactions();
    if (newData) {
      setBaseChartData(newData);
      setDisplayData(newData);
    }
  }, [processTransactions]);

  // Calculate trends and forecasts
  const updateTrendsAndForecasts = useCallback((startIndex: number, endIndex: number) => {
    if (!baseChartData) return;

    const calculationData = baseChartData.slice(startIndex, endIndex + 1);
    
    const homeLoanPoints: { x: number; y: number }[] = [];
    const offsetPoints: { x: number; y: number }[] = [];
    const netLoanPoints: { x: number; y: number }[] = [];
    
    calculationData.forEach((d, i) => {
      const originalIndex = startIndex + i;
      if (typeof d.homeLoan === 'number') homeLoanPoints.push({ x: originalIndex, y: d.homeLoan });
      if (typeof d.offset === 'number') offsetPoints.push({ x: originalIndex, y: d.offset });
      if (typeof d.netLoan === 'number') netLoanPoints.push({ x: originalIndex, y: d.netLoan });
    });

    const { trendFn: homeLoanTrendFn, slope: homeLoanSlope, intercept: homeLoanIntercept } = 
      calculateLinearRegression(homeLoanPoints);
    const { trendFn: offsetTrendFn, slope: offsetSlope, intercept: offsetIntercept } = 
      calculateLinearRegression(offsetPoints);
    const { trendFn: netLoanTrendFn, slope: netLoanSlope, intercept: netLoanIntercept } = 
      calculateLinearRegression(netLoanPoints);
    
    const calculateForecast = (
      slope: number,
      intercept: number,
      points: { x: number; y: number }[],
      allData: DataPoint[]
    ): string | undefined => {
      if (slope >= 0 || points.length < 2 || isNaN(slope)) {
        return undefined;
      }
      
      const x_zero = -intercept / slope;
      const lastPoint = points[points.length - 1];
      const firstPoint = points[0];

      if (x_zero <= lastPoint.x) {
        return undefined;
      }

      const firstDate = new Date(allData[firstPoint.x].name);
      const lastDate = new Date(allData[lastPoint.x].name);

      const timeDiff = lastDate.getTime() - firstDate.getTime();
      const indexDiff = lastPoint.x - firstPoint.x;

      if (indexDiff === 0) return undefined;

      const avgMsPerIndex = timeDiff / indexDiff;
      const indexFromLastToZero = x_zero - lastPoint.x;
      const msFromLastToZero = indexFromLastToZero * avgMsPerIndex;

      if (isNaN(msFromLastToZero)) return undefined;

      const zeroDate = new Date(lastDate.getTime() + msFromLastToZero);

      return zeroDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    };
    
    const newForecasts = {
      homeLoan: calculateForecast(homeLoanSlope, homeLoanIntercept, homeLoanPoints, baseChartData),
      offset: calculateForecast(offsetSlope, offsetIntercept, offsetPoints, baseChartData),
      netLoan: calculateForecast(netLoanSlope, netLoanIntercept, netLoanPoints, baseChartData),
    };
    setForecasts(newForecasts);

    const dataWithTrends = baseChartData.map((d, i) => ({
      ...d,
      homeLoanTrend: homeLoanTrendFn(i) ?? undefined,
      offsetTrend: offsetTrendFn(i) ?? undefined,
      netLoanTrend: netLoanTrendFn(i) ?? undefined,
    }));
    
    setDisplayData(dataWithTrends);
  }, [baseChartData]);

  // Handle brush changes
  const handleBrushChange = useCallback((range: { startIndex?: number; endIndex?: number }) => {
    if (!baseChartData) return;
    
    const startIndex = range.startIndex ?? 0;
    const endIndex = range.endIndex ?? baseChartData.length - 1;
    
    updateTrendsAndForecasts(startIndex, endIndex);
  }, [baseChartData, updateTrendsAndForecasts]);

  return {
    baseChartData,
    displayData,
    forecasts,
    handleBrushChange,
  };
};
