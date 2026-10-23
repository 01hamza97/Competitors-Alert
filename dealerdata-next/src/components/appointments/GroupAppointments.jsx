import { format, subDays, eachDayOfInterval } from 'date-fns';
import { useDealer } from '@/lib/DealerContext';
import { useAppointmentSnapshots } from '@/lib/useSupabaseData';
import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const DATE_RANGES = [
  { label: '7 Days', days: 7 },
  { label: '14 Days', days: 14 },
  { label: '30 Days', days: 30 },
  { label: '60 Days', days: 60 },
];

function isConfirmed(status) {
  if (!status) return false;
  const s = status.toLowerCase();
  return s.includes('confirm') || s === 'yes' || s === 'y' || s === 'confirmed';
}

function CustomDot({ cx, cy, value, color }) {
  if (cx == null || cy == null || value == null) return null;
  return (
    <g>
      <circle cx={cx} cy={cy} r={3} fill={color} stroke="white" strokeWidth={1.5} />
      <rect x={cx - 10} y={cy - 22} width={20} height={14} rx={3} fill={color} opacity={0.85} />
      <text x={cx} y={cy - 12} textAnchor="middle" fill="white" fontSize={8} fontWeight="700">{value}</text>
    </g>
  );
}

export default function GroupAppointments() {
  const { activeStores } = useDealer();
  const [rangeDays, setRangeDays] = useState(30);

  const dealershipKeys = activeStores.map(s => s.dealership_key).filter(Boolean);
  const { data: apptResult = { data: [], snapshot_date: null } } = useAppointmentSnapshots(dealershipKeys);
  const { data: appointments } = apptResult;

  const today = new Date();
  const startDate = subDays(today, rangeDays - 1);
  const days = eachDayOfInterval({ start: startDate, end: subDays(today, 1) });

  // Group by appointment_date, per store
  const chartData = days.map(day => {
    const dateStr = format(day, 'yyyy-MM-dd');
    const row = { date: format(day, 'MMM d') };
    activeStores.forEach(store => {
      const storeAppts = appointments.filter(a => a.dealer_id === store.dealership_key && a.appointment_date === dateStr);
      row[store.name] = storeAppts.length;
    });
    return row;
  });

  const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#f97316', '#6366f1'];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mr-2">Date Range:</p>
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {DATE_RANGES.map(r => (
            <button
              key={r.days}
              onClick={() => setRangeDays(r.days)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${rangeDays === r.days ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-600 mb-4">Appointments Set — Last {rangeDays} Days</p>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData} margin={{ top: 20, right: 20, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} interval={Math.max(1, Math.floor(chartData.length / 10))} />
            <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={32} allowDecimals={false} />
            <Tooltip contentStyle={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }} labelStyle={{ fontWeight: 600, color: '#1f2937', marginBottom: 4 }} />
            {activeStores.map((store, idx) => (
              <Line key={store.id} type="linear" dataKey={store.name} stroke={colors[idx % colors.length]} strokeWidth={2.5}
                dot={(props) => <CustomDot key={props.index} {...props} color={colors[idx % colors.length]} />} activeDot={{ r: 5 }} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Daily breakdown table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="text-xs w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-2 font-semibold uppercase tracking-wider text-gray-400 sticky left-0 bg-gray-50 z-10 whitespace-nowrap">Store</th>
                <th className="text-right px-3 py-2 font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap">Total</th>
                {days.map(day => (
                  <th key={format(day, 'yyyy-MM-dd')} className="text-right px-2 py-2 font-semibold text-gray-400 whitespace-nowrap min-w-[48px]">
                    {format(day, 'M/d')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activeStores.map((store, idx) => {
                const total = days.reduce((sum, day) => {
                  const dateStr = format(day, 'yyyy-MM-dd');
                  return sum + (appointments.filter(a => a.dealer_id === store.dealership_key && a.appointment_date === dateStr).length);
                }, 0);
                return (
                  <tr key={store.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-4 py-2 font-semibold sticky left-0 bg-white z-10 whitespace-nowrap" style={{ color: colors[idx % colors.length] }}>
                      {store.name}
                    </td>
                    <td className="px-3 py-2 text-right font-bold text-gray-700 tabular-nums">{total}</td>
                    {days.map(day => {
                      const dateStr = format(day, 'yyyy-MM-dd');
                      const count = appointments.filter(a => a.dealer_id === store.dealership_key && a.appointment_date === dateStr).length;
                      return (
                        <td key={dateStr} className="px-2 py-2 text-right tabular-nums text-gray-600">
                          {count > 0 ? count : <span className="text-gray-200">—</span>}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200 bg-gray-50">
                <td className="px-4 py-2 font-bold text-gray-700 uppercase tracking-wide sticky left-0 bg-gray-50 z-10">Total</td>
                <td className="px-3 py-2 text-right font-bold text-gray-800 tabular-nums">
                  {days.reduce((sum, day) => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    return sum + appointments.filter(a => a.appointment_date === dateStr).length;
                  }, 0)}
                </td>
                {days.map(day => {
                  const dateStr = format(day, 'yyyy-MM-dd');
                  const count = appointments.filter(a => a.appointment_date === dateStr).length;
                  return (
                    <td key={dateStr} className="px-2 py-2 text-right font-bold text-gray-700 tabular-nums">
                      {count > 0 ? count : <span className="text-gray-200">—</span>}
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}