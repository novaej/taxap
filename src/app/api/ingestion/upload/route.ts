/**
 * POST /api/ingestion/upload
 * Upload SRI file (compras o ventas) and parse/validate.
 *
 * Returns: { sourceFileId, fileType, totalRows, validCount, errorCount, results[] }
 */

import { NextRequest, NextResponse } from 'next/server';
import { parseFile, ingestionService } from '@/services/ingestion';
import type { ReceivedInvoiceRow, IssuedInvoiceRow } from '@/services/ingestion';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    // Get user context (mock for now)
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const taxPeriodId = formData.get('taxPeriodId') as string;
    const taxpayerRuc = formData.get('taxpayerRuc') as string;

    if (!file || !taxPeriodId || !taxpayerRuc) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Read file content
    const content = await file.text();

    // Calculate hash for deduplication
    const sha256 = crypto
      .createHash('sha256')
      .update(content)
      .digest('hex');

    // Parse file
    const parseResult = parseFile(content);

    if (parseResult.errors.length > 0 && parseResult.rows.length === 0) {
      return NextResponse.json(
        {
          error: 'Failed to parse file',
          details: parseResult.errors,
        },
        { status: 400 }
      );
    }

    // Validate each row
    const existingAccessKeys = new Set<string>(); // TODO: fetch from DB
    const validationResults = parseResult.rows.map((row: ReceivedInvoiceRow | IssuedInvoiceRow) => {
      if (parseResult.fileType === 'RECIBIDAS') {
        return ingestionService.validateReceivedRow(
          row as ReceivedInvoiceRow,
          taxpayerRuc,
          new Date(), // TODO: get from taxPeriod
          new Date(), // TODO: get from taxPeriod
          existingAccessKeys
        );
      } else {
        return ingestionService.validateIssuedRow(
          row as IssuedInvoiceRow,
          new Date(),
          new Date(),
          existingAccessKeys
        );
      }
    });

    const validCount = validationResults.filter((result) => result.isValid).length;
    const errorCount = validationResults.filter((result) => !result.isValid).length;

    // TODO: Save to database with RLS
    // const db = await withUser(userId);
    // const sourceFile = await db.prisma.sourceFile.create({ ... });

    return NextResponse.json({
      success: true,
      sourceFileId: crypto.randomUUID(), // TODO: use real DB ID
      filename: file.name,
      sha256,
      fileType: parseResult.fileType,
      totalRows: parseResult.rows.length,
      validCount,
      errorCount,
      results: validationResults,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
