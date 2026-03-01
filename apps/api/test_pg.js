import pg from 'pg';
const { Client } = pg;

async function run() {
    const client = new Client({ connectionString: 'postgresql://openvault:openvault_secret@localhost:5432/openvault?schema=public' });
    await client.connect();
    try {
        const res = await client.query('SELECT id, opens_at, created_at FROM share_links ORDER BY created_at DESC LIMIT 5');
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}
run();
