export default function LeadTypeSnapshot({ upType, newUsed, party }) {
  const cardStyle = {
    padding: '12px',
    backgroundColor: '#f9fafb',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    fontSize: '13px',
    verticalAlign: 'top',
    width: '31%',
  };

  const labelStyle = {
    fontSize: '10px',
    fontWeight: '600',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
    margin: '0 0 8px 0',
  };

  const renderItem = (item) => (
    <div key={item.label} style={{ marginBottom: '8px' }}>
      <div style={{ fontWeight: '600', color: '#111827' }}>{item.label}</div>
      <div style={{ color: '#6b7280', fontSize: '12px' }}>{item.leads} leads</div>
    </div>
  );

  const renderCol = (label, items) => (
    <>
      <p style={labelStyle}>{label}</p>
      {items.length === 0
        ? <div style={{ color: '#9ca3af', fontSize: '12px' }}>No data</div>
        : items.map(renderItem)}
    </>
  );

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
      <tbody>
        <tr style={{ verticalAlign: 'top' }}>
          <td style={{ ...cardStyle, paddingRight: '6px' }}>{renderCol('Up Type', upType)}</td>
          <td style={{ ...cardStyle, paddingLeft: '3px', paddingRight: '3px' }}>{renderCol('Inventory', newUsed)}</td>
          <td style={{ ...cardStyle, paddingLeft: '6px' }}>{renderCol('Party Type', party)}</td>
        </tr>
      </tbody>
    </table>
  );
}