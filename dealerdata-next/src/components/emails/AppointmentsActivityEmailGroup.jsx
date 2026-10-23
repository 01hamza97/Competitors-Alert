import { emailStyles, EmailContainer, Section } from './EmailLayout';
import { format } from 'date-fns';

const fmt = (n) => (n ?? 0).toLocaleString();

function TomorrowAppointments({ dealers }) {
  const sorted = [...dealers].sort((a, b) => b.appointments - a.appointments);

  return (
    <table style={{ ...emailStyles.table, tableLayout: 'auto' }}>
      <colgroup>
        <col style={{ width: 'auto' }} />
        <col style={{ width: '100px' }} />
      </colgroup>
      <thead style={emailStyles.tableHeader}>
        <tr>
          <th style={{ ...emailStyles.tableHeaderCell, textAlign: 'left' }}>Store</th>
          <th style={{ ...emailStyles.tableHeaderCell, textAlign: 'right', whiteSpace: 'nowrap' }}>Tomorrow Appts</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((d, i) => (
          <tr key={d.id} style={{ ...emailStyles.tableRow, verticalAlign: 'middle' }}>
            <td style={{ ...emailStyles.tableCell, padding: '12px' }}>{d.name}</td>
            <td style={{ ...emailStyles.tableCellRight, padding: '12px', fontWeight: '700', color: '#111827', whiteSpace: 'nowrap', verticalAlign: 'middle', width: '100px', textAlign: 'right' }}>
              {fmt(d.appointments)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ActivityRanking({ dealers }) {
  const getActivityColor = (total) => {
    if (total >= 90) return '#10b981';
    if (total <= 20) return '#ef4444';
    return '#1f2937';
  };

  const sorted = [...dealers].sort((a, b) => b.totalActivity - a.totalActivity);

  return (
    <table style={{ ...emailStyles.table, tableLayout: 'fixed' }}>
      <colgroup>
        <col style={{ width: '50%' }} />
        <col style={{ width: '12.5%' }} />
        <col style={{ width: '12.5%' }} />
        <col style={{ width: '12.5%' }} />
        <col style={{ width: '12.5%' }} />
      </colgroup>
      <thead style={emailStyles.tableHeader}>
        <tr>
          <th style={{ ...emailStyles.tableHeaderCell, width: '50%' }}>Store</th>
          <th style={{ ...emailStyles.tableHeaderCell, textAlign: 'right', width: '12.5%', padding: '8px 4px' }}>Tot.</th>
          <th style={{ ...emailStyles.tableHeaderCell, textAlign: 'right', width: '12.5%', padding: '8px 4px' }}>Calls</th>
          <th style={{ ...emailStyles.tableHeaderCell, textAlign: 'right', width: '12.5%', padding: '8px 4px' }}>Emails</th>
          <th style={{ ...emailStyles.tableHeaderCell, textAlign: 'right', width: '12.5%', padding: '8px 4px' }}>Texts</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((d, i) => (
          <tr key={d.id} style={{ ...emailStyles.tableRow, verticalAlign: 'middle' }}>
            <td style={{ ...emailStyles.tableCell, width: '50%', padding: '10px 12px' }}>{d.name}</td>
            <td
              style={{
                ...emailStyles.tableCellRight,
                fontWeight: '700',
                color: getActivityColor(d.totalActivity),
                width: '12.5%',
                padding: '10px 4px',
                whiteSpace: 'nowrap',
                verticalAlign: 'middle',
              }}
            >
              {fmt(d.totalActivity)}
            </td>
            <td style={{ ...emailStyles.tableCellRight, width: '12.5%', padding: '10px 4px', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>{fmt(d.calls)}</td>
            <td style={{ ...emailStyles.tableCellRight, width: '12.5%', padding: '10px 4px', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>{fmt(d.emails)}</td>
            <td style={{ ...emailStyles.tableCellRight, width: '12.5%', padding: '10px 4px', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>{fmt(d.texts)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function LowActivityAlerts({ alerts }) {
  if (!alerts || alerts.length === 0) return null;

  return (
    <div>
      {alerts.map((alert, i) => (
        <div
          key={i}
          style={{
            ...emailStyles.bulletPoint,
            color: '#ef4444',
            fontWeight: '500',
          }}
        >
          ⚠ {alert}
        </div>
      ))}
    </div>
  );
}

export default function AppointmentsActivityEmailGroup({
  groupName,
  reportDate,
  dealers,
  alerts,
}) {
  const title = `${groupName} Appointments & Activity`;
  const dateObj = new Date(reportDate);
  const date = format(dateObj, 'MMMM d, yyyy');
  const emailDate = format(dateObj, 'MMMM d yyyy');

  return (
    <EmailContainer title={title} date={date}>
      <Section title="FUTURE APPOINTMENTS">
        <TomorrowAppointments dealers={dealers} />
      </Section>

      <Section title="PRIOR DAY ACTIVITIES">
        <ActivityRanking dealers={dealers} />
      </Section>

      {alerts && alerts.length > 0 && (
        <Section title="ACTIVITY ALERTS">
          <LowActivityAlerts alerts={alerts} />
        </Section>
      )}
    </EmailContainer>
  );
}