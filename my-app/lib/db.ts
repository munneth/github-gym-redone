import { neon } from "@neondatabase/serverless";

async function getData() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL not found");
  }
  const sql = neon(process.env.DATABASE_URL);
  const response = await sql`SELECT version()`;
  return response[0].version;
}
