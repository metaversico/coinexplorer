// db/seed.ts
import { loadMarketsFromYaml, upsertMarket, getCoinsPool, closeCoinsPool } from "./markets/mod.ts";

async function seed() {
    console.log("Seeding database from markets.yml...");

    const pool = getCoinsPool();
    const client = await pool.connect();

    try {
        const markets = await loadMarketsFromYaml();
        console.log(`Found ${markets.length} markets in markets.yml`);

        for (const market of markets) {
            console.log(`Upserting market: ${market.name} (${market.address})`);
            const { name, chain, type, address } = market;
            await upsertMarket(client, address, { name, chain, type, address });
        }

        console.log("Database seeding complete.");
    } catch (error) {
        console.error("Error seeding database:", error);
    } finally {
        client.release();
        await closeCoinsPool();
    }
}

seed();
