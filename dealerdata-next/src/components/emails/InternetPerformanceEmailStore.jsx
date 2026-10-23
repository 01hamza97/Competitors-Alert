import { emailStyles, EmailContainer, Section } from './EmailLayout';
import { format } from 'date-fns';
import LeadTypeSnapshot from './LeadTypeSnapshot';

const fmt = (n) => (n ?? 0).toLocaleString();

const getArrowColor = (val) => val > 0 ? '#10b981' : val < 0 ? '#ef4444' : '#6b7280';
const getArrow = (val) => val > 0 ? '↑' : val < 0 ? '↓' : '→';

function KPISnapshot({ yesterdayLeads, yesterdaySold, mtdLeads, mtdSold, mtdLeadsCompare = 0, mtdSoldCompare = 0, mtdSoldPctCompare = 0 }) {
  const yesterdayClose = yesterdayLeads > 0 ? Math.round((yesterdaySold / yesterdayLeads) * 100) : 0;
  const mtdClose = mtdLeads > 0 ? Math.round((mtdSold / mtdLeads) * 100) : 0;

  const kpiCellStyle = {
    width: '33%',
    padding: '8px 6px',
    verticalAlign: 'top',
    backgroundColor: '#f9fafb',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    fontSize: '13px',
  };

  const kpiLabelStyle = {
    fontSize: '10px',
    fontWeight: '600',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
    margin: '0 0 4px 0',
    lineHeight: '1.2',
  };

  const kpiValueStyle = {
    fontSize: '22px',
    fontWeight: '700',
    margin: '0 0 2px 0',
    lineHeight: '1.1',
  };

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <tbody>
        {/* Row 1: Yesterday */}
        <tr style={{ height: '72px' }}>
          <td style={{ ...kpiCellStyle, paddingRight: '8px' }}>
            <p style={kpiLabelStyle}>Yesterday Leads</p>
            <p style={{ ...kpiValueStyle, color: '#3b82f6' }}>{fmt(yesterdayLeads)}</p>
          </td>
          <td style={{ ...kpiCellStyle, paddingLeft: '4px', paddingRight: '4px' }}>
            <p style={kpiLabelStyle}>Yesterday Sold</p>
            <p style={{ ...kpiValueStyle, color: '#10b981' }}>{fmt(yesterdaySold)}</p>
          </td>
          <td style={{ ...kpiCellStyle, paddingLeft: '8px' }}>
            <p style={kpiLabelStyle}>Yesterday Sold %</p>
            <p style={{ ...kpiValueStyle, color: '#6b7280' }}>{yesterdayClose}%</p>
          </td>
        </tr>
        {/* Row 2: MTD */}
        <tr style={{ height: '90px' }}>
          <td style={{ ...kpiCellStyle, paddingRight: '8px' }}>
            <p style={kpiLabelStyle}>MTD Leads</p>
            <p style={{ ...kpiValueStyle, color: '#3b82f6' }}>{fmt(mtdLeads)}</p>
            <p style={{ fontSize: '10px', color: getArrowColor(mtdLeadsCompare), fontWeight: '600', margin: '2px 0 0 0', lineHeight: '1.2' }}>
              {getArrow(mtdLeadsCompare)} {Math.abs(mtdLeadsCompare).toLocaleString()} VS LAST MO
            </p>
          </td>
          <td style={{ ...kpiCellStyle, paddingLeft: '4px', paddingRight: '4px' }}>
            <p style={kpiLabelStyle}>MTD Sold</p>
            <p style={{ ...kpiValueStyle, color: '#10b981' }}>{fmt(mtdSold)}</p>
            <p style={{ fontSize: '10px', color: getArrowColor(mtdSoldCompare), fontWeight: '600', margin: '2px 0 0 0', lineHeight: '1.2' }}>
              {getArrow(mtdSoldCompare)} {Math.abs(mtdSoldCompare).toLocaleString()} VS LAST MO
            </p>
          </td>
          <td style={{ ...kpiCellStyle, paddingLeft: '8px' }}>
            <p style={kpiLabelStyle}>MTD Sold %</p>
            <p style={{ ...kpiValueStyle, color: '#6b7280' }}>{mtdClose}%</p>
            <p style={{ fontSize: '10px', color: getArrowColor(mtdSoldPctCompare), fontWeight: '600', margin: '2px 0 0 0', lineHeight: '1.2' }}>
              {getArrow(mtdSoldPctCompare)} {Math.abs(mtdSoldPctCompare)}% VS LAST MO
            </p>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

function TopVendors({ vendors }) {
  const sorted = [...vendors].sort((a, b) => {
    if (b.sold !== a.sold) return b.sold - a.sold;
    return b.soldPct - a.soldPct;
  });
  const top10 = sorted.slice(0, 10);

  return (
    <table style={{ ...emailStyles.table, tableLayout: 'fixed' }}>
      <colgroup>
        <col style={{ width: '46%' }} />
        <col style={{ width: '18%' }} />
        <col style={{ width: '18%' }} />
        <col style={{ width: '18%' }} />
      </colgroup>
      <thead style={emailStyles.tableHeader}>
        <tr>
          <th style={{ ...emailStyles.tableHeaderCell, width: '46%' }}>Vendor</th>
          <th style={{ ...emailStyles.tableHeaderCell, textAlign: 'right', width: '18%' }}>Leads</th>
          <th style={{ ...emailStyles.tableHeaderCell, textAlign: 'right', width: '18%' }}>Sold</th>
          <th style={{ ...emailStyles.tableHeaderCell, textAlign: 'right', width: '18%' }}>Sold %</th>
        </tr>
      </thead>
      <tbody>
        {top10.map((v) => (
          <tr key={v.name} style={{ ...emailStyles.tableRow, verticalAlign: 'middle' }}>
            <td style={{ ...emailStyles.tableCell, width: '46%', padding: '10px 12px' }}>{v.name}</td>
            <td style={{ ...emailStyles.tableCellRight, width: '18%', padding: '10px 8px', verticalAlign: 'middle' }}>{fmt(v.leads)}</td>
            <td style={{ ...emailStyles.tableCellRight, width: '18%', padding: '10px 8px', verticalAlign: 'middle' }}>{fmt(v.sold)}</td>
            <td style={{ ...emailStyles.tableCellRight, width: '18%', padding: '10px 8px', verticalAlign: 'middle' }}>{v.soldPct}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function InternetPerformanceEmailStore({
  dealerName,
  yesterdayDate,
  yesterdayLeads,
  yesterdaySold,
  mtdLeads,
  mtdSold,
  mtdLeadsCompare = 0,
  mtdSoldCompare = 0,
  mtdSoldPctCompare = 0,
  vendors,
  upType,
  newUsed,
  party,
}) {
  const title = `${dealerName} Lead Performance Summary`;
  const dateObj = new Date(yesterdayDate + 'T12:00:00');
  const date = format(dateObj, 'MMMM d, yyyy');
  const emailDate = format(dateObj, 'MMMM d yyyy');

  return (
    <EmailContainer title={title} date={date}>
      <Section title="PERFORMANCE SNAPSHOT">
        <KPISnapshot yesterdayLeads={yesterdayLeads} yesterdaySold={yesterdaySold} mtdLeads={mtdLeads} mtdSold={mtdSold} mtdLeadsCompare={mtdLeadsCompare} mtdSoldCompare={mtdSoldCompare} mtdSoldPctCompare={mtdSoldPctCompare} />
      </Section>

      <Section title="TOP 10 VENDORS (MTD)">
        <TopVendors vendors={vendors} />
      </Section>

      <Section title="LEAD TYPE BREAKDOWN (MTD)">
        <LeadTypeSnapshot upType={upType} newUsed={newUsed} party={party} />
      </Section>
    </EmailContainer>
  );
}