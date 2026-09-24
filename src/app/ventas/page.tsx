'use client';

import { useState } from 'react';
import Link from 'next/link';

interface IssuedInvoice {
  id: string;
  clave_acceso: string;
  cliente_ruc: string;
  cliente_nombre: string;
  fecha_emision: string;
  valor_sin_impuestos: string;
  iva: string;
  tipo_comprobante: string;
  classification_status: 'classified' | 'pending';
  result_key?: string;
}

const mockInvoices: IssuedInvoice[] = [
  {
    id: 'issued-001',
    clave_acceso: '150820261010000000003001000000000003456789012',
    cliente_ruc: '1800000000',
    cliente_nombre: 'Cliente ABC Corp',
    fecha_emision: '2026-08-15',
    valor_sin_impuestos: '3000.00',
    iva: '600.00',
    tipo_comprobante: '01',
    classification_status: 'classified',
    result_key: 'SALES_TAXED',
  },
  {
    id: 'issued-002',
    clave_acceso: '200820261010000000004002000000000004567890123',
    cliente_ruc: '1900000000',
    cliente_nombre: 'Cliente XYZ Ltd',
    fecha_emision: '2026-08-20',
    valor_sin_impuestos: '5000.00',
    iva: '0.00',
    tipo_comprobante: '01',
    classification_status: 'pending',
  },
];

