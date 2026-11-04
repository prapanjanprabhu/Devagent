export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { runSchedulers } = await import("./lib/booking");
    setInterval(() => { try { runSchedulers(); } catch (e) { console.error("scheduler failed", e); } }, 60_000);
  }
}
