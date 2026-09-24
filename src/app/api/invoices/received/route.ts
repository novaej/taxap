/**
 * GET /api/invoices/received
 * List received invoices (compras) for a tax period, with classification status.
 *
 * Query params: taxPeriodId, taxpayerId, classificationStatus (all|pending|classified)
 * Returns: { invoices: [{id, clave_acceso, ruc_emisor, fecha_emision, valor_sin_impuestos, iva, classification_status, result_key}] }
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const taxPeriodId = searchParams.get('taxPeriodId');
    const classificationStatus = searchParams.get('classificationStatus') || 'all';

    if (!taxPeriodId) {
      return NextResponse.json(
        { error: 'Missing taxPeriodId' },
        { status: 400 }
      );
    }

    // TODO: Query from database with RLS
    // const db = await withUser(userId);
    // const invoices = await db.prisma.invoicesReceived.findMany({ ... });

    return NextResponse.json({
      success: true,
      taxPeriodId,
      classificationStatus,
      totalCount: 0,
      unclassifiedCount: 0,
      invoices: [],
    });
  } catch (error) {
    console.error('Error listing invoices:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