export default function VentasPage() {
  const [invoices, setInvoices] = useState<IssuedInvoice[]>(mockInvoices);
  const [filter, setFilter] = useState<'all' | 'classified' | 'pending'>('all');

  const filteredInvoices = invoices.filter(inv => {
    if (filter === 'all') return true;
    return inv.classification_status === filter;
  });

  const classifiedCount = invoices.filter(
    inv => inv.classification_status === 'classified'
  ).length;
  const pendingCount = invoices.filter(
    inv => inv.classification_status === 'pending'
  ).length;

  const resultKeyLabel: Record<string, string> = {
    SALES_TAXED: '1005 — Taxed Sales',
    SALES_ZERO_NO_CREDIT: '1006 — Zero Sales, No Credit',
    SALES_ZERO_WITH_CREDIT: '1007 — Zero Sales, With Credit',
    EXPORT_GOODS: '1008 — Exports (Goods)',
    EXPORT_SERVICES: '1009 — Exports (Services)',
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <Link href="/" style={styles.backLink}>← Back</Link>
        <h1>Ventas Emitidas — Issued Invoices</h1>
      </header>

      <main style={styles.main}>
        <section style={styles.section}>
          <div style={styles.statsGrid}>
            <div style={styles.statCard}>
              <div style={styles.statValue}>{invoices.length}</div>
              <div style={styles.statLabel}>Total Invoices</div>
            </div>
            <div style={styles.statCard}>
              <div style={{...styles.statValue, color: '#2e7d32'}}>
                {classifiedCount}
              </div>
              <div style={styles.statLabel}>Classified</div>
            </div>
            <div style={styles.statCard}>
              <div style={{...styles.statValue, color: '#e65100'}}>
                {pendingCount}
              </div>
              <div style={styles.statLabel}>Pending Review</div>
            </div>
          </div>
        </section>

        <section style={styles.section}>
          <div style={styles.filterBar}>
            <label style={styles.filterLabel}>
              Filter:
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as any)}
                style={styles.select}
              >
                <option value="all">All ({invoices.length})</option>
                <option value="classified">Classified ({classifiedCount})</option>
                <option value="pending">Pending ({pendingCount})</option>
              </select>
            </label>
          </div>

          {filteredInvoices.length === 0 ? (
            <div style={styles.emptyState}>
              <p>No invoices found in this filter</p>
            </div>
          ) : (
            <div style={styles.tableContainer}>
              <table style={styles.table}>
                <thead>
                  <tr style={styles.tableHeader}>
                    <th>Date</th>
                    <th>Client</th>
                    <th style={{ textAlign: 'right' }}>Subtotal</th>
                    <th style={{ textAlign: 'right' }}>VAT</th>
                    <th>Classification</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.map(invoice => (
                    <tr key={invoice.id} style={styles.tableRow}>
                      <td style={styles.td}>{invoice.fecha_emision}</td>
                      <td style={styles.td}>
                        <div>
                          <strong>{invoice.cliente_nombre}</strong>
                          <br />
                          <small style={{ color: '#999' }}>
                            RUC: {invoice.cliente_ruc}
                          </small>
                        </div>
                      </td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>
                        ${parseFloat(invoice.valor_sin_impuestos).toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>
                        <strong>${parseFloat(invoice.iva).toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}</strong>
                      </td>
                      <td style={styles.td}>
                        {invoice.result_key ? (
                          <span style={styles.badge}>
                            {resultKeyLabel[invoice.result_key] || invoice.result_key}
                          </span>
                        ) : (
                          <span style={{...styles.badge, ...styles.badgePending}}>
                            Pending
                          </span>
                        )}
                      </td>
                      <td style={styles.td}>
                        <div
                          style={{
                            display: 'inline-block',
                            width: '12px',
                            height: '12px',
                            borderRadius: '50%',
                            backgroundColor:
                              invoice.classification_status === 'classified'
                                ? '#2e7d32'
                                : '#e65100',
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {pendingCount > 0 && (
          <section style={styles.section}>
            <div style={styles.infoBox}>
              <p>
                ℹ️ You have <strong>{pendingCount}</strong> invoice
                {pendingCount !== 1 ? 's' : ''} awaiting classification.
              </p>
              <Link href="/conciliacion" style={styles.button}>
                Go to Manual Classification →
              </Link>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f9f9f9',
  } as React.CSSProperties,

  header: {
    backgroundColor: '#fff',
    borderBottom: '1px solid #e0e0e0',
    padding: '1.5rem',
    marginBottom: '2rem',
  } as React.CSSProperties,

  backLink: {
    color: '#0066cc',
    textDecoration: 'none',
    marginBottom: '1rem',
    display: 'inline-block',
  } as React.CSSProperties,

  main: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '0 1.5rem 2rem',
  } as React.CSSProperties,

  section: {
    marginBottom: '2rem',
  } as React.CSSProperties,

  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '1rem',
  } as React.CSSProperties,

  statCard: {
    backgroundColor: '#fff',
    border: '1px solid #e0e0e0',
    borderRadius: '8px',
    padding: '1.5rem',
    textAlign: 'center',
  } as React.CSSProperties,

  statValue: {
    fontSize: '2rem',
    fontWeight: '700',
    color: '#0066cc',
    marginBottom: '0.5rem',
  } as React.CSSProperties,

  statLabel: {
    color: '#666',
    fontSize: '0.875rem',
  } as React.CSSProperties,

  filterBar: {
    marginBottom: '1.5rem',
  } as React.CSSProperties,

  filterLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  } as React.CSSProperties,

  select: {
    padding: '0.5rem',
    border: '1px solid #ccc',
    borderRadius: '4px',
    fontSize: '1rem',
  } as React.CSSProperties,

  emptyState: {
    backgroundColor: '#fff',
    border: '1px solid #e0e0e0',
    borderRadius: '8px',
    padding: '2rem',
    textAlign: 'center',
    color: '#999',
  } as React.CSSProperties,

  tableContainer: {
    backgroundColor: '#fff',
    border: '1px solid #e0e0e0',
    borderRadius: '8px',
    overflow: 'hidden',
  } as React.CSSProperties,

  table: {
    width: '100%',
    borderCollapse: 'collapse',
  } as React.CSSProperties,

  tableHeader: {
    backgroundColor: '#f5f5f5',
    borderBottom: '2px solid #e0e0e0',
  } as React.CSSProperties,

  tableRow: {
    borderBottom: '1px solid #f0f0f0',
  } as React.CSSProperties,

  td: {
    padding: '1rem',
  } as React.CSSProperties,

  badge: {
    backgroundColor: '#e3f2fd',
    color: '#1565c0',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '0.75rem',
    fontWeight: '500',
  } as React.CSSProperties,

  badgePending: {
    backgroundColor: '#fff3e0',
    color: '#e65100',
  } as React.CSSProperties,

  infoBox: {
    backgroundColor: '#e3f2fd',
    border: '1px solid #1565c0',
    borderRadius: '8px',
    padding: '1.5rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  } as React.CSSProperties,

  button: {
    backgroundColor: '#0066cc',
    color: '#fff',
    padding: '0.75rem 1.5rem',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: '500',
    textDecoration: 'none',
    display: 'inline-block',
  } as React.CSSProperties,
};
