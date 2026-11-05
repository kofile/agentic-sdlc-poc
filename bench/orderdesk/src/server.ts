import { createApp } from "./app.js";
import { openDatabase } from "./db/connection.js";

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const DB_PATH = process.env.ORDERDESK_DB_PATH ?? "orderdesk.sqlite";

const db = openDatabase(DB_PATH);
const app = createApp(db);

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`orderdesk listening on port ${PORT} (db: ${DB_PATH})`);
});
