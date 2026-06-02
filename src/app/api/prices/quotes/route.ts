import { NextResponse } from 'next/server';
import {
  APP_GLOBAL_USD_SLUG,
  DEFAULT_PRICE_SOURCES,
  findPriceSource,
  type PriceSource,
} from '@/features/prices/constants/price-sources';
import {
  fetchProviderQuotes,
  type FetchProviderQuotesResult,
} from '@/features/prices/services/fetch-provider-quotes';
import type { ApiQuoteSource } from '@/features/prices/utils/price-source-catalog';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const preferredRegion = ['fra1'];

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('origin');
  if (origin) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'content-type',
      Vary: 'Origin',
    };
  }
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
  };
}

function quoteResponse(
  request: Request,
  data: unknown,
  init?: { status?: number }
): NextResponse {
  return NextResponse.json(data, {
    status: init?.status ?? 200,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      ...corsHeaders(request),
    },
  });
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(request),
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { slugs?: unknown; sources?: unknown };
    const requestedSlugs = Array.isArray(body?.slugs)
      ? body.slugs.filter((value): value is string => typeof value === 'string')
      : [];
    const requestSources = Array.isArray(body?.sources)
      ? (body.sources as ApiQuoteSource[])
      : undefined;

    const result = await fetchProviderQuotes({
      slugs: requestedSlugs,
      sources: requestSources,
    });

    if (result.error === 'INVALID_JSON') {
      return quoteResponse(request, { error: 'INVALID_JSON', quotes: [] }, { status: 400 });
    }

    return quoteResponse(request, result);
  } catch (error) {
    console.error('price quote refresh failed', error);
    return quoteResponse(request, {
      quotes: [],
      failedProviders: [
        {
          provider: 'server',
          error: error instanceof Error ? error.message : String(error),
        },
      ],
      unresolvedSlugs: [],
      unknownRequestedSlugs: [],
    });
  }
}
