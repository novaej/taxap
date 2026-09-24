/**
 * POST /api/results/calculate
 * Calculate all 11 result keys for a tax period.
 *
 * Body: { taxPeriodId }
 * Returns: { results: {[resultKey]: {amount, invoiceCount, details}}, blockReasons: [], timestamp }
 */

import { NextRequest, NextResponse } from 'next/server';
import { calculatePeriodResults } from '@/domain/iva';
import Decimal from 'decimal.js';

export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { taxPeriodId } = await request.json();

    if (!taxPeriodId) {
      return NextResponse.json(
        { error: 'Missing taxPeriodId' },
        { status: 400 }
      );
    }

    // TODO: Fetch all invoices for tax period from DB with RLS
    // TODO: Validate all invoices are classified
    // TODO: Call calculatePeriodResults()
    // TODO: Generate proportionality factor with blocking logic
    // TODO: Save to period_results table

    const mockResults = {
      SALES_TAXED: {
        amount: new Decimal('10000.00'),
        invoiceCount: 5,
        details: 'Taxed sales (1005)',
      },
      PROPORTIONALITY_FACTOR: {
        amount: new Decimal('0.8500'),
        invoiceCount: 0,
        details: 'Calculated factor: 0.8500',
      },
      CREDIT_APPLICABLE: {
        amount: new Decimal('1700.00'),
        invoiceCount: 0,
        details: 'Applicable VAT credit: 0.8500 × 2000.00',
      },
    };

    return NextResponse.json({
      success: true,
      taxPeriodId,
      timestamp: new Date().toISOString(),
      results: mockResults,
      blockReasons: [],
      ready: true,
    });
  } catch (error) {
    console.error('Calculation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
