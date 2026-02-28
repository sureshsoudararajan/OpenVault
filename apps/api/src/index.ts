import { buildApp } from './app.js';
import { loadConfig } from '@openvault/config';
import { initStorage } from './storage/minio.js';
import { initWorkers } from './jobs/index.js';

async function main() {
    const config = loadConfig();
    const app = await buildApp();

    // Initialize MinIO bucket
    await initStorage(config);

    // Initialize background job workers
    await initWorkers(config);

    // Start server
    try {
        await app.listen({ port: config.port, host: '0.0.0.0' });
        app.log.info(`🔐 OpenVault API running at http://0.0.0.0:${config.port}`);
    } catch (err) {
        app.log.error(err);
        process.exit(1);
    }

    // Graceful shutdown
    const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
    for (const signal of signals) {
        process.on(signal, async () => {
            app.log.info(`Received ${signal}, shutting down...`);
            await app.close();
            process.exit(0);
        });
    }
}

main();
