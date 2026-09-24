'use client';

import { useState } from 'react';
import Link from 'next/link';

interface ValidationResult {
  field: string;
  message: string;
  code: string;
  severity: 'error' | 'warning';
}

interface UploadResult {
  success: boolean;
  sourceFileId: string;
  filename: string;
  fileType: 'RECIBIDAS' | 'EMITIDAS';
  totalRows: number;
  validCount: number;
  errorCount: number;
  results: Array<{
    isValid: boolean;
    errors: ValidationResult[];
  }>;
}

export default function IngestaPage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('taxPeriodId', 'temp-period-id'); // TODO: get from context
      formData.append('taxpayerRuc', '1234567890123'); // TODO: get from context

      const response = await fetch('/api/ingestion/upload', {
        method: 'POST',
        body: formData,
        headers: {
          'x-user-id': 'user-1', // TODO: get from auth
        },
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const data: UploadResult = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <Link href="/" style={styles.backLink}>← Back</Link>
        <h1>Ingesta — Upload SRI Files</h1>
      </header>

      <main style={styles.main}>
        <section style={styles.section}>
          <h2>Upload File</h2>

          <div style={styles.uploadBox}>
            <input
              type="file"
              onChange={handleFileChange}
              accept=".txt,.csv,.tsv"
              style={styles.fileInput}
              disabled={uploading}
            />

            {file && (
              <div style={styles.fileInfo}>
                <p><strong>Selected:</strong> {file.name}</p>
                <p><strong>Size:</strong> {(file.size / 1024).toFixed(2)} KB</p>
              </div>
            )}

            <button
              onClick={handleUpload}
              disabled={!file || uploading}
              style={{...styles.button, opacity: !file || uploading ? 0.6 : 1}}
            >
              {uploading ? 'Uploading...' : 'Upload & Validate'}
            </button>
          </div>

          {error && (
            <div style={{...styles.alert, ...styles.alertError}}>
              {error}
            </div>
          )}
        </section>

        {result && (
          <section style={styles.section}>
            <h2>Upload Result</h2>

            <div style={styles.resultBox}>
              <div style={styles.resultRow}>
                <span>File Type:</span>
                <strong>{result.fileType}</strong>
              </div>
              <div style={styles.resultRow}>
                <span>Total Rows:</span>
                <strong>{result.totalRows}</strong>
              </div>
              <div style={styles.resultRow}>
                <span>Valid:</span>
                <strong style={{ color: '#2e7d32' }}>✓ {result.validCount}</strong>
              </div>
              <div style={styles.resultRow}>
                <span>Errors:</span>
                <strong style={{ color: '#c62828' }}>✗ {result.errorCount}</strong>
              </div>
            </div>

            {result.errorCount > 0 && (
              <div style={styles.errorsSection}>
                <h3>Validation Errors</h3>
                <table style={styles.table}>
                  <thead>
                    <tr style={styles.tableHeader}>
                      <th>Row</th>
                      <th>Field</th>
                      <th>Error</th>
                      <th>Severity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.results
                      .map((r, i) => ({ ...r, index: i }))
                      .filter(r => !r.isValid)
                      .flatMap(r =>
                        r.errors.map((err, j) => (
                          <tr key={`${r.index}-${j}`} style={styles.tableRow}>
                            <td>{r.index + 2}</td>
                            <td>{err.field}</td>
                            <td>{err.message}</td>
                            <td style={{
                              color: err.severity === 'error' ? '#c62828' : '#e65100'
                            }}>
                              {err.severity}
                            </td>
                          </tr>
                        ))
                      )}
                  </tbody>
                </table>
              </div>
            )}

            {result.validCount > 0 && (
              <div style={styles.successBox}>
                <p>✓ {result.validCount} invoices ready for classification</p>
                <Link href="/ventas" style={styles.button}>
                  Proceed to Classification →
                </Link>
              </div>
            )}
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
    maxWidth: '900px',
    margin: '0 auto',
    padding: '0 1.5rem 2rem',
  } as React.CSSProperties,

  section: {
    marginBottom: '2rem',
  } as React.CSSProperties,

  uploadBox: {
    backgroundColor: '#fff',
    border: '2px dashed #0066cc',
    borderRadius: '8px',
    padding: '2rem',
    textAlign: 'center',
  } as React.CSSProperties,

  fileInput: {
    padding: '0.5rem',
    marginBottom: '1rem',
  } as React.CSSProperties,

  fileInfo: {
    backgroundColor: '#e3f2fd',
    color: '#1565c0',
    padding: '1rem',
    borderRadius: '4px',
    marginBottom: '1rem',
  } as React.CSSProperties,

  button: {
    backgroundColor: '#0066cc',
    color: '#fff',
    padding: '0.75rem 1.5rem',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: '500',
    fontSize: '1rem',
  } as React.CSSProperties,

  alert: {
    padding: '1rem',
    borderRadius: '4px',
    marginTop: '1rem',
  } as React.CSSProperties,

  alertError: {
    backgroundColor: '#ffebee',
    color: '#c62828',
    borderLeft: '4px solid #c62828',
  } as React.CSSProperties,

  resultBox: {
    backgroundColor: '#fff',
    border: '1px solid #e0e0e0',
    borderRadius: '8px',
    padding: '1.5rem',
    marginBottom: '1.5rem',
  } as React.CSSProperties,

  resultRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '0.75rem 0',
    borderBottom: '1px solid #f0f0f0',
  } as React.CSSProperties,

  errorsSection: {
    backgroundColor: '#fff',
    border: '1px solid #e0e0e0',
    borderRadius: '8px',
    padding: '1.5rem',
    marginBottom: '1.5rem',
  } as React.CSSProperties,

  table: {
    width: '100%',
    marginTop: '1rem',
    borderCollapse: 'collapse',
  } as React.CSSProperties,

  tableHeader: {
    backgroundColor: '#f5f5f5',
    borderBottom: '2px solid #e0e0e0',
  } as React.CSSProperties,

  tableRow: {
    borderBottom: '1px solid #f0f0f0',
  } as React.CSSProperties,

  successBox: {
    backgroundColor: '#e8f5e9',
    border: '1px solid #2e7d32',
    borderRadius: '8px',
    padding: '1.5rem',
    textAlign: 'center',
  } as React.CSSProperties,
};
