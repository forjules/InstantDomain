/**
 * SSE Stream Controller for Instant Domain Generator
 * 
 * Manages Server-Sent Events connection, runs concurrent availability
 * checks with p-limit, and streams each result the instant it resolves.
 */

import pLimit from 'p-limit';
import { generateVariations, generateAdvancedCombinations, sanitizeKeyword } from './combinatorics.js';
import { generateBrandDomains } from './brandEngine.js';
import { checkDomainAvailability } from './domainChecker.js';

const CONCURRENCY_LIMIT = 25;

export async function handleStreamDomains(req, res) {
  const rawKeyword = req.query.keyword || '';
  const keyword = sanitizeKeyword(rawKeyword);

  // Set SSE response headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
    'Access-Control-Allow-Origin': '*'
  });

  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }

  // Initial handshake comment
  res.write(': stream start\n\n');

  if (!keyword) {
    res.write(`event: error\ndata: ${JSON.stringify({ error: 'Empty or invalid keyword' })}\n\n`);
    res.write('event: done\ndata: {}\n\n');
    return res.end();
  }

  const variations = generateVariations(keyword, 40);

  // Send initial meta event with total variations scheduled
  res.write(`event: meta\ndata: ${JSON.stringify({ 
    keyword, 
    total: variations.length,
    timestamp: Date.now() 
  })}\n\n`);

  // Create AbortController to cancel fetches if user disconnects (e.g. keeps typing)
  const abortController = new AbortController();
  let clientDisconnected = false;

  req.on('close', () => {
    clientDisconnected = true;
    abortController.abort();
  });

  const limit = pLimit(CONCURRENCY_LIMIT);

  // Map each candidate into a limited concurrent promise that writes to SSE stream upon resolution
  const tasks = variations.map((candidate) => {
    return limit(async () => {
      if (clientDisconnected) return;

      try {
        const result = await checkDomainAvailability(candidate.domain, abortController.signal);
        
        if (clientDisconnected) return;

        // Augment result with candidate metadata (TLD, category, base keyword)
        const payload = {
          ...result,
          tld: candidate.tld,
          category: candidate.category,
          base: candidate.base
        };

        // Write immediately to the SSE stream
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
      } catch (err) {
        if (clientDisconnected || abortController.signal.aborted) return;

        // Send resilient fallback event so UI knows this item failed without breaking
        res.write(`data: ${JSON.stringify({
          domain: candidate.domain,
          available: false,
          tier: 0,
          method: 'error',
          error: err.message,
          tld: candidate.tld,
          category: candidate.category
        })}\n\n`);
      }
    });
  });

  // Await all tasks to finish
  try {
    await Promise.allSettled(tasks);
  } finally {
    if (!clientDisconnected) {
      // Notify frontend that all variations are finished
      res.write('event: done\ndata: {}\n\n');
      res.end();
    }
  }
}

/**
 * SSE Handler for the Generator page.
 * Streams availability for combinations of multiple keywords, industry presets,
 * compound blends, custom affixes, and selected TLDs.
 */
export async function handleStreamGenerator(req, res) {
  // Support both GET query params and POST body
  const params = req.method === 'POST' ? req.body : req.query;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
    'Access-Control-Allow-Origin': '*'
  });

  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }

  res.write(': generator stream start\n\n');

  const keywords = params.keywords || '';
  if (!keywords || (typeof keywords === 'string' && !keywords.trim())) {
    res.write(`event: error\ndata: ${JSON.stringify({ error: 'Please provide at least one keyword' })}\n\n`);
    res.write('event: done\ndata: {}\n\n');
    return res.end();
  }

  // Generate brandable names using neologisms, letter shuffling, and semantic associations
  const variations = await generateBrandDomains({
    keywords,
    tlds: params.tlds,
    brandStyle: params.brandStyle || 'all',
    industry: params.industry,
    maxCount: parseInt(params.maxCount, 10) || 60
  });

  res.write(`event: meta\ndata: ${JSON.stringify({
    total: variations.length,
    timestamp: Date.now()
  })}\n\n`);

  const abortController = new AbortController();
  let clientDisconnected = false;

  req.on('close', () => {
    clientDisconnected = true;
    abortController.abort();
  });

  const limit = pLimit(CONCURRENCY_LIMIT);

  const tasks = variations.map((candidate) => {
    return limit(async () => {
      if (clientDisconnected) return;

      try {
        const result = await checkDomainAvailability(candidate.domain, abortController.signal);
        if (clientDisconnected) return;

        const payload = {
          ...result,
          tld: candidate.tld,
          category: candidate.category,
          base: candidate.base,
          formula: candidate.formula
        };

        res.write(`data: ${JSON.stringify(payload)}\n\n`);
      } catch (err) {
        if (clientDisconnected || abortController.signal.aborted) return;

        res.write(`data: ${JSON.stringify({
          domain: candidate.domain,
          available: false,
          tier: 0,
          method: 'error',
          error: err.message,
          tld: candidate.tld,
          category: candidate.category
        })}\n\n`);
      }
    });
  });

  try {
    await Promise.allSettled(tasks);
  } finally {
    if (!clientDisconnected) {
      res.write('event: done\ndata: {}\n\n');
      res.end();
    }
  }
}

