import 'dotenv/config';
import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { LiveAgentRepository } from './repository.js';

const config = loadConfig();
const port = Number(process.env.PORT || 8787);
serve({ fetch: createApp(config, new LiveAgentRepository(config)).fetch, port });
console.log(`Loxleys Agent API listening on ${config.publicApiBaseUrl}`);
