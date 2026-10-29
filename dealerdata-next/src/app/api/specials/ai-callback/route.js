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
 * GET /api/specials/ai-callback
 * Returns endpoint status, authentication requirements, and payload schema guide for N8N.
 */
export async function GET(request) {
  return NextResponse.json({
    endpoint: '/api/specials/ai-callback',
    status: 'active',
    authMethods: [
      'Header: Authorization: Bearer <N8N_WEBHOOK_SECRET>',
      'Header: x-api-key: <N8N_WEBHOOK_SECRET>',
      'Cookie: dealerdata_session=<session_token>'
    ],
    supportedPayloadFormat: 'Single object or array of objects',
    samplePayload: {
      staging_id: 'stg_12345',
      image_hash: 'optional_sha256_hash',
      auto_approve: true,
      raw_text: 'Optional raw OCR text from image',
      extracted_data: {
        year: 2026,
        make: 'Ram',
        model: '1500',
        trim: 'Big Horn 4x4',
        special_type: 'lease',
        monthly_payment: 389,
        term_months: 36,
        down_payment: 2999,
        apr: null,
        msrp: 49850,
        title: '2026 Ram 1500 Big Horn Quad Cab 4x4 Lease Special',
        disclaimer: 'Closed-end lease for 2026 Ram 1500. $2,999 due at signing...',
        expiration_date: '2026-10-31'
      }
    }
  });
}

/**
 * POST /api/specials/ai-callback
 * Handles AI Vision extractions from external N8N workflows.
 * Updates staging records, propagates to duplicate image hashes,
 * and automatically promotes specials into competitor_vehicle_specials.
 */
