import { createFlagsmithInstance } from '@flagsmith/flagsmith/isomorphic';
import { createHash, randomUUID } from 'node:crypto';

const environmentID = process.env.FLAGSMITH_SIMULATION_SDK_KEY;
const count = process.argv[2] === undefined ? 400 : Number(process.argv[2]);
if (!environmentID || !Number.isInteger(count) || count < 2 || count > 1200) {
  throw new Error(
    'Set FLAGSMITH_SIMULATION_SDK_KEY to a dedicated simulation environment key. Pass a count from 2 to 1200.'
  );
}
if (environmentID === process.env.FLAGSMITH_SDK_KEY) {
  throw new Error('Use a separate Flagsmith environment for simulated identities.');
}

const run = randomUUID().slice(0, 8);
const totals = new Map();
let excluded = 0;
const flagsmithFetch = (url, input) => fetch(url, { ...input, signal: AbortSignal.timeout(5000) });
const defaultConfig = {
  environmentID,
  enableEvents: true,
  fetch: flagsmithFetch,
  ...(process.env.FLAGSMITH_EDGE_API && { api: process.env.FLAGSMITH_EDGE_API }),
  ...(process.env.FLAGSMITH_EVENTS_API && { eventProcessorConfig: { eventsApiUrl: process.env.FLAGSMITH_EVENTS_API } }),
};

async function visit(index) {
  const identity = `cb_sim_${run}_${index}`;
  const flagsmith = createFlagsmithInstance();
  try {
    await flagsmith.init({ ...defaultConfig, identity });
    const assigned = flagsmith.getAllFlags().studio_next_steps;
    if (!assigned?.experiment?.inExperiment || !['control', 'brain'].includes(assigned.value) || !assigned.variant) {
      excluded++;
      return;
    }
    const outcome = createHash('sha256').update(identity).digest().readUInt16BE(0) / 65536;
    const converted = outcome < (assigned.value === 'brain' ? 0.32 : 0.22);
    flagsmith.trackExposureEvent('studio_next_steps', { value: assigned.variant, metadata: { simulated: true, run } });
    if (converted) flagsmith.trackEvent('studio_suggestion_sent', { metadata: { simulated: true, run } });
    await flagsmith.flushEvents();
    const previous = totals.get(assigned.value) ?? { exposed: 0, sent: 0 };
    totals.set(assigned.value, { exposed: previous.exposed + 1, sent: previous.sent + Number(converted) });
  } finally {
    await flagsmith.close(1200);
  }
}

for (let offset = 0; offset < count; offset += 6) {
  await Promise.all(Array.from({ length: Math.min(count - offset, 6) }, (_, index) => visit(offset + index)));
}
console.log(JSON.stringify({ run, simulated: true, excluded, queued: Object.fromEntries(totals) }, null, 2));
if (totals.size !== 2) {
  console.error('Both variants are required. Check that the experiment is running and new identities can enroll.');
  process.exitCode = 1;
}
