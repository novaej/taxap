'use client';

import { useState } from 'react';
import Link from 'next/link';

interface UnclassifiedInvoice {
  id: string;
  clave_acceso: string;
  ruc_emisor: string;
  razon_social: string;
  fecha_emision: string;
  valor_sin_impuestos: string;
  iva: string;
  tipo_comprobante: string;
  reason_unclassified: string;
}

const mockInvoices: UnclassifiedInvoice[] = [
  {
    id: 'inv-001',
    clave_acceso: '150820261010000000001001000000000001234567890',
    ruc_emisor: '1000000000',
    razon_social: 'Supplier ABC S.A.',
    fecha_emision: '2026-08-15',
    valor_sin_impuestos: '1000.00',
    iva: '200.00',
    tipo_comprobante: '01',
    reason_unclassified: 'No supplier rule found; below confidence threshold',
  },
  {
    id: 'inv-002',
    clave_acceso: '200820261010000000002002000000000002345678901',
    ruc_emisor: '2000000000',
    razon_social: 'Supplier XYZ Ltd.',
    fecha_emision: '2026-08-20',
    valor_sin_impuestos: '2500.00',
    iva: '500.00',
    tipo_comprobante: '03',
    reason_unclassified: 'Multiple possible classifications; manual decision needed',
  },
];

