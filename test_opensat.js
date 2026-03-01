const opensAtLocal = "2026-03-02T10:00";
const opensAtUTC = new Date(opensAtLocal).toISOString();
console.log({
    localInput: opensAtLocal,
    asISO: opensAtUTC,
    now: new Date().toISOString(),
    isFuture: new Date(opensAtUTC) > new Date()
});
