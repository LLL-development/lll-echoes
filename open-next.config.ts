import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Wall data uses dynamic rendering; no persistent ISR cache is configured.
export default defineCloudflareConfig();