export default function ConciliacionPage() {
  const [invoices, setInvoices] = useState<UnclassifiedInvoice[]>(mockInvoices);
  const [selectedInvoice, setSelectedInvoice] = useState<UnclassifiedInvoice | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  const resultKeys = [
    { key: 'SALES_TAXED', label: '1005 — Taxed Sales', type: 'SALES' },
    { key: 'SALES_ZERO_NO_CREDIT', label: '1006 — Zero Sales, No Credit', type: 'SALES' },
    { key: 'SALES_ZERO_WITH_CREDIT', label: '1007 — Zero Sales, With Credit', type: 'SALES' },
    { key: 'EXPORT_GOODS', label: '1008 — Exports (Goods)', type: 'SALES' },
    { key: 'EXPORT_SERVICES', label: '1009 — Exports (Services)', type: 'SALES' },
    { key: 'PURCHASES_WITH_CREDIT', label: '500 — Purchases With Credit', type: 'PURCHASES' },
    { key: 'PURCHASES_NO_CREDIT', label: '502 — Purchases No Credit', type: 'PURCHASES' },
    { key: 'PURCHASES_ZERO_VAT', label: '507 — Zero-VAT Purchases', type: 'PURCHASES' },
  ];

  const handleClassify = async (invoiceId: string) => {
    if (!selectedCategory) {
      alert('Please select a classification');
      return;
    }

    try {
      const response = await fetch(
        `/api/invoices/received/${invoiceId}/classify`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': 'user-1',
          },
          body: JSON.stringify({
            result_key: selectedCategory,
            classifier: 'manual',
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Classification failed');
      }

      // Remove from list
      setInvoices(invoices.filter(i => i.id !== invoiceId));
      setSelectedInvoice(null);
      setSelectedCategory('');

      alert(`✓ Invoice classified as ${selectedCategory}`);
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <Link href="/" style={styles.backLink}>← Back</Link>
        <h1>Conciliación — Manual Classification</h1>
        <p style={styles.subtitle}>
          {invoices.length} unclassified invoice{invoices.length !== 1 ? 's' : ''}
        </p>
      </header>

      <main style={styles.main}>
        {invoices.length === 0 ? (
          <div style={styles.emptyState}>
            <p style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>✓ All invoices classified!</p>
            <Link href="/predeclaracion" style={styles.button}>
              Proceed to Pre-declaración →
            </Link>
          </div>
        ) : (
          <div style={styles.gridLayout}>
            <div style={styles.invoiceList}>
              <h2>Unclassified Invoices</h2>
              {invoices.map((invoice) => (
                <div
                  key={invoice.id}
                  style={{
                    ...styles.invoiceCard,
                    backgroundColor: selectedInvoice?.id === invoice.id ? '#e3f2fd' : '#fff',
                  }}
                  onClick={() => {
                    setSelectedInvoice(invoice);
                    setSelectedCategory('');
                  }}
                >
                  <div style={styles.invoiceCardHeader}>
                    <strong>{invoice.razon_social}</strong>
                    <span style={styles.invoiceDate}>{invoice.fecha_emision}</span>
                  </div>
                  <div style={styles.invoiceCardBody}>
                    <p><small>RUC: {invoice.ruc_emisor}</small></p>
                    <p><small>VAT: ${invoice.iva}</small></p>
                  </div>
                  <div style={styles.invoiceReason}>
                    <small style={{ color: '#666' }}>
                      {invoice.reason_unclassified}
                    </small>
                  </div>
                </div>
              ))}
            </div>

            {selectedInvoice && (
              <div style={styles.classificationPanel}>
                <h2>Classify</h2>

                <div style={styles.invoiceDetails}>
                  <div style={styles.detailRow}>
                    <span>Access Key:</span>
                    <code style={styles.code}>{selectedInvoice.clave_acceso}</code>
                  </div>
                  <div style={styles.detailRow}>
                    <span>Supplier:</span>
                    <strong>{selectedInvoice.razon_social}</strong>
                  </div>
                  <div style={styles.detailRow}>
                    <span>Date:</span>
                    <span>{selectedInvoice.fecha_emision}</span>
                  </div>
                  <div style={styles.detailRow}>
                    <span>Subtotal:</span>
                    <span>${selectedInvoice.valor_sin_impuestos}</span>
                  </div>
                  <div style={styles.detailRow}>
                    <span>VAT:</span>
                    <strong>${selectedInvoice.iva}</strong>
                  </div>
                </div>

                <div style={styles.categorySection}>
                  <h3>Select Classification</h3>

                  <div style={styles.categoryGroup}>
                    <h4>📥 Purchases</h4>
                    {resultKeys
                      .filter(k => k.type === 'PURCHASES')
                      .map(key => (
                        <label key={key.key} style={styles.radioLabel}>
                          <input
                            type="radio"
                            name="classification"
                            value={key.key}
                            checked={selectedCategory === key.key}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                            style={styles.radio}
                          />
                          {key.label}
                        </label>
                      ))}
                  </div>

                  <div style={styles.categoryGroup}>
                    <h4>📤 Sales</h4>
                    {resultKeys
                      .filter(k => k.type === 'SALES')
                      .map(key => (
                        <label key={key.key} style={styles.radioLabel}>
                          <input
                            type="radio"
                            name="classification"
                            value={key.key}
                            checked={selectedCategory === key.key}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                            style={styles.radio}
                          />
                          {key.label}
                        </label>
                      ))}
                  </div>
                </div>

                <button
                  onClick={() => handleClassify(selectedInvoice.id)}
                  disabled={!selectedCategory}
                  style={{
                    ...styles.button,
                    opacity: !selectedCategory ? 0.6 : 1,
                    width: '100%',
                    marginTop: '1.5rem',
                  }}
                >
                  Confirm Classification
                </button>
              </div>
            )}
          </div>
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

  subtitle: {
    color: '#666',
    marginTop: '0.5rem',
  } as React.CSSProperties,

  main: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '0 1.5rem 2rem',
  } as React.CSSProperties,

  emptyState: {
    textAlign: 'center',
    padding: '3rem 2rem',
    backgroundColor: '#e8f5e9',
    borderRadius: '8px',
  } as React.CSSProperties,

  gridLayout: {
    display: 'grid',
    gridTemplateColumns: '1fr 450px',
    gap: '2rem',
  } as React.CSSProperties,

  invoiceList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  } as React.CSSProperties,

  invoiceCard: {
    backgroundColor: '#fff',
    border: '1px solid #e0e0e0',
    borderRadius: '8px',
    padding: '1rem',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  } as React.CSSProperties,

  invoiceCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '0.5rem',
  } as React.CSSProperties,

  invoiceDate: {
    color: '#999',
    fontSize: '0.875rem',
  } as React.CSSProperties,

  invoiceCardBody: {
    color: '#666',
    fontSize: '0.875rem',
    marginBottom: '0.5rem',
  } as React.CSSProperties,

  invoiceReason: {
    paddingTop: '0.5rem',
    borderTop: '1px solid #f0f0f0',
  } as React.CSSProperties,

  classificationPanel: {
    backgroundColor: '#fff',
    border: '1px solid #e0e0e0',
    borderRadius: '8px',
    padding: '1.5rem',
    height: 'fit-content',
    position: 'sticky',
    top: '1.5rem',
  } as React.CSSProperties,

  invoiceDetails: {
    backgroundColor: '#f9f9f9',
    border: '1px solid #e0e0e0',
    borderRadius: '4px',
    padding: '1rem',
    marginBottom: '1.5rem',
  } as React.CSSProperties,

  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    paddingBottom: '0.5rem',
    marginBottom: '0.5rem',
    borderBottom: '1px solid #f0f0f0',
    fontSize: '0.875rem',
  } as React.CSSProperties,

  code: {
    backgroundColor: '#f0f0f0',
    padding: '2px 4px',
    borderRadius: '2px',
    fontSize: '0.75rem',
    fontFamily: 'monospace',
  } as React.CSSProperties,

  categorySection: {
    marginBottom: '1.5rem',
  } as React.CSSProperties,

  categoryGroup: {
    marginBottom: '1rem',
  } as React.CSSProperties,

  radioLabel: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '0.5rem',
    cursor: 'pointer',
    fontSize: '0.875rem',
  } as React.CSSProperties,

  radio: {
    marginRight: '0.5rem',
    cursor: 'pointer',
  } as React.CSSProperties,

  button: {
    backgroundColor: '#0066cc',
    color: '#fff',
    padding: '0.75rem 1.5rem',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: '500',
  } as React.CSSProperties,
};
