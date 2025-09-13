import React, { useMemo, useCallback } from 'react';
import { useDebounce } from '../hooks/useDebounce';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Brush, Line } from 'recharts';
import { DataPoint } from '../types';

interface LineChartComponentProps {
  data: DataPoint[];
  showHomeLoan: boolean;
  showOffset: boolean;
  showNetLoan: boolean;
  showHomeLoanTrend: boolean;
  showOffsetTrend: boolean;
  showNetLoanTrend: boolean;
  onBrushChange: (range: { startIndex?: number; endIndex?: number }) => void;
  onBrushUp: () => void;
  startIndex?: number;
  endIndex?: number;
}

// A custom tooltip for better styling
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const homeLoanPayload = payload.find(p => p.dataKey === 'homeLoan' || p.dataKey === 'homeLoanMissing');
    const offsetPayload = payload.find(p => p.dataKey === 'offset' || p.dataKey === 'offsetMissing');
    const netLoanPayload = payload.find(p => p.dataKey === 'netLoan');
    const homeLoanTrendPayload = payload.find(p => p.dataKey === 'homeLoanTrend');
    const offsetTrendPayload = payload.find(p => p.dataKey === 'offsetTrend');
    const netLoanTrendPayload = payload.find(p => p.dataKey === 'netLoanTrend');

    const formatCurrency = (value: number) => new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);

    return (
      <div className="bg-gray-700/80 backdrop-blur-sm p-4 rounded-lg border border-gray-600 shadow-lg">
        <p className="label text-base font-bold text-white">{`${label}`}</p>
        {homeLoanPayload && typeof homeLoanPayload.value === 'number' && (
           <p className="intro text-sm text-purple-400">
            {`Home Loan: ${formatCurrency(homeLoanPayload.value)}`}
            {homeLoanPayload.dataKey === 'homeLoanMissing' && <span className="text-orange-400 ml-1">(pre-start)</span>}
           </p>
        )}
        {homeLoanTrendPayload && typeof homeLoanTrendPayload.value === 'number' && (
          <p className="intro text-sm text-purple-300 italic">{`Trend: ${formatCurrency(homeLoanTrendPayload.value)}`}</p>
        )}
        {offsetPayload && typeof offsetPayload.value === 'number' && (
          <p className="intro text-sm text-green-400 mt-2">
            {`Offset: ${formatCurrency(offsetPayload.value)}`}
            {offsetPayload.dataKey === 'offsetMissing' && <span className="text-orange-400 ml-1">(pre-start)</span>}
          </p>
        )}
        {offsetTrendPayload && typeof offsetTrendPayload.value === 'number' && (
          <p className="intro text-sm text-green-300 italic">{`Trend: ${formatCurrency(offsetTrendPayload.value)}`}</p>
        )}
        {netLoanPayload && typeof netLoanPayload.value === 'number' && (
          <p className="intro text-sm text-yellow-400 mt-2">
            {`Net Loan: ${formatCurrency(netLoanPayload.value)}`}
          </p>
        )}
        {netLoanTrendPayload && typeof netLoanTrendPayload.value === 'number' && (
          <p className="intro text-sm text-yellow-300 italic">{`Trend: ${formatCurrency(netLoanTrendPayload.value)}`}</p>
        )}
      </div>
    );
  }
  return null;
};


