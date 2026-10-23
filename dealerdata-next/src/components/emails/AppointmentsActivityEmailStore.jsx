import { emailStyles, EmailContainer, Section } from './EmailLayout';
import { format } from 'date-fns';

const fmt = (n) => (n ?? 0).toLocaleString();

function UpcomingAppointments({ dealerName, appointmentRows, appointmentsDays }) {
  // Show appointments by day (next 7 days)
  if (appointmentsDays && appointmentsDays.length > 0) {
    return (
      <table style={{ ...emailStyles.table, tableLayout: 'auto' }}>
        <colgroup>
          <col style={{ width: 'auto' }} />
          <col style={{ width: '100px' }} />
        </colgroup>
        <thead style={emailStyles.tableHeader}>
          <tr>
            <th style={{ ...emailStyles.tableHeaderCell, textAlign: 'left' }}>Date</th>
            <th style={{ ...emailStyles.tableHeaderCell, textAlign: 'right', whiteSpace: 'nowrap' }}>Appointments</th>
          </tr>
        </thead>
        <tbody>
          {appointmentsDays.map((day, i) => (
            <tr key={day.date} style={{...emailStyles.tableRow, verticalAlign: 'middle' }}>
              <td style={{ ...emailStyles.tableCell, padding: '12px' }}>{day.date}</td>
              <td style={{ ...emailStyles.tableCellRight, padding: '12px', fontWeight: '700', whiteSpace: 'nowrap', verticalAlign: 'middle', width: '100px', textAlign: 'right' }}>{day.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  const row = appointmentRows && appointmentRows.length > 0 ? appointmentRows[0] : null;
  const total = row?.total_appts || row?.appointments || 0;

  if (!row) {
    return <p style={{ color: '#6b7280', fontSize: '13px' }}>No appointment data available.</p>;
  }

  return (
    <table style={{ ...emailStyles.table, tableLayout: 'auto' }}>
      <colgroup>
        <col style={{ width: 'auto' }} />
        <col style={{ width: '100px' }} />
      </colgroup>
      <thead style={emailStyles.tableHeader}>
        <tr>
          <th style={{ ...emailStyles.tableHeaderCell, textAlign: 'left' }}>Upcoming Total</th>
          <th style={{...emailStyles.tableHeaderCell, textAlign: 'right', whiteSpace: 'nowrap'}}>Count</th>
        </tr>
      </thead>
      <tbody>
        <tr style={emailStyles.tableRow}>
          <td style={{ ...emailStyles.tableCell, padding: '12px' }}>{dealerName}</td>
          <td style={{ ...emailStyles.tableCellRight, padding: '12px', fontWeight: '700', whiteSpace: 'nowrap', verticalAlign: 'middle', width: '100px', textAlign: 'right' }}>{total}</td>
        </tr>
      </tbody>
    </table>
  );
}

function SalespeopleActivity({ salespeople }) {
  const active = salespeople.filter(s => s.total > 0).sort((a, b) => b.total - a.total);
  const hasSoldPct = active.some(s => s.soldPct !== undefined);

  // Give name column more room on mobile; numeric cols compact
  const numericColWidth = hasSoldPct ? '13%' : '15%';
  const nameColWidth = hasSoldPct ? '35%' : '40%';

  const numericCellStyle = {
    ...emailStyles.tableCellRight,
    padding: '10px 8px',
    whiteSpace: 'nowrap',
    verticalAlign: 'middle',
    width: numericColWidth,
  };

  const numericHeaderStyle = {
    ...emailStyles.tableHeaderCell,
    textAlign: 'right',
    whiteSpace: 'nowrap',
    width: numericColWidth,
    padding: '8px 4px',
  };

  return (
    <table style={{ ...emailStyles.table, tableLayout: 'fixed' }}>
      <colgroup>
        <col style={{ width: nameColWidth }} />
        <col style={{ width: numericColWidth }} />
        <col style={{ width: numericColWidth }} />
        <col style={{ width: numericColWidth }} />
        <col style={{ width: numericColWidth }} />
        {hasSoldPct && <col style={{ width: numericColWidth }} />}
      </colgroup>
      <thead style={emailStyles.tableHeader}>
        <tr>
          <th style={{ ...emailStyles.tableHeaderCell, width: nameColWidth, padding: '8px 12px' }}>Salesperson</th>
          <th style={numericHeaderStyle}>Calls</th>
          <th style={numericHeaderStyle}>Emails</th>
          <th style={numericHeaderStyle}>Texts</th>
          <th style={numericHeaderStyle}>Tot.</th>
          {hasSoldPct && <th style={numericHeaderStyle}>Sold%</th>}
        </tr>
      </thead>
      <tbody>
        {active.map((s) => (
          <tr key={s.name} style={{ ...emailStyles.tableRow, verticalAlign: 'middle' }}>
            <td style={{ ...emailStyles.tableCell, width: nameColWidth, padding: '10px 12px' }}>{s.name}</td>
            <td style={numericCellStyle}>{fmt(s.calls)}</td>
            <td style={numericCellStyle}>{fmt(s.emails)}</td>
            <td style={numericCellStyle}>{fmt(s.texts)}</td>
            <td style={{ ...numericCellStyle, fontWeight: '700' }}>{fmt(s.total)}</td>
            {hasSoldPct && (
              <td style={numericCellStyle}>{s.soldPct || '—'}%</td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function AppointmentsActivityEmailStore({
  dealerName,
  reportDate,
  appointmentsDays,
  appointmentRows,
  salespeople,
}) {
  const title = `${dealerName} Appointments & Activity`;
  const dateObj = new Date(reportDate);
  const date = format(dateObj, 'MMMM d, yyyy');
  const emailDate = format(dateObj, 'MMMM d yyyy');

  return (
    <EmailContainer title={title} date={date}>
      <Section title="FUTURE APPOINTMENTS">
        <UpcomingAppointments
          dealerName={dealerName}
          appointmentRows={appointmentRows || []}
          appointmentsDays={appointmentsDays || []}
        />
      </Section>

      <Section title="PRIOR DAY ACTIVITIES">
        <SalespeopleActivity salespeople={salespeople} />
      </Section>
    </EmailContainer>
  );
}