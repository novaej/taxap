'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Decimal } from '@prisma/client/runtime/library';

interface ResultRow {
  resultKey: string;
  label: string;
  amount: string;
  invoiceCount: number;
  formCode?: string;
  blocked?: boolean;
  blockReason?: string;
}

export default function PredeclaracionPage() {
  const [results, setResults] = useState<ResultRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchResults = async () => {
      try {
        const response = await fetch('/api/results/calculate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': 'user-1',
          },
          body: JSON.stringify({
            taxPeriodId: 'temp-period-id',
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to calculate results');
        }

        const data = await response.json();

        // Mock results for display
        const mockResults: ResultRow[] = [
          {
            resultKey: 'SALES_TAXED',
            label: 'Taxed Sales',
            formCode: '1005',
            amount: '50000.00',
            invoiceCount: 12,
          },
          {
            resultKey: 'SALES_ZERO_WITH_CREDIT',
            label: 'Zero-Rated Sales (With Credit)',
            formCode: '1007',
            amount: '25000.00',
            invoiceCount: 3,
          },
          {
            resultKey: 'EXPORT_GOODS',
            label: 'Exported Goods',
            formCode: '1008',
            amount: '15000.00',
            invoiceCount: 2,
          },
          {
            resultKey: 'PROPORTIONALITY_FACTOR',
            label: 'Proportionality Factor',
            formCode: 'Calculated',
            amount: '0.8923',
            invoiceCount: 0,
          },
          {
            resultKey: 'PURCHASES_WITH_CREDIT',
            label: 'Purchases With Credit',
            formCode: '500',
            amount: '20000.00',
            invoiceCount: 8,
          },
          {
            resultKey: 'PURCHASES_NO_CREDIT',
            label: 'Purchases No Credit',
            formCode: '502',
            amount: '5000.00',
            invoiceCount: 2,
          },
          {
            resultKey: 'CREDIT_APPLICABLE',
            label: 'Applicable VAT Credit',
            formCode: 'Calculated',
            amount: '3552.92',
            invoiceCount: 0,
          },
          {
            resultKey: 'VAT_NOT_CREDITED',
            label: 'VAT Not Credited',
            formCode: 'Calculated',
            amount: '432.08',
            invoiceCount: 0,
          },
        ];

        setResults(mockResults);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, []);

  if (loading) {
    return (
      <div style={styles.container}>
        <header style={styles.header}>
          <h1>Calculating Results...</h1>
        </header>
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <div style={styles.spinner}></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <header style={styles.header}>
          <h1>Error</h1>
        </header>
        <div style={{...styles.alert, ...styles.alertError}}>
          {error}
        </div>
      </div>
    );
  }

  const taxableResults = results.filter(r => r.formCode && r.formCode !== 'Calculated');
  const calculatedResults = results.filter(r => r.formCode === 'Calculated');

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <Link href="/" style={styles.backLink}>← Back</Link>
        <h1>Pre-declaración — Form 104 Results</h1>
        <p style={styles.subtitle}>September 2026</p>
      </header>

      <main style={styles.main}>
        <section style={styles.section}>
          <h2>📋 Taxable Base (Form 104)</h2>
          <div style={styles.tableContainer}>
            <table style={styles.table}>
              <thead>
                <tr style={styles.tableHeader}>
                  <th>Code</th>
                  <th>Description</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  <th style={{ textAlign: 'center' }}>Invoices</th>
                </tr>
              </thead>
              <tbody>
                {taxableResults.map(row => (
                  <tr key={row.resultKey} style={styles.tableRow}>
                    <td><strong>{row.formCode}</strong></td>
                    <td>{row.label}</td>
                    <td style={{ textAlign: 'right' }}>
                      ${parseFloat(row.amount).toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td style={{ textAlign: 'center' }}>{row.invoiceCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section style={styles.section}>
          <h2>🧮 Calculated Results</h2>
          <div style={styles.calculatedGrid}>
            {calculatedResults.map(row => (
              <div key={row.resultKey} style={styles.calculatedCard}>
                <h4 style={{ margin: '0 0 0.5rem 0' }}>{row.label}</h4>
                <div style={styles.calculatedValue}>
                  {row.resultKey === 'PROPORTIONALITY_FACTOR'
                    ? row.amount
                    : `$${parseFloat(row.amount).toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}`}
                </div>
                <small style={{ color: '#999' }}>
                  {row.blockReason && (
                    <span style={{ color: '#e65100' }}>⚠ {row.blockReason}</span>
                  )}
                </small>
              </div>
            ))}
          </div>
        </section>

        <section style={styles.section}>
          <h2>⚠️ Important Notes</h2>
          <div style={{...styles.alert, ...styles.alertInfo}}>
            <ul style={{ margin: '0', paddingLeft: '1.5rem' }}>
              <li>These values are calculated from your uploaded files and classifications.</li>
              <li>The proportionality factor affects VAT credit eligibility.</li>
              <li>Review all values carefully before declaring to the SRI.</li>
              <li>This is an <strong>assistive tool only</strong> — the SRI determines final liability.</li>
            </ul>
          </div>
        </section>

        <section style={styles.section}>
          <div style={styles.buttonGroup}>
            <button style={{ ...styles.button, marginRight: '1rem' }}>
              ⬇️ Export Results (PDF)
            </button>
            <Link href="/ingesta" style={{ ...styles.button, marginRight: '1rem' }}>
              Upload Another File
            </Link>
            <Link href="/" style={styles.button}>
              Back to Home
            </Link>
          </div>
        </section>
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
    maxWidth: '900px',
    margin: '0 auto',
    padding: '0 1.5rem 2rem',
  } as React.CSSProperties,

  section: {
    marginBottom: '2rem',
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
    padding: '1rem',
  } as React.CSSProperties,

  calculatedGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '1rem',
  } as React.CSSProperties,

  calculatedCard: {
    backgroundColor: '#fff',
    border: '1px solid #e0e0e0',
    borderRadius: '8px',
    padding: '1.5rem',
    textAlign: 'center',
  } as React.CSSProperties,

  calculatedValue: {
    fontSize: '1.75rem',
    fontWeight: '700',
    color: '#0066cc',
    marginBottom: '0.5rem',
  } as React.CSSProperties,

  alert: {
    padding: '1rem',
    borderRadius: '4px',
  } as React.CSSProperties,

  alertInfo: {
    backgroundColor: '#e3f2fd',
    color: '#1565c0',
    borderLeft: '4px solid #1565c0',
  } as React.CSSProperties,

  alertError: {
    backgroundColor: '#ffebee',
    color: '#c62828',
    borderLeft: '4px solid #c62828',
  } as React.CSSProperties,

  buttonGroup: {
    display: 'flex',
    gap: '1rem',
    flexWrap: 'wrap',
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

  spinner: {
    display: 'inline-block',
    width: '2rem',
    height: '2rem',
    border: '3px solid #ccc',
    borderTopColor: '#0066cc',
    borderRadius: '50%',
    animation: 'spin 0.6s linear infinite',
  } as React.CSSProperties,
};

// Add animation
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
}