export const LineChartComponent: React.FC<LineChartComponentProps> = ({ 
  data, 
  showHomeLoan, 
  showOffset, 
  showNetLoan,
  showHomeLoanTrend,
  showOffsetTrend,
  showNetLoanTrend,
  onBrushChange,
  onBrushUp,
  startIndex,
  endIndex,
}) => {
  const hasHomeLoan = data.some(d => d.homeLoan !== undefined || d.homeLoanMissing !== undefined);
  const hasOffset = data.some(d => d.offset !== undefined || d.offsetMissing !== undefined);
  const hasNetLoan = data.some(d => d.netLoan !== undefined);
  const hasHomeLoanTrend = data.some(d => d.homeLoanTrend !== undefined);
  const hasOffsetTrend = data.some(d => d.offsetTrend !== undefined);
  const hasNetLoanTrend = data.some(d => d.netLoanTrend !== undefined);

  // Debounce the brush change handler to prevent excessive updates
  const debouncedOnBrushChange = useDebounce((range: { startIndex?: number; endIndex?: number }) => {
    onBrushChange(range);
  }, 100);


  const yearlyTicks = useMemo(() => {
    const years = new Set<number>();
    const ticks: string[] = [];
    data.forEach(d => {
        try {
            const year = new Date(d.name).getFullYear();
            if (!isNaN(year) && !years.has(year)) {
                years.add(year);
                ticks.push(d.name);
            }
        } catch(e) {
            // Ignore invalid date strings in the data
        }
    });
    return ticks;
  }, [data]);

  return (
    <ResponsiveContainer width="100%" height={400}>
      <AreaChart
        data={data}
        margin={{
          top: 10,
          right: 30,
          left: 20,
          bottom: 0,
        }}
      >
        <defs>
          <linearGradient id="colorHomeLoan" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8}/>
            <stop offset="95%" stopColor="#8884d8" stopOpacity={0}/>
          </linearGradient>
          <linearGradient id="colorOffset" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#82ca9d" stopOpacity={0.8}/>
            <stop offset="95%" stopColor="#82ca9d" stopOpacity={0}/>
          </linearGradient>
           <linearGradient id="colorNetLoan" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#FBBF24" stopOpacity={0.7}/>
            <stop offset="95%" stopColor="#FBBF24" stopOpacity={0}/>
          </linearGradient>
          <linearGradient id="colorMissing" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.6}/>
            <stop offset="95%" stopColor="#F59E0B" stopOpacity={0}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#4A5568" />
        <XAxis 
          dataKey="name" 
          stroke="#A0AEC0" 
          tick={{ fill: '#A0AEC0' }} 
          axisLine={{ stroke: '#4A5568' }}
          tickLine={{ stroke: '#4A5568' }}
          ticks={yearlyTicks}
          tickFormatter={(tick) => new Date(tick).getFullYear().toString()}
        />
        <YAxis 
          stroke="#A0AEC0" 
          tick={{ fill: '#A0AEC0' }} 
          axisLine={{ stroke: '#4A5568' }}
          tickLine={{ stroke: '#4A5568' }}
          tickFormatter={(value) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact' }).format(value as number)}
          domain={[0, 'dataMax']}
          allowDataOverflow={true}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ color: '#E2E8F0' }} />

        {hasHomeLoan && showHomeLoan && <Area type="monotone" dataKey="homeLoan" stroke="#8884d8" fillOpacity={1} fill="url(#colorHomeLoan)" strokeWidth={2} name="Home Loan" />}
        {hasOffset && showOffset && <Area type="monotone" dataKey="offset" stroke="#82ca9d" fillOpacity={1} fill="url(#colorOffset)" strokeWidth={2} name="Offset" />}
        {hasNetLoan && showNetLoan && <Area type="monotone" dataKey="netLoan" stroke="#FBBF24" fillOpacity={1} fill="url(#colorNetLoan)" strokeWidth={2} name="Net Loan" />}
        
        {hasHomeLoan && showHomeLoan && <Area type="monotone" dataKey="homeLoanMissing" stroke="#F59E0B" fillOpacity={1} fill="url(#colorMissing)" strokeWidth={2} name="Home Loan (pre-start)" strokeDasharray="5 5" />}
        {hasOffset && showOffset && <Area type="monotone" dataKey="offsetMissing" stroke="#F59E0B" fillOpacity={1} fill="url(#colorMissing)" strokeWidth={2} name="Offset (pre-start)" strokeDasharray="5 5" />}
        
        {hasHomeLoanTrend && showHomeLoanTrend && <Line type="monotone" dataKey="homeLoanTrend" stroke="#c084fc" strokeWidth={2} strokeDasharray="5 5" name="Home Loan Trend" dot={false} />}
        {hasOffsetTrend && showOffsetTrend && <Line type="monotone" dataKey="offsetTrend" stroke="#4ade80" strokeWidth={2} strokeDasharray="5 5" name="Offset Trend" dot={false} />}
        {hasNetLoanTrend && showNetLoanTrend && <Line type="monotone" dataKey="netLoanTrend" stroke="#facc15" strokeWidth={2} strokeDasharray="5 5" name="Net Loan Trend" dot={false} />}

        <Brush 
          dataKey="name" 
          height={30} 
          stroke="#a78bfa" 
          fill="#374151"
          onChange={debouncedOnBrushChange}
          onMouseUp={onBrushUp}
          startIndex={startIndex}
          endIndex={endIndex}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};
