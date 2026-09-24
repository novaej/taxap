/**
 * POST /api/invoices/received/[id]/classify
 * Classify a received invoice through the cascade.
 *
 * Body: { result_key, classifier (supplier_rule|catalog|ai|manual), confidence? }
 * Returns: { invoiceId, previousClassification, newClassification, timestamp }
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { result_key, classifier, confidence } = await request.json();

    if (!result_key || !classifier) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // TODO: Validate classifier source and confidence
    // TODO: Append to classification_events table (immutable)
    // TODO: Update invoices_received.result_key
    // TODO: Check if proportionality factor can now be calculated

    return NextResponse.json({
      success: true,
      invoiceId: params.id,
      result_key,
      classifier,
      confidence,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Classification error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
