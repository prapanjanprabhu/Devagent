// Runs once when the server starts. The Node-only work lives in its own file so the Edge bundle never sees it.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startBackground } = await import("./instrumentation-node");
    await startBackground();
  }
}
