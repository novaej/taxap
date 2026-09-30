/**
 * File parser tests.
 * Verify SRI format parsing for received and issued invoices.
 * Example rows taken from docs/tax/formato-archivos-sri.md (verified
 * against real files 2026-09-20).
 */

import { parseReceivedFile, parseIssuedFile, detectFileType } from '../file-parser';
import Decimal from 'decimal.js';

const RECIBIDAS_HEADER =
  'RUC_EMISOR\tRAZON_SOCIAL_EMISOR\tTIPO_COMPROBANTE\tSERIE_COMPROBANTE\tCLAVE_ACCESO\tFECHA_AUTORIZACION\tFECHA_EMISION\tIDENTIFICACION_RECEPTOR\tVALOR_SIN_IMPUESTOS\tIVA\tIMPORTE_TOTAL\tNUMERO_DOCUMENTO_MODIFICADO';

const EMITIDAS_HEADER =
  'COMPROBANTE\tSERIE_COMPROBANTE\tCLAVE_ACCESO\tFECHA_AUTORIZACION\tFECHA_EMISION\tVALOR_SIN_IMPUESTOS\tIVA\tIMPORTE_TOTAL';

describe('File Parser', () => {
  describe('detectFileType', () => {
    it('detects RECIBIDAS format (12 columns)', () => {
      expect(detectFileType(RECIBIDAS_HEADER)).toBe('RECIBIDAS');
    });

    it('detects EMITIDAS format (8 columns)', () => {
      expect(detectFileType(EMITIDAS_HEADER)).toBe('EMITIDAS');
    });

    it('returns null for unknown format', () => {
      const header = 'UNKNOWN\tFORMAT\tHERE';
      expect(detectFileType(header)).toBeNull();
    });
  });

  describe('parseReceivedFile', () => {
    it('parses valid received invoices', () => {
      const content = `${RECIBIDAS_HEADER}
1791287541001\tMEGADATOS S.A.\tFactura\t001-012-024304725\t0108202601179128754100120010120243047251660131514\t01/08/2026 04:05:03\t01/08/2026\t1715824775\t29.99\t4.5\t34.49\t`;

      const result = parseReceivedFile(content);

      expect(result.fileType).toBe('RECIBIDAS');
      expect(result.rows).toHaveLength(1);
      expect(result.errors).toHaveLength(0);

      const row = result.rows[0];
      expect(row.RUC_EMISOR).toBe('1791287541001');
      expect(row.RAZON_SOCIAL_EMISOR).toBe('MEGADATOS S.A.');
      expect(row.TIPO_COMPROBANTE).toBe('Factura');
      expect(row.SERIE_COMPROBANTE).toBe('001-012-024304725');
      expect(row.CLAVE_ACCESO).toHaveLength(49);
      // 4.5, not 4.50 — the SRI writes decimals without trailing zeros.
      expect(row.VALOR_SIN_IMPUESTOS.equals(new Decimal('29.99'))).toBe(true);
      expect(row.IVA.equals(new Decimal('4.5'))).toBe(true);
    });

    it('handles parsing errors', () => {
      const content = `${RECIBIDAS_HEADER}
1791287541001\tMEGADATOS S.A.\tFactura\t001-012-024304725\t0108202601179128754100120010120243047251660131514\t01/08/2026 04:05:03\t01/08/2026\t1715824775\tINVALID_NUMBER\t4.5\t34.49\t`;

      const result = parseReceivedFile(content);

      expect(result.rows).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].lineNumber).toBe(2);
      expect(result.errors[0].reason).toContain('Parsing error');
    });

    it('rejects wrong file type', () => {
      const result = parseReceivedFile(EMITIDAS_HEADER);

      expect(result.rows).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].reason).toContain('Expected RECIBIDAS format');
    });
  });

  describe('parseIssuedFile', () => {
    it('parses valid issued invoices', () => {
      const content = `${EMITIDAS_HEADER}
Factura\t001-001-000000034\t0309202601171582477500120010010000000344465382615\t04/09/2026 07:32:13\t03/09/2026 00:00:00\t2500\t0\t2500`;

      const result = parseIssuedFile(content);

      expect(result.fileType).toBe('EMITIDAS');
      expect(result.rows).toHaveLength(1);
      expect(result.errors).toHaveLength(0);

      const row = result.rows[0];
      // COMPROBANTE — not TIPO_COMPROBANTE — is the voucher type in this file.
      expect(row.COMPROBANTE).toBe('Factura');
      expect(row.SERIE_COMPROBANTE).toBe('001-001-000000034');
      // FECHA_EMISION includes a time component here, unlike RECIBIDAS.
      expect(row.FECHA_EMISION).toBe('03/09/2026 00:00:00');
      expect(row.VALOR_SIN_IMPUESTOS.equals(new Decimal('2500'))).toBe(true);
      expect(row.IVA.equals(new Decimal('0'))).toBe(true);
    });

    it('handles empty files', () => {
      const result = parseIssuedFile('');

      expect(result.rows).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
      expect(result.fileType).toBe('EMITIDAS');
    });
  });
});
