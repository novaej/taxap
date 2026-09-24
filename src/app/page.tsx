import Link from 'next/link';

export default function Home() {
  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>taxap</h1>
        <p style={styles.subtitle}>IVA Automation for Ecuador</p>
      </header>

      <main style={styles.main}>
        <section style={styles.section}>
          <h2>Modules</h2>

          <div style={styles.moduleGrid}>
            <div style={styles.moduleCard}>
              <h3>📥 Ingesta</h3>
              <p>Upload SRI files (compras, ventas) and validate format</p>
              <Link href="/ingesta" style={styles.link}>
                Go to Ingesta →
              </Link>
            </div>

            <div style={styles.moduleCard}>
              <h3>📊 Ventas Emitidas</h3>
              <p>Classify issued invoices and track VAT treatment</p>
              <Link href="/ventas" style={styles.link}>
                Go to Ventas →
              </Link>
            </div>

            <div style={styles.moduleCard}>
              <h3>🔍 Conciliación</h3>
              <p>Review and manually classify unresolved invoices</p>
              <Link href="/conciliacion" style={styles.link}>
                Go to Conciliación →
              </Link>
            </div>

            <div style={styles.moduleCard}>
              <h3>📋 Pre-declaración</h3>
              <p>Review Form 104 results before declaring to SRI</p>
              <Link href="/predeclaracion" style={styles.link}>
                Go to Pre-declaración →
              </Link>
            </div>
          </div>
        </section>

        <section style={styles.section}>
          <h2>Status</h2>
          <div style={styles.statusGrid}>
            <div style={styles.statusCard}>
              <h4>Backend</h4>
              <p style={{ color: '#2e7d32' }}>✓ Production-ready</p>
            </div>
            <div style={styles.statusCard}>
              <h4>Database</h4>
              <p style={{ color: '#2e7d32' }}>✓ RLS enabled</p>
            </div>
            <div style={styles.statusCard}>
              <h4>Domain Logic</h4>
              <p style={{ color: '#2e7d32' }}>✓ Tested</p>
            </div>
            <div style={styles.statusCard}>
              <h4>UI</h4>
              <p style={{ color: '#e65100' }}>→ In progress</p>
            </div>
          </div>
        </section>
      </main>

      <footer style={styles.footer}>
        <p>© 2026 taxap. All rights reserved.</p>
      </footer>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#f9f9f9',
  } as React.CSSProperties,

  header: {
    backgroundColor: '#0066cc',
    color: '#fff',
    padding: '3rem 2rem',
    textAlign: 'center',
  } as React.CSSProperties,

  title: {
    fontSize: '3rem',
    fontWeight: '700',
    margin: '0 0 0.5rem 0',
  } as React.CSSProperties,

  subtitle: {
    fontSize: '1.25rem',
    fontWeight: '400',
    margin: '0',
    opacity: 0.9,
  } as React.CSSProperties,

  main: {
    flex: 1,
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '2rem',
    width: '100%',
  } as React.CSSProperties,

  section: {
    marginBottom: '3rem',
  } as React.CSSProperties,

  moduleGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '1.5rem',
    marginTop: '1.5rem',
  } as React.CSSProperties,

  moduleCard: {
    backgroundColor: '#fff',
    border: '1px solid #e0e0e0',
    borderRadius: '8px',
    padding: '1.5rem',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
  } as React.CSSProperties,

  link: {
    display: 'inline-block',
    marginTop: '1rem',
    color: '#0066cc',
    textDecoration: 'none',
    fontWeight: '500',
  } as React.CSSProperties,

  statusGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '1rem',
    marginTop: '1rem',
  } as React.CSSProperties,

  statusCard: {
    backgroundColor: '#fff',
    border: '1px solid #e0e0e0',
    borderRadius: '8px',
    padding: '1rem',
    textAlign: 'center',
  } as React.CSSProperties,

  footer: {
    backgroundColor: '#f0f0f0',
    borderTop: '1px solid #e0e0e0',
    padding: '2rem',
    textAlign: 'center',
    fontSize: '0.875rem',
    color: '#666',
  } as React.CSSProperties,
};
