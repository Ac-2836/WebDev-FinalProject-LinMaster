// Demo and mock data (Working_rules §9). Must be safe to run many times: upsert, never blind insert.
// Each module adds its seed step here once its tables exist (P1-05 onwards).
async function main() {
  console.log('Seed: no tables yet, nothing to insert.');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
