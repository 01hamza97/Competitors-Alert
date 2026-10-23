export const emailStyles = {
  container: {
    fontFamily: 'Segoe UI, Roboto, sans-serif',
    fontSize: '15px',
    lineHeight: '1.6',
    color: '#1f2937',
    maxWidth: '600px',
    margin: '0 auto',
    padding: '0',
    backgroundColor: '#f9fafb',
  },
  header: {
    backgroundColor: '#ffffff',
    padding: '32px 24px',
    borderBottom: '1px solid #e5e7eb',
  },
  title: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#111827',
    margin: '0 0 6px 0',
  },
  subtitle: {
    fontSize: '13px',
    color: '#6b7280',
    margin: '0',
  },
  section: {
    backgroundColor: '#ffffff',
    margin: '16px',
    padding: '24px',
    borderRadius: '12px',
    border: '1px solid #e5e7eb',
  },
  sectionTitle: {
    fontSize: '12px',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: '#6b7280',
    margin: '0 0 16px 0',
  },
  kpiRow: {
    display: 'flex',
    gap: '16px',
    marginBottom: '16px',
  },
  kpiCard: {
    flex: 1,
    padding: '16px',
    backgroundColor: '#f9fafb',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
  },
  kpiLabel: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
    margin: '0 0 8px 0',
  },
  kpiValue: {
    fontSize: '32px',
    fontWeight: '700',
    margin: '0 0 4px 0',
  },
  kpiMuted: {
    fontSize: '13px',
    color: '#9ca3af',
    margin: '0',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '14px',
  },
  tableHeader: {
    backgroundColor: '#f9fafb',
    borderBottom: '2px solid #e5e7eb',
  },
  tableHeaderCell: {
    padding: '12px 8px',
    textAlign: 'left',
    fontSize: '12px',
    fontWeight: '600',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
  },
  tableRow: {
    borderBottom: '1px solid #f3f4f6',
  },
  tableCell: {
    padding: '12px 8px',
    color: '#1f2937',
  },
  tableCellRight: {
    padding: '12px 8px',
    textAlign: 'right',
    color: '#1f2937',
    fontVariantNumeric: 'tabular-nums',
  },
  medal: {
    marginRight: '6px',
  },
  footer: {
    backgroundColor: '#ffffff',
    padding: '24px',
    borderTop: '1px solid #e5e7eb',
    textAlign: 'center',
    fontSize: '12px',
    color: '#9ca3af',
    margin: '16px',
    borderRadius: '12px',
  },
  bulletPoint: {
    margin: '8px 0',
    paddingLeft: '20px',
  },
};

export function EmailContainer({ children, title, date }) {
  return (
    <div data-email-preview style={{ width: '100%', margin: '0', padding: '0', backgroundColor: '#f9fafb' }}>
      <table width="100%" style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#f9fafb' }}>
        <tbody>
          <tr>
            <td align="center" style={{ padding: '0', margin: '0' }}>
              <div style={{ maxWidth: '680px', width: '100%', margin: '0 auto', backgroundColor: '#f9fafb' }}>
                <div style={emailStyles.header}>
                  <h1 style={emailStyles.title}>{title}</h1>
                  <p style={emailStyles.subtitle}>{date}</p>
                </div>
                {children}
                <div style={emailStyles.footer}>
                  <p style={{ margin: '0' }}>This is an automated report. </p>
                  <p style={{ margin: '4px 0 0 0' }}>
                    <a href="#" style={{ color: '#3b82f6', textDecoration: 'none' }}>Manage email preferences</a> · 
                    <a href="#" style={{ color: '#3b82f6', textDecoration: 'none', marginLeft: '6px' }}>View in dashboard</a>
                  </p>
                </div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function Section({ title, children }) {
  return (
    <div style={emailStyles.section}>
      {title && <h2 style={emailStyles.sectionTitle}>{title}</h2>}
      {children}
    </div>
  );
}