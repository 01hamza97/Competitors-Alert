'use client';
import { format, eachDayOfInterval } from 'date-fns';
import { sumField } from '@/lib/dealershipUtils';
import { useDealer } from '@/lib/DealerContext';
import { useAppointmentSnapshots } from '@/lib/useSupabaseData';
import { RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { buildPeriodOptions, COMPARE_OPTIONS } from '@/components/dashboard/PerformanceControls';

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

// Determine if an appointment is confirmed from appointment_status
function isConfirmed(status) {
  if (!status) return false;
  const s = status.toLowerCase();
  return s.includes('confirm') || s === 'yes' || s === 'y' || s === 'confirmed';
}

function AppointmentsChart({ appointments, snapshot_date }) {
  if (!appointments.length) {
    return (
      <div className="bg-white rounded-2xl p-6 border border-gray-100 flex items-center justify-center h-64">
        <p className="text-gray-400 text-sm">{snapshot_date ? 'No appointments found for this snapshot.' : 'No appointment snapshot data available.'}</p>
      </div>
    );
  }

  // Get all unique appointment_dates and sort
  const uniqueDates = [...new Set(appointments.map(a => a.appointment_date))].filter(Boolean).sort();

  const chartData = uniqueDates.map(dateStr => {
    const dayAppts = appointments.filter(a => a.appointment_date === dateStr);
    return {
      date: format(new Date(dateStr + 'T00:00:00'), 'MMM d'),
      set: dayAppts.length,
      confirmed: dayAppts.filter(a => isConfirmed(a.appointment_status)).length,
    };
  });

  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-100">
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-600 mb-4">
        Appointments Trend {snapshot_date ? `— Snapshot: ${snapshot_date}` : ''}
      </p>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={chartData} margin={{ top: 20, right: 20, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false}
            interval={Math.max(1, Math.floor(chartData.length / 10))} />
          <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={28} allowDecimals={false} />
          <Tooltip contentStyle={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }}
            labelStyle={{ fontWeight: 600, color: '#1f2937' }} />
          <Line type="linear" dataKey="set" name="Set" stroke="#3b82f6" strokeWidth={2.5}
            dot={(props) => <CustomDot key={props.index} {...props} color="#3b82f6" />} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

const STORE_COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#f97316', '#6366f1'];

function GroupDailyTable({ appointments, activeStores, showTotal = true }) {
  const uniqueDates = [...new Set(appointments.map(a => a.appointment_date))].filter(Boolean).sort();

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="text-xs w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-4 py-2 font-semibold uppercase tracking-wider text-gray-400 sticky left-0 bg-gray-50 z-10 whitespace-nowrap">Store</th>
              <th className="text-right px-3 py-2 font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap">Total</th>
              {uniqueDates.map(d => (
                <th key={d} className="text-right px-2 py-2 font-semibold text-gray-400 whitespace-nowrap min-w-[48px]">
                  {format(new Date(d + 'T00:00:00'), 'M/d')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activeStores.map((store, idx) => {
              const total = appointments.filter(a => a.dealer_id === store.dealership_key).length;
              return (
                <tr key={store.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-4 py-2 font-semibold sticky left-0 bg-white z-10 whitespace-nowrap" style={{ color: STORE_COLORS[idx % STORE_COLORS.length] }}>
                    {store.name}
                  </td>
                  <td className="px-3 py-2 text-right font-bold text-gray-700 tabular-nums">{total}</td>
                  {uniqueDates.map(d => {
                    const count = appointments.filter(a => a.dealer_id === store.dealership_key && a.appointment_date === d).length;
                    return (
                      <td key={d} className="px-2 py-2 text-right tabular-nums text-gray-600">
                        {count > 0 ? count : <span className="text-gray-200">—</span>}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
          {showTotal && (
            <tfoot>
              <tr className="border-t-2 border-gray-200 bg-gray-50">
                <td className="px-4 py-2 font-bold text-gray-700 uppercase tracking-wide sticky left-0 bg-gray-50 z-10">Total</td>
                <td className="px-3 py-2 text-right font-bold text-gray-800 tabular-nums">{appointments.length}</td>
                {uniqueDates.map(d => {
                  const count = appointments.filter(a => a.appointment_date === d).length;
                  return (
                    <td key={d} className="px-2 py-2 text-right font-bold text-gray-700 tabular-nums">
                      {count > 0 ? count : <span className="text-gray-200">—</span>}
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

export default function Appointments() {
  const { activeDealershipKeys, activeStores, selectedLabel, selectedType } = useDealer();
  const isGroup = selectedType === 'group';

  const [compare, setCompare] = useState(null);
  const [selectedDealership, setSelectedDealership] = useState(null);

  const periodOptions = buildPeriodOptions();

  const { data: apptResult = { data: [], snapshot_date: null }, isLoading } = useAppointmentSnapshots(activeDealershipKeys);
  const { data: appointments, snapshot_date } = apptResult;

  const filteredAppts = selectedDealership
    ? appointments.filter(a => a.dealer_id === selectedDealership)
    : appointments;

  if (isLoading) return (
    <div className="flex items-center justify-center h-full">
      <RefreshCw className="animate-spin text-gray-400" size={24} />
    </div>
  );

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Appointments</h1>
        {selectedLabel && <p className="text-gray-500 text-sm mt-0.5">{selectedLabel}</p>}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {COMPARE_OPTIONS.map(c => (
            <button
              key={String(c.value)}
              onClick={() => setCompare(c.value)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${compare === c.value ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {isGroup && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Store:</span>
            <select
              value={selectedDealership || 'all'}
              onChange={e => setSelectedDealership(e.target.value === 'all' ? null : e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">All Stores</option>
              {activeStores.map(s => (
                <option key={s.dealership_key} value={s.dealership_key}>{s.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <AppointmentsChart appointments={filteredAppts} snapshot_date={snapshot_date} />

      {isGroup ? (
        <GroupDailyTable appointments={selectedDealership ? filteredAppts : appointments} activeStores={selectedDealership ? activeStores.filter(s => s.dealership_key === selectedDealership) : activeStores} showTotal />
      ) : (
        <GroupDailyTable appointments={filteredAppts} activeStores={activeStores} showTotal={false} />
      )}
    </div>
  );
}