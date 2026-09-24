/**
 * File parser tests.
 * Verify SRI format parsing for received and issued invoices.
 */

import { parseReceivedFile, parseIssuedFile, detectFileType } from '../file-parser';
import Decimal from 'decimal.js';

describe('File Parser', () => {
  describe('detectFileType', () => {
    it('detects RECIBIDAS format (12 columns)', () => {
      const header =
        'RUC_EMISOR\tTIPO_COMPROBANTE\tSERIE\tNUMERO_COMPROBANTE\tFECHA_EMISION\tCLAVE_ACCESO\tVALOR_SIN_IMPUESTOS\tIVA\tDESCUENTO\tVALOR_TOTAL\tIDENTIFICACION_RECEPTOR\tESTADO';
      expect(detectFileType(header)).toBe('RECIBIDAS');
    });

    it('detects EMITIDAS format (8 columns)', () => {
      const header =
        'COMPROBANTE\tFECHA_EMISION\tCLAVE_ACCESO\tVALOR_SIN_IMPUESTOS\tIVA\tDESCUENTO\tVALOR_TOTAL';
      expect(detectFileType(header)).toBe('EMITIDAS');
    });

    it('returns null for unknown format', () => {
      const header = 'UNKNOWN\tFORMAT\tHERE';
      expect(detectFileType(header)).toBeNull();
    });
  });

  describe('parseReceivedFile', () => {
    it('parses valid received invoices', () => {
      const content = `RUC_EMISOR\tTIPO_COMPROBANTE\tSERIE\tNUMERO_COMPROBANTE\tFECHA_EMISION\tCLAVE_ACCESO\tVALOR_SIN_IMPUESTOS\tIVA\tDESCUENTO\tVALOR_TOTAL\tIDENTIFICACION_RECEPTOR\tESTADO
1710000000001\t01\t001-001\t00000001\t15/08/2026\t150820261010000000001001000000000011234567890\t100.00\t15.00\t0.00\t115.00\t0873103395798\tAutorizado`;

      const result = parseReceivedFile(content);

      expect(result.fileType).toBe('RECIBIDAS');
      expect(result.rows).toHaveLength(1);
      expect(result.errors).toHaveLength(0);

      const row = result.rows[0];
      expect(row.RUC_EMISOR).toBe('1710000000001');
      expect(row.TIPO_COMPROBANTE).toBe('01');
      expect(row.SERIE).toBe('001-001');
      expect(row.CLAVE_ACCESO).toHaveLength(49);
      expect(row.VALOR_SIN_IMPUESTOS.equals(new Decimal('100.00'))).toBe(true);
      expect(row.IVA.equals(new Decimal('15.00'))).toBe(true);
    });

    it('handles parsing errors', () => {
      const content = `RUC_EMISOR\tTIPO_COMPROBANTE\tSERIE\tNUMERO_COMPROBANTE\tFECHA_EMISION\tCLAVE_ACCESO\tVALOR_SIN_IMPUESTOS\tIVA\tDESCUENTO\tVALOR_TOTAL\tIDENTIFICACION_RECEPTOR\tESTADO
1710000000001\t01\t001-001\t00000001\t15/08/2026\t150820261010000000001001000000000011234567890\tINVALID_NUMBER\t15.00\t0.00\t115.00\t0873103395798\tAutorizado`;

      const result = parseReceivedFile(content);

      expect(result.rows).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].lineNumber).toBe(2);
      expect(result.errors[0].reason).toContain('Parsing error');
    });

    it('rejects wrong file type', () => {
      const emitidaHeader =
        'COMPROBANTE\tFECHA_EMISION\tCLAVE_ACCESO\tVALOR_SIN_IMPUESTOS\tIVA\tDESCUENTO\tVALOR_TOTAL';

      const result = parseReceivedFile(emitidaHeader);

      expect(result.rows).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].reason).toContain('Expected RECIBIDAS format');
    });
  });

  describe('parseIssuedFile', () => {
    it('parses valid issued invoices', () => {
      const content = `COMPROBANTE\tFECHA_EMISION\tCLAVE_ACCESO\tVALOR_SIN_IMPUESTOS\tIVA\tDESCUENTO\tVALOR_TOTAL
001-001-000000001\t15/08/2026\t150820260873103395798001001000000000011234567890\t500.00\t75.00\t0.00\t575.00`;

      const result = parseIssuedFile(content);

      expect(result.fileType).toBe('EMITIDAS');
      expect(result.rows).toHaveLength(1);
      expect(result.errors).toHaveLength(0);

      const row = result.rows[0];
      expect(row.COMPROBANTE).toBe('001-001-000000001');
      expect(row.FECHA_EMISION).toBe('15/08/2026');
      expect(row.VALOR_SIN_IMPUESTOS.equals(new Decimal('500.00'))).toBe(true);
      expect(row.IVA.equals(new Decimal('75.00'))).toBe(true);
    });

    it('handles empty files', () => {
      const result = parseIssuedFile('');

      expect(result.rows).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
      expect(result.fileType).toBe('EMITIDAS');
    });
  });
});