export async function POST(request) {
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

    const body = await request.json();
    const items = Array.isArray(body) ? body : [body];

    if (!items || items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Empty payload. Provide at least one special object.' },
        { status: 400 }
      );
    }

    const results = [];
    let promotedCount = 0;
    let globalSharedCount = 0;

    for (const item of items) {
      const stagingId = item.staging_id || item.id;
      const imageHash = item.image_hash;
      const rawText = item.raw_text || '';
      const autoApprove = item.auto_approve !== false; // default true
      const extracted = item.extracted_data || item.data || item;

      // Find primary staging row by ID or image_hash
      let stagingRecord = null;
      if (stagingId) {
        stagingRecord = await prisma.specialsStaging.findUnique({
          where: { id: stagingId },
        });
      }

      if (!stagingRecord && imageHash) {
        stagingRecord = await prisma.specialsStaging.findFirst({
          where: { imageHash },
        });
      }

      if (!stagingRecord) {
        results.push({
          stagingId,
          imageHash,
          status: 'error',
          error: `Staged record not found for id "${stagingId}" or hash "${imageHash}"`,
        });
        continue;
      }

      // Parse details JSON for image/special URLs
      let detailsObj = {};
      try {
        if (stagingRecord.details) {
          detailsObj = JSON.parse(stagingRecord.details);
        }
      } catch {}

      const cleanYear = parseInt(extracted.year, 10) || new Date().getFullYear();
      const cleanMake = (extracted.make || 'Unknown').trim();
      const cleanModel = (extracted.model || 'Special Offer').trim();
      const cleanTrim = extracted.trim ? String(extracted.trim).trim() : null;
      let cleanType = (extracted.special_type || extracted.specialType || 'lease').toLowerCase().trim();
      
      let cleanMonthly =
        extracted.monthly_payment != null && extracted.monthly_payment !== ''
          ? parseFloat(String(extracted.monthly_payment).replace(/[^0-9.]/g, ''))
          : null;
      const cleanTerm =
        extracted.term_months != null && extracted.term_months !== ''
          ? parseInt(String(extracted.term_months).replace(/[^0-9]/g, ''), 10)
          : (extracted.term ? parseInt(String(extracted.term).replace(/[^0-9]/g, ''), 10) : null);
      const cleanDown =
        extracted.down_payment != null && extracted.down_payment !== ''
          ? parseFloat(String(extracted.down_payment).replace(/[^0-9.]/g, ''))
          : null;
      const cleanApr =
        extracted.apr != null && extracted.apr !== ''
          ? parseFloat(String(extracted.apr).replace(/[^0-9.]/g, ''))
          : null;
      const cleanSelling =
        extracted.selling_price != null && extracted.selling_price !== ''
          ? parseFloat(String(extracted.selling_price).replace(/[^0-9.]/g, ''))
          : (extracted.sellingPrice ? parseFloat(String(extracted.sellingPrice).replace(/[^0-9.]/g, '')) : null);
      const cleanMsrp =
        extracted.msrp != null && extracted.msrp !== ''
          ? parseFloat(String(extracted.msrp).replace(/[^0-9.]/g, ''))
          : cleanSelling;
      const cleanOfferDetails =
        extracted.offer_details && String(extracted.offer_details).trim().length > 0
          ? String(extracted.offer_details).trim()
          : null;

      const cleanTitle = (
        extracted.title ||
        `${cleanYear} ${cleanMake} ${cleanModel} ${cleanType.toUpperCase()} Special`
      ).slice(0, 190);
      const cleanDisclaimer = (extracted.disclaimer || detailsObj.disclaimer || '').slice(0, 3000);
      const cleanExp = extracted.expiration_date || detailsObj.expirationDate || null;
      const finalImageUrl = detailsObj.imageUrl || extracted.image_url || null;
      const finalSpecialUrl = detailsObj.specialUrl || extracted.special_url || null;

      // Sanitize legal disclosure factors (e.g., "$16.67 per month per $1,000 financed" or "$15.15 per $1,000 borrowed")
      // which LLMs mistakenly extract as vehicle monthly payments
      if (cleanMonthly != null && cleanMonthly < 80) {
        const combinedText = `${cleanTitle} ${cleanDisclaimer} ${rawText}`.toLowerCase();
        if (
          cleanApr != null ||
          combinedText.includes('per $1,000') ||
          combinedText.includes('per $1000') ||
          combinedText.includes('per thousand') ||
          combinedText.includes('per 1,000') ||
          combinedText.includes('per 1000')
        ) {
          cleanMonthly = null;
          if (cleanApr != null && (cleanType === 'finance' || cleanType === 'lease')) {
            cleanType = 'apr';
          }
        }
      }

      // Card Qualification Check: Must have at least one actionable numeric term
      // (monthly payment, apr rate, down payment, term months, msrp, or specific dollar/percent offer detail)
      const hasNumericTerms = (
        (cleanMonthly != null && cleanMonthly > 0) ||
        (cleanApr != null && cleanApr >= 0) ||
        (cleanDown != null && cleanDown >= 0) ||
        (cleanTerm != null && cleanTerm > 0) ||
        (cleanMsrp != null && cleanMsrp > 0) ||
        cleanOfferDetails != null
      );

      const shouldDiscard =
        item.discard === true ||
        item.status === 'discarded' ||
        extracted.is_special === false ||
        !hasNumericTerms ||
        cleanMake === 'Unknown';

      const targetHash = imageHash || stagingRecord.imageHash;

      if (shouldDiscard) {
        const discardReason =
          item.discard_reason ||
          (!hasNumericTerms
            ? 'No actionable numeric offer terms (no amount, term, or APR)'
            : 'Classified as non-special branding');

        const discardedJsonString = JSON.stringify({
          is_special: false,
          discard_reason: discardReason,
          raw_ai_extracted: extracted,
        });

        // 1. Mark primary staging record as discarded
        await prisma.specialsStaging.update({
          where: { id: stagingRecord.id },
          data: {
            title: cleanTitle,
            rawText: rawText || stagingRecord.rawText,
            extractedJson: discardedJsonString,
            status: 'discarded',
          },
        });

        // 2. Propagate discarded status to all duplicate sibling records with the same imageHash
        if (targetHash) {
          await prisma.specialsStaging.updateMany({
            where: {
              imageHash: targetHash,
              id: { not: stagingRecord.id },
            },
            data: {
              extractedJson: discardedJsonString,
              status: 'discarded',
            },
          });
        }

        results.push({
          stagingId: stagingRecord.id,
          imageHash: targetHash,
          status: 'discarded',
          reason: discardReason,
        });
        continue;
      }

      const newStatus = autoApprove ? 'approved' : 'completed';
      const extractedJsonString = JSON.stringify({
        is_special: true,
        year: cleanYear,
        make: cleanMake,
        model: cleanModel,
        trim: cleanTrim,
        special_type: cleanType,
        monthly_payment: cleanMonthly,
        term_months: cleanTerm,
        down_payment: cleanDown,
        apr: cleanApr,
        msrp: cleanMsrp,
        offer_details: cleanOfferDetails,
        title: cleanTitle,
        disclaimer: cleanDisclaimer,
        expiration_date: cleanExp,
      });

      // 1. Update the primary staging record
      await prisma.specialsStaging.update({
        where: { id: stagingRecord.id },
        data: {
          title: cleanTitle,
          rawText: rawText || stagingRecord.rawText,
          extractedJson: extractedJsonString,
          status: newStatus,
        },
      });

      // 2. Global AI Cache Propagation: Update all other matching flyer records with this imageHash
      let siblingStagingRecords = [];
      if (targetHash) {
        siblingStagingRecords = await prisma.specialsStaging.findMany({
          where: {
            imageHash: targetHash,
            id: { not: stagingRecord.id },
          },
        });

        if (siblingStagingRecords.length > 0) {
          await prisma.specialsStaging.updateMany({
            where: {
              imageHash: targetHash,
              id: { not: stagingRecord.id },
            },
            data: {
              title: cleanTitle,
              extractedJson: extractedJsonString,
              status: newStatus,
            },
          });
          globalSharedCount += siblingStagingRecords.length;
        }
      }

      // 3. Promote to live competitor_vehicle_specials if approved
      const allRecordsToPromote = [stagingRecord, ...siblingStagingRecords];
      const liveIdsCreated = [];

      if (autoApprove && cleanMake !== 'Unknown') {
        for (const record of allRecordsToPromote) {
          const cleanDealerId = (record.dealerId || 'store').replace(/^store_/, '');
          const safeModelSlug = cleanModel.replace(/[^a-zA-Z0-9]/g, '_');
          const optIndex = item.offer_index != null ? item.offer_index : (extracted.offer_index != null ? extracted.offer_index : null);
          const optSuffix = optIndex != null ? `_opt${optIndex}` : `_${cleanType}`;
          const liveId = `spc_${cleanDealerId}_${cleanYear}_${cleanMake}_${safeModelSlug}_ai_${record.id.slice(-6)}${optSuffix}`;

          await prisma.competitorVehicleSpecial.upsert({
            where: { id: liveId },
            update: {
              offerDealerName: record.offerDealerName,
              snapshotDate: record.snapshotDate,
              year: cleanYear,
              make: cleanMake,
              model: cleanModel,
              trim: cleanTrim,
              specialType: cleanType,
              monthlyPayment: cleanMonthly,
              termMonths: cleanTerm,
              downPayment: cleanDown,
              apr: cleanApr,
              msrp: cleanMsrp,
              title: cleanTitle,
              disclaimer: cleanDisclaimer || undefined,
              expirationDate: cleanExp || undefined,
              imageUrl: finalImageUrl || undefined,
              specialUrl: finalSpecialUrl || undefined,
              domain: record.domain || undefined,
            },
            create: {
              id: liveId,
              dealerId: cleanDealerId,
              offerDealerName: record.offerDealerName,
              snapshotDate: record.snapshotDate,
              year: cleanYear,
              make: cleanMake,
              model: cleanModel,
              trim: cleanTrim,
              specialType: cleanType,
              monthlyPayment: cleanMonthly,
              termMonths: cleanTerm,
              downPayment: cleanDown,
              apr: cleanApr,
              msrp: cleanMsrp,
              title: cleanTitle,
              disclaimer: cleanDisclaimer || undefined,
              expirationDate: cleanExp || undefined,
              imageUrl: finalImageUrl || undefined,
              specialUrl: finalSpecialUrl || undefined,
              domain: record.domain || undefined,
            },
          });

          liveIdsCreated.push(liveId);
          promotedCount++;
        }

        // 4. Create in-app notification
        try {
          await prisma.notification.create({
            data: {
              title: `AI Special Parsed: ${cleanYear} ${cleanMake} ${cleanModel}`,
              description: `N8N Vision AI parsed special for ${stagingRecord.offerDealerName} (${cleanMonthly ? `$${cleanMonthly}/mo` : cleanTitle}). Promoted to live database.`,
              category: 'alert',
              read: false,
              link: '/competitor-analysis?view=new_specials',
            },
          });
        } catch (notifErr) {
          console.warn('[AI Callback] Notification creation warning:', notifErr.message);
        }
      }

      results.push({
        stagingId: stagingRecord.id,
        imageHash: targetHash,
        status: 'success',
        action: autoApprove ? 'approved_and_promoted' : 'completed_staging_only',
        liveIds: liveIdsCreated,
        parsedOffer: {
          year: cleanYear,
          make: cleanMake,
          model: cleanModel,
          monthlyPayment: cleanMonthly,
          termMonths: cleanTerm,
          downPayment: cleanDown,
          specialType: cleanType,
        },
      });
    }

    return NextResponse.json({
      success: true,
      processedCount: items.length,
      promotedCount,
      globalSharedCount,
      results,
    });
  } catch (error) {
    console.error('[API /api/specials/ai-callback] POST Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
