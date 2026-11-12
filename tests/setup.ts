import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Every test file gets its own empty SQLite database in a temp folder.
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "devagent-test-"));
process.env.BASE_URL = "http://localhost:3000";
delete process.env.ANTHROPIC_API_KEY;
delete process.env.WA_TOKEN;
delete process.env.WA_PHONE_ID;
