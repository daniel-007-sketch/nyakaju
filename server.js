const next = require("next");

const port = parseInt(process.env.PORT || "3000", 10);

console.log("SUPABASE RUNTIME CHECK:", {
  url: Boolean(process.env.SUPABASE_URL),
  publishable: Boolean(process.env.SUPABASE_PUBLISHABLE_KEY),
  secret: Boolean(process.env.SUPABASE_SECRET_KEY),
});

const app = next({ dev: false });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  require("http")
    .createServer((req, res) => handle(req, res))
    .listen(port, () => {
      console.log(`> Next.js ready on port ${port}`);
    });
});