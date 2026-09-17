import { sanitizeKeyword, generateVariations, generateAdvancedCombinations } from '../lib/combinatorics.js';
import { checkDomainAvailability } from '../lib/domainChecker.js';

async function runTests() {
  console.log('--- Testing Combinatorics Engine ---');
  const kw = sanitizeKeyword('  My Awesome App!  ');
  console.log('Sanitized keyword:', kw);
  if (kw !== 'myawesomeapp') {
    throw new Error(`Sanitization failed: expected 'myawesomeapp', got '${kw}'`);
  }

  const variations = generateVariations('flow', 40);
  console.log(`Generated ${variations.length} variations for 'flow'. Samples:`);
  console.log(variations.slice(0, 8).map(v => v.domain));
  if (variations.length < 30) {
    throw new Error('Not enough variations generated');
  }

  // Verify .pw, .sh, .ro are in generated variations
  const domains = variations.map(v => v.domain);
  const hasPw = domains.some(d => d.endsWith('.pw'));
  const hasSh = domains.some(d => d.endsWith('.sh'));
  const hasRo = domains.some(d => d.endsWith('.ro'));
  console.log('Includes .pw:', hasPw, '| .sh:', hasSh, '| .ro:', hasRo);
  if (!hasPw || !hasSh || !hasRo) {
    throw new Error('Missing .pw, .sh, or .ro in generated variations');
  }

  console.log('\n--- Testing Advanced Generator Combinations ---');
  const genResults = generateAdvancedCombinations({
    keywords: ['cloud', 'flow'],
    tlds: ['pw', 'sh', 'ro', 'ai', 'com'],
    industry: 'ai',
    includeBlends: true,
    includePrefixes: true,
    includeSuffixes: true,
    includeHyphens: true,
    maxCount: 40
  });
  console.log(`Advanced combinations count: ${genResults.length}. Samples:`);
  console.log(genResults.slice(0, 10).map(r => `${r.domain} (${r.category})`));

  const hasBlend = genResults.some(r => r.category === 'blend');
  const hasHyphen = genResults.some(r => r.domain.includes('-'));
  console.log('Has compound blends:', hasBlend, '| Has hyphens:', hasHyphen);
  if (!hasBlend) throw new Error('Advanced generator failed to generate compound blends');

  console.log('\n--- Testing Domain Checker: Known TAKEN Domain (Tier 1 DoH) ---');
  const googleCheck = await checkDomainAvailability('google.com');
  console.log('google.com result:', googleCheck);
  if (googleCheck.available !== false || googleCheck.tier !== 1) {
    throw new Error(`google.com should be taken via Tier 1 DoH. Got: ${JSON.stringify(googleCheck)}`);
  }

  console.log('\n--- Testing Domain Checker on .ro / .sh / .pw ---');
  const roCheck = await checkDomainAvailability('google.ro');
  console.log('google.ro result:', roCheck);
  if (roCheck.available !== false) {
    throw new Error(`google.ro should be taken. Got: ${JSON.stringify(roCheck)}`);
  }

  const shCheck = await checkDomainAvailability('google.sh');
  console.log('google.sh result:', shCheck);
  if (shCheck.available !== false) {
    throw new Error(`google.sh should be taken. Got: ${JSON.stringify(shCheck)}`);
  }

  console.log('\n--- Testing Domain Checker: Known UNREGISTERED Domain (Tier 2 Fallback) ---');
  const randomSuffix = Math.random().toString(36).substring(2, 10);
  const untakenDomain = `testunreg-${Date.now()}-${randomSuffix}.com`;
  const unregCheck = await checkDomainAvailability(untakenDomain);
  console.log(`${untakenDomain} result:`, unregCheck);
  if (unregCheck.available !== true) {
    console.warn(`Note: ${untakenDomain} returned available=${unregCheck.available}`);
  }

  console.log('\n--- Testing Brand Identity Engine (host -> hostia, hosters, soth, sothing) ---');
  const { generateBrandDomains } = await import('../lib/brandEngine.js');
  const brandDomains = await generateBrandDomains({
    keywords: 'host',
    tlds: ['com', 'io', 'ai'],
    brandStyle: 'all',
    maxCount: 40
  });

  const domainNames = brandDomains.map(b => b.domain);
  console.log('Sample brand domains generated for host:', domainNames.slice(0, 10));

  const hasHostia = domainNames.some(d => d.startsWith('hostia.'));
  const hasHosters = domainNames.some(d => d.startsWith('hosters.'));
  const hasSoth = domainNames.some(d => d.startsWith('soth.'));
  const hasSothing = domainNames.some(d => d.startsWith('sothing.'));

  console.log('Has hostia:', hasHostia, '| Has hosters:', hasHosters, '| Has soth:', hasSoth, '| Has sothing:', hasSothing);

  if (!hasHostia || !hasHosters || !hasSoth || !hasSothing) {
    throw new Error('Brand engine missing required outputs (hostia, hosters, soth, or sothing)');
  }

  console.log('\n✅ All core backend, generator, and brand identity tests passed successfully!');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});


