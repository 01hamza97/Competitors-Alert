import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

function verifyAuth(request) {
  const authHeader = request.headers.get('authorization');
  const token =
    authHeader?.replace('Bearer ', '') ||
    request.headers.get('x-api-key') ||
    request.cookies.get('dealerdata_session')?.value ||
    request.cookies.get('session_token')?.value;

  const validSecret =
    process.env.N8N_WEBHOOK_SECRET ||
    process.env.SCRAPER_API_SECRET ||
    'dealerdata_n8n_secret_2026';

  if (token && (token === validSecret || token === process.env.SCRAPER_API_SECRET)) {
    return { authorized: true, user: { role: 'n8n_service' } };
  }

  return { authorized: false, token };
}

/**
 * GET /api/specials/staging
 * Fetches staged specials for N8N Vision AI or review.
 * Query parameters:
 *  - status: 'pending' (default) | 'approved' | 'rejected' | 'all'
 *  - dealer_id: string (optional)
 *  - limit: number (default 20, max 100)
 *  - offset: number (default 0)
 */
export async function GET(request) {
  try {
    const auth = verifyAuth(request);
    if (!auth.authorized) {
      const user = await getSessionUser(auth.token);
      if (!user) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized. Provide valid Bearer token, x-api-key, or session.' },
          { status: 401 }
        );
      }
    }

    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get('status') || 'pending';
    const dealerId = searchParams.get('dealer_id');
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '20', 10), 1), 100);
    const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10), 0);

    const where = {};
    if (statusParam !== 'all') {
      where.status = statusParam;
    }
    if (dealerId) {
      where.dealerId = dealerId;
    }

    const [totalCount, rows] = await Promise.all([
      prisma.specialsStaging.count({ where }),
      prisma.specialsStaging.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
    ]);

    const items = rows.map((r) => {
      let parsedDetails = {};
      try {
        if (r.details) {
          if (r.details.trim().startsWith('{')) {
            parsedDetails = JSON.parse(r.details);
          } else if (r.details.match(/\.(jpg|jpeg|png|webp)(\?|$)/i) || r.details.includes('pictures.dealer.com') || r.details.includes('/assets/')) {
            parsedDetails = { imageUrl: r.details };
          }
        }
      } catch {}

      let parsedExtracted = null;
      try {
        if (r.extractedJson) {
          parsedExtracted = JSON.parse(r.extractedJson);
        }
      } catch {}

      const resolvedImageUrl =
        parsedDetails.imageUrl ||
        parsedDetails.image_url ||
        parsedDetails.publicUrl ||
        parsedDetails.url ||
        r.rawText?.match(/https?:\/\/[^\s"]+\.(?:jpg|jpeg|png|webp)[^\s"]*/i)?.[0] ||
        (r.details?.match(/https?:\/\/[^\s"]+\.(?:jpg|jpeg|png|webp)[^\s"]*/i)?.[0] || null);

      return {
        id: r.id,
        dealerId: r.dealerId,
        offerDealerName: r.offerDealerName,
        clientDealerName: r.clientDealerName,
        snapshotDate: r.snapshotDate,
        specialType: r.specialType,
        title: r.title,
        status: r.status,
        domain: r.domain,
        imageHash: r.imageHash,
        imageUrl: resolvedImageUrl,
        localImagePath: parsedDetails.localImagePath || null,
        altText: parsedDetails.altText || null,
        disclaimer: parsedDetails.disclaimer || null,
        extractedData: parsedExtracted,
        rawText: r.rawText,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      };
    });

    return NextResponse.json({
      success: true,
      status: statusParam,
      totalCount,
      count: items.length,
      limit,
      offset,
      hasMore: offset + items.length < totalCount,
      items,
    });
  } catch (error) {
    console.error('[API /api/specials/staging] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
