import React, { useState, useRef, useEffect, useCallback } from 'react';
import { LineChartComponent } from './components/LineChartComponent';
import { DataPoint, ProjectData, Transaction, AccountData } from './types';
import { useLoanCalculations } from './hooks/useLoanCalculations';

const App: React.FC = () => {
  const [homeLoan, setHomeLoan] = useState({ fileName: '', startingBalance: '', startingDate: '', transactions: [] as Transaction[], autoDateMessage: null as string | null });
  const [offset, setOffset] = useState({ fileName: '', startingBalance: '', startingDate: '', transactions: [] as Transaction[], autoDateMessage: null as string | null });
  
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [projectFileName, setProjectFileName] = useState<string | null>(null);
  
  const [showHomeLoan, setShowHomeLoan] = useState<boolean>(true);
  const [showOffset, setShowOffset] = useState<boolean>(true);
  const [showNetLoan, setShowNetLoan] = useState<boolean>(true);
  const [showHomeLoanTrend, setShowHomeLoanTrend] = useState<boolean>(false);
  const [showOffsetTrend, setShowOffsetTrend] = useState<boolean>(false);
  const [showNetLoanTrend, setShowNetLoanTrend] = useState<boolean>(false);
  
  // State for immediate brush position feedback
  const [brushStartIndex, setBrushStartIndex] = useState<number | undefined>(undefined);
  const [brushEndIndex, setBrushEndIndex] = useState<number | undefined>(undefined);
  
  // State to trigger expensive calculations only when dragging ends
  const [finalBrushStartIndex, setFinalBrushStartIndex] = useState<number | undefined>(undefined);
  const [finalBrushEndIndex, setFinalBrushEndIndex] = useState<number | undefined>(undefined);
  
  // Use the loan calculations hook
  const {
    baseChartData,
    displayData,
    forecasts,
    handleBrushChange: handleBrushChangeFromHook
  } = useLoanCalculations({
    homeLoanTransactions: homeLoan.transactions,
    offsetTransactions: offset.transactions,
    homeLoanStartBalance: parseFloat(homeLoan.startingBalance) || 0,
    offsetStartBalance: parseFloat(offset.startingBalance) || 0,
    homeLoanStartDate: homeLoan.startingDate,
    offsetStartDate: offset.startingDate
  });

  const qifHomeLoanInputRef = useRef<HTMLInputElement>(null);
  const qifOffsetInputRef = useRef<HTMLInputElement>(null);
  const jsonFileInputRef = useRef<HTMLInputElement>(null);
  
  // Handle brush change events
  const handleBrushChange = useCallback((range: { startIndex?: number; endIndex?: number }) => {
    setBrushStartIndex(range.startIndex);
    setBrushEndIndex(range.endIndex);
    handleBrushChangeFromHook(range);
  }, [handleBrushChangeFromHook]);

  // Handle brush end event
  const handleBrushUp = useCallback(() => {
    setFinalBrushStartIndex(brushStartIndex);
    setFinalBrushEndIndex(brushEndIndex);
  }, [brushStartIndex, brushEndIndex]);

  const parseQif = (content: string): Transaction[] => {
    const transactionsRaw = content.split('^').filter(t => t.trim() !== '');
    const parsedTransactions: Transaction[] = [];

    for (const trans of transactionsRaw) {
        const lines = trans.trim().split('\n');
        let dateStr: string | null = null;
        let amountStr: string | null = null;
        let memo: string | null = null;

        for (const line of lines) {
            if (line.startsWith('D')) dateStr = line.substring(1).trim();
            else if (line.startsWith('T')) amountStr = line.substring(1).trim().replace(/,/g, '');
            else if (line.startsWith('M')) memo = line.substring(1).trim();
        }
        
        if (dateStr && amountStr && memo) {
            const dateParts = dateStr.split('/');
            if (dateParts.length === 3) {
                const date = new Date(Date.UTC(parseInt(dateParts[2]), parseInt(dateParts[1]) - 1, parseInt(dateParts[0])));
                const amount = parseFloat(amountStr);
                if (!isNaN(date.getTime()) && !isNaN(amount)) {
                    const isoDate = date.toISOString().split('T')[0];
                    parsedTransactions.push({ 
                        date: isoDate,
                        amount, 
                        memo,
                    });
                }
            }
        }
    }
    return parsedTransactions;
  }

  const findEarliestDateAndSetStartDate = (transactions: Transaction[], accountType: 'homeLoan' | 'offset') => {
    if (transactions.length === 0) return;

    try {
        const dates = transactions.map(t => new Date(t.date + 'T00:00:00Z'));
        const earliestDate = new Date(Math.min(...dates.map(d => d.getTime())));
        earliestDate.setUTCDate(earliestDate.getUTCDate() - 1);
        const formattedDate = earliestDate.toISOString().split('T')[0];
        
        const setData = accountType === 'homeLoan' ? setHomeLoan : setOffset;
        setData(prev => ({ ...prev, startingDate: formattedDate, autoDateMessage: "Date auto-filled. Please enter the balance for this day." }));

    } catch (err) {
      setError("Could not automatically determine date from QIF file.");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, accountType: 'homeLoan' | 'offset') => {
    const file = e.target.files?.[0];
    if (file && file.name.endsWith('.qif')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        const parsedTransactions = parseQif(content);

        if (parsedTransactions.length === 0) {
            setError("No valid transactions found in the uploaded QIF file.");
            return;
        }

        setError(null);
        setInfo(null);
        
        const setData = accountType === 'homeLoan' ? setHomeLoan : setOffset;
        const currentData = accountType === 'homeLoan' ? homeLoan : offset;

        if (isProjectActive && currentData.transactions.length > 0) {
            const existingTransactionIds = new Set(currentData.transactions.map(t => `${t.date}|${t.amount}|${t.memo}`));
            const newTransactions = parsedTransactions.filter(t => !existingTransactionIds.has(`${t.date}|${t.amount}|${t.memo}`));

            if (newTransactions.length > 0) {
                const combined = [...currentData.transactions, ...newTransactions].sort((a, b) => new Date(a.date + 'T00:00:00Z').getTime() - new Date(b.date + 'T00:00:00Z').getTime());
                setData(prev => ({...prev, transactions: combined, fileName: file.name}));
                setInfo(`Merged ${newTransactions.length} new transaction(s) into ${accountType === 'homeLoan' ? 'Home Loan' : 'Offset'} account.`);
            } else {
                setInfo(`No new transactions found in ${file.name}.`);
            }
        } else {
            const sorted = parsedTransactions.sort((a,b) => new Date(a.date + 'T00:00:00Z').getTime() - new Date(b.date + 'T00:00:00Z').getTime());
            setData(prev => ({...prev, transactions: sorted, fileName: file.name}));
            findEarliestDateAndSetStartDate(sorted, accountType);
        }
      };
      reader.onerror = () => setError("Failed to read the file.");
      reader.readAsText(file);
    } else {
      setError("Please select a valid .qif file.");
    }
    e.target.value = '';
  };

  const generateBalanceMap = (
    transactions: Transaction[],
    balance: number,
    date: string
  ): Map<string, number> => {
    const sortedTransactions = transactions; // Already sorted on upload
    let currentBalance = balance;

    const relevantTransactions = sortedTransactions.filter(t => new Date(t.date + 'T00:00:00Z') >= new Date(date + 'T00:00:00Z'));
    
    const groupedByDay = relevantTransactions.reduce((acc, t) => {
      acc[t.date] = (acc[t.date] || 0) + t.amount;
      return acc;
    }, {} as Record<string, number>);

    const sortedTransactionDates = Object.keys(groupedByDay).sort((a,b) => new Date(a + 'T00:00:00Z').getTime() - new Date(b + 'T00:00:00Z').getTime());
    
    const finalChartDataMap = new Map<string, number>();
    finalChartDataMap.set(date, currentBalance);
    
    for (const dateKey of sortedTransactionDates) {
      currentBalance += groupedByDay[dateKey];
      finalChartDataMap.set(dateKey, currentBalance);
    }
    return finalChartDataMap;
  };

  const calculateLinearRegression = (data: { x: number; y: number }[]): {
    slope: number;
    intercept: number;
    trendFn: (x: number) => number | null;
  } => {
    const n = data.length;
    if (n < 2) {
        return { slope: NaN, intercept: NaN, trendFn: (_x: number) => null };
    }

    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;

    for (const point of data) {
        sumX += point.x;
        sumY += point.y;
        sumXY += point.x * point.y;
        sumXX += point.x * point.x;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    if (isNaN(slope) || isNaN(intercept)) {
        return { slope: NaN, intercept: NaN, trendFn: (_x: number) => null };
    }

    return { slope, intercept, trendFn: (x: number) => slope * x + intercept };
  };

  const generateChart = useCallback(() => {
    // The chart generation is now handled by the useLoanCalculations hook
    // This function is kept for backward compatibility
    setInfo("Chart data updated!");
  }, []);

  const handleSubmit = useCallback((e?: React.FormEvent) => {
    if (e) e.preventDefault();
    generateChart();
  }, [generateChart]);

  const handleExport = () => {
    if (!isProjectActive) {
      setError("No project data to export. Please generate a chart first.");
      return;
    }
    try {
      const projectData: ProjectData = {};
      if (homeLoan.transactions.length > 0) {
        projectData.homeLoan = { startingBalance: homeLoan.startingBalance, startingDate: homeLoan.startingDate, transactions: homeLoan.transactions, fileName: homeLoan.fileName };
      }
      if (offset.transactions.length > 0) {
        projectData.offset = { startingBalance: offset.startingBalance, startingDate: offset.startingDate, transactions: offset.transactions, fileName: offset.fileName };
      }

      const jsonString = JSON.stringify(projectData, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = projectFileName || "qif-balance-project.json";
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err) {
      setError("Failed to export project data.");
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.name.endsWith('.json')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const importedProject = JSON.parse(event.target?.result as string) as ProjectData;
          resetState(); // Clear old state
          
          let hasData = false;
          if (importedProject.homeLoan) {
            const { startingBalance, startingDate, transactions, fileName } = importedProject.homeLoan;
            setHomeLoan({ startingBalance, startingDate, transactions, fileName, autoDateMessage: null });
            hasData = true;
          }
          if (importedProject.offset) {
            const { startingBalance, startingDate, transactions, fileName } = importedProject.offset;
            setOffset({ startingBalance, startingDate, transactions, fileName, autoDateMessage: null });
            hasData = true;
          }

          if (hasData) {
            setProjectFileName(file.name);
            setError(null);
            setInfo("Project loaded!");
          } else {
            throw new Error("Invalid or empty project file.");
          }

        } catch (err: any) {
          setError(err.message || "Failed to parse the project file.");
        }
      };
      reader.onerror = () => setError("Failed to read the import file.");
      reader.readAsText(file);
    } else {
      setError("Please select a valid .json file.");
    }
    e.target.value = '';
  };
  
  const resetState = () => {
    setHomeLoan({ fileName: '', startingBalance: '', startingDate: '', transactions: [], autoDateMessage: null });
    setOffset({ fileName: '', startingBalance: '', startingDate: '', transactions: [], autoDateMessage: null });
    setError(null);
    setInfo(null);
    setIsLoading(false);
    setProjectFileName(null);
    setBrushStartIndex(undefined);
    setBrushEndIndex(undefined);
    setFinalBrushStartIndex(undefined);
    setFinalBrushEndIndex(undefined);
    if (qifHomeLoanInputRef.current) qifHomeLoanInputRef.current.value = '';
    if (qifOffsetInputRef.current) qifOffsetInputRef.current.value = '';
    if (jsonFileInputRef.current) jsonFileInputRef.current.value = '';
  };

  const getUploadFromDate = (transactions: Transaction[]): string | null => {
    if (transactions.length === 0) return null;
    const latestTransaction = transactions[transactions.length - 1];
    const latestDate = new Date(latestTransaction.date + 'T00:00:00Z');
    latestDate.setUTCDate(latestDate.getUTCDate() + 1);
    return latestDate.toLocaleDateString('en-US', {
        timeZone: 'UTC',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
  };

  const isProjectActive = baseChartData !== null;
  const isHomeLoanDataProvided = !!(homeLoan.transactions.length > 0 && homeLoan.startingBalance && homeLoan.startingDate);
  const isOffsetDataProvided = !!(offset.transactions.length > 0 && offset.startingBalance && offset.startingDate);
  const isFormValidForSubmit = isHomeLoanDataProvided || isOffsetDataProvided;

  return (
    <main className="bg-gray-900 text-white min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 font-sans">
      <div className="w-full max-w-6xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold mb-2 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">
            QIF Balance Visualizer
          </h1>
          <p className="text-lg sm:text-xl text-gray-400">
            {isProjectActive ? `Project loaded. Add more QIF files to merge data into an account.` : "Upload your bank's QIF file to see your balance over time."}
          </p>
        </div>

        <div className="bg-gray-800/50 backdrop-blur-sm p-4 sm:p-6 lg:p-8 rounded-2xl shadow-2xl border border-gray-700/50 mb-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Home Loan Account */}
              <div className="space-y-4 p-4 border border-gray-700 rounded-lg">
                  <h2 className="text-2xl font-bold text-center text-purple-400">Home Loan Account</h2>
                  <div className="flex flex-col">
                    <label className="mb-2 font-semibold text-gray-300">QIF File</label>
                    <label className="w-full bg-gray-700 text-white rounded-lg px-4 py-3 cursor-pointer hover:bg-gray-600 transition-colors text-center truncate">
                      {homeLoan.transactions.length > 0 ? 'Upload another QIF' : 'Choose QIF File'}
                      <input ref={qifHomeLoanInputRef} type="file" accept=".qif" onChange={(e) => handleFileChange(e, 'homeLoan')} className="hidden" />
                    </label>
                    {homeLoan.transactions.length > 0 && (
                        <p className="text-xs text-gray-400 mt-2 text-center">
                        Upload from {getUploadFromDate(homeLoan.transactions)}
                        </p>
                    )}
                  </div>
                  <div className="flex flex-col">
                    <label className="mb-2 font-semibold text-gray-300">Starting Balance ($)</label>
                    <input type="number" step="0.01" value={homeLoan.startingBalance} onChange={(e) => setHomeLoan(p => ({...p, startingBalance: e.target.value}))} placeholder="e.g., -350000.00" className="bg-gray-700 text-white placeholder-gray-500 rounded-lg px-4 py-3 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 disabled:bg-gray-800" required={homeLoan.transactions.length > 0} disabled={isProjectActive && isHomeLoanDataProvided} />
                  </div>
                  <div className="flex flex-col">
                    <label className="mb-2 font-semibold text-gray-300">Starting Date</label>
                    <input type="date" value={homeLoan.startingDate} onChange={(e) => setHomeLoan(p => ({...p, startingDate: e.target.value, autoDateMessage: null}))} className="bg-gray-700 text-white rounded-lg px-4 py-3 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 disabled:bg-gray-800" required={homeLoan.transactions.length > 0} disabled={isProjectActive && isHomeLoanDataProvided} />
                    {homeLoan.autoDateMessage && <p className="text-xs text-gray-400 mt-2">{homeLoan.autoDateMessage}</p>}
                  </div>
              </div>

              {/* Offset Account */}
              <div className="space-y-4 p-4 border border-gray-700 rounded-lg">
                  <h2 className="text-2xl font-bold text-center text-green-400">Offset Account</h2>
                  <div className="flex flex-col">
                    <label className="mb-2 font-semibold text-gray-300">QIF File</label>
                    <label className="w-full bg-gray-700 text-white rounded-lg px-4 py-3 cursor-pointer hover:bg-gray-600 transition-colors text-center truncate">
                      {offset.transactions.length > 0 ? 'Upload another QIF' : 'Choose QIF File'}
                      <input ref={qifOffsetInputRef} type="file" accept=".qif" onChange={(e) => handleFileChange(e, 'offset')} className="hidden" />
                    </label>
                     {offset.transactions.length > 0 && (
                        <p className="text-xs text-gray-400 mt-2 text-center">
                        Upload from {getUploadFromDate(offset.transactions)}
                        </p>
                    )}
                  </div>
                  <div className="flex flex-col">
                    <label className="mb-2 font-semibold text-gray-300">Starting Balance ($)</label>
                    <input type="number" step="0.01" value={offset.startingBalance} onChange={(e) => setOffset(p => ({...p, startingBalance: e.target.value}))} placeholder="e.g., 25000.50" className="bg-gray-700 text-white placeholder-gray-500 rounded-lg px-4 py-3 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:bg-gray-800" required={offset.transactions.length > 0} disabled={isProjectActive && isOffsetDataProvided} />
                  </div>
                  <div className="flex flex-col">
                    <label className="mb-2 font-semibold text-gray-300">Starting Date</label>
                    <input type="date" value={offset.startingDate} onChange={(e) => setOffset(p => ({...p, startingDate: e.target.value, autoDateMessage: null}))} className="bg-gray-700 text-white rounded-lg px-4 py-3 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:bg-gray-800" required={offset.transactions.length > 0} disabled={isProjectActive && isOffsetDataProvided} />
                    {offset.autoDateMessage && <p className="text-xs text-gray-400 mt-2">{offset.autoDateMessage}</p>}
                  </div>
              </div>
            </div>
            
            <button type="submit" disabled={!isFormValidForSubmit || isLoading} className="w-full font-bold py-3 px-4 rounded-lg bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center">
              {isLoading && <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
              {isLoading ? 'Processing...' : (isProjectActive ? 'Update Chart' : 'Generate Chart')}
            </button>
            
            <div className="border-t border-gray-700 my-4"></div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
               <button type="button" onClick={handleExport} disabled={!isProjectActive} className="w-full font-semibold py-2 px-4 rounded-lg bg-gray-600 hover:bg-gray-500 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed">
                  Export Project
                </button>
                <label className="w-full font-semibold py-2 px-4 rounded-lg bg-gray-600 hover:bg-gray-500 transition-colors duration-200 cursor-pointer text-center">
                  Import Project
                  <input ref={jsonFileInputRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
                </label>
                <button type="button" onClick={resetState} className="w-full font-semibold py-2 px-4 rounded-lg bg-red-800 hover:bg-red-700 transition-colors duration-200">
                  Reset
                </button>
            </div>

            {error && <p className="text-red-400 text-center mt-2">{error}</p>}
            {info && <p className="text-green-400 text-center mt-2">{info}</p>}
          </form>
        </div>
        
        {displayData && (
          <div className="bg-gray-800/50 backdrop-blur-sm p-4 rounded-2xl shadow-lg border border-gray-700/50 mb-8 flex flex-col space-y-4">
            <div className="flex items-center justify-center flex-wrap gap-x-4 sm:gap-x-8 gap-y-2">
              <h3 className="text-md sm:text-lg font-semibold text-gray-300 hidden sm:block">Graphs:</h3>
              <div className="flex items-center">
                <input 
                  type="checkbox" 
                  id="showHomeLoan" 
                  checked={showHomeLoan} 
                  onChange={(e) => setShowHomeLoan(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-500 bg-gray-700 accent-purple-500 focus:ring-purple-500 focus:ring-offset-gray-800"
                  disabled={!isHomeLoanDataProvided}
                />
                <label htmlFor="showHomeLoan" className="ml-2 sm:ml-3 text-sm sm:text-base text-gray-200 cursor-pointer">Home Loan</label>
              </div>
              <div className="flex items-center">
                <input 
                  type="checkbox" 
                  id="showOffset" 
                  checked={showOffset} 
                  onChange={(e) => setShowOffset(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-500 bg-gray-700 accent-green-500 focus:ring-green-500 focus:ring-offset-gray-800"
                  disabled={!isOffsetDataProvided}
                />
                <label htmlFor="showOffset" className="ml-2 sm:ml-3 text-sm sm:text-base text-gray-200 cursor-pointer">Offset</label>
              </div>
              <div className="flex items-center">
                <input 
                  type="checkbox" 
                  id="showNetLoan" 
                  checked={showNetLoan} 
                  onChange={(e) => setShowNetLoan(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-500 bg-gray-700 accent-yellow-500 focus:ring-yellow-400 focus:ring-offset-gray-800"
                  disabled={!isHomeLoanDataProvided || !isOffsetDataProvided}
                />
                <label htmlFor="showNetLoan" className="ml-2 sm:ml-3 text-sm sm:text-base text-gray-200 cursor-pointer">Net Loan</label>
              </div>
            </div>
             <div className="flex items-center justify-center flex-wrap gap-x-4 sm:gap-x-8 gap-y-2 border-t border-gray-700 pt-4">
              <h3 className="text-md sm:text-lg font-semibold text-gray-300 hidden sm:block">Trend Lines:</h3>
              <div className="flex items-center">
                <input 
                  type="checkbox" 
                  id="showHomeLoanTrend" 
                  checked={showHomeLoanTrend} 
                  onChange={(e) => setShowHomeLoanTrend(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-500 bg-gray-700 accent-purple-500 focus:ring-purple-500 focus:ring-offset-gray-800"
                  disabled={!isHomeLoanDataProvided}
                />
                <label htmlFor="showHomeLoanTrend" className="ml-2 sm:ml-3 text-sm sm:text-base text-gray-200 cursor-pointer">Home Loan</label>
                 {showHomeLoanTrend && forecasts.homeLoan && <span className="text-xs font-mono text-purple-300 ml-2">(Forecast: {forecasts.homeLoan})</span>}
              </div>
              <div className="flex items-center">
                <input 
                  type="checkbox" 
                  id="showOffsetTrend" 
                  checked={showOffsetTrend} 
                  onChange={(e) => setShowOffsetTrend(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-500 bg-gray-700 accent-green-500 focus:ring-green-500 focus:ring-offset-gray-800"
                  disabled={!isOffsetDataProvided}
                />
                <label htmlFor="showOffsetTrend" className="ml-2 sm:ml-3 text-sm sm:text-base text-gray-200 cursor-pointer">Offset</label>
                 {showOffsetTrend && forecasts.offset && <span className="text-xs font-mono text-green-300 ml-2">(Forecast: {forecasts.offset})</span>}
              </div>
              <div className="flex items-center">
                <input 
                  type="checkbox" 
                  id="showNetLoanTrend" 
                  checked={showNetLoanTrend} 
                  onChange={(e) => setShowNetLoanTrend(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-500 bg-gray-700 accent-yellow-500 focus:ring-yellow-400 focus:ring-offset-gray-800"
                  disabled={!isHomeLoanDataProvided || !isOffsetDataProvided}
                />
                <label htmlFor="showNetLoanTrend" className="ml-2 sm:ml-3 text-sm sm:text-base text-gray-200 cursor-pointer">Net Loan</label>
                 {showNetLoanTrend && forecasts.netLoan && <span className="text-xs font-mono text-yellow-300 ml-2">(Forecast: {forecasts.netLoan})</span>}
              </div>
            </div>
          </div>
        )}

        <div className="bg-gray-800/50 backdrop-blur-sm p-4 sm:p-6 lg:p-8 rounded-2xl shadow-2xl border border-gray-700/50 min-h-[440px] flex items-center justify-center">
           {displayData ? (
             <LineChartComponent 
               data={displayData} 
               showHomeLoan={showHomeLoan} 
               showOffset={showOffset} 
               showNetLoan={showNetLoan}
               showHomeLoanTrend={showHomeLoanTrend}
               showOffsetTrend={showOffsetTrend}
               showNetLoanTrend={showNetLoanTrend}
               onBrushChange={handleBrushChange}
               onBrushUp={handleBrushUp}
               startIndex={brushStartIndex}
               endIndex={brushEndIndex}
             />
           ) : (
             <div className="text-center text-gray-500">
               <p className="text-xl">Your chart will appear here.</p>
               <p>Please provide your data above to get started.</p>
             </div>
           )}
        </div>
      </div>
    </main>
  );
};

export default App;