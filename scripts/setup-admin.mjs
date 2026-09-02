import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
const adminEmail = "daniellochole@gmail.com";
const adminPassword = process.env.NYAKAJU_ADMIN_PASSWORD;

if (!supabaseUrl || !secretKey) {
  throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY are required.");
}

const supabase = createClient(supabaseUrl, secretKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

let page = 1;
let adminUser;

while (!adminUser) {
  const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
  if (error) throw error;

  adminUser = data.users.find((user) => user.email?.toLowerCase() === adminEmail);
  if (adminUser || data.users.length < 200) break;
  page += 1;
}

if (!adminUser) {
  const { data, error } = adminPassword
    ? await supabase.auth.admin.createUser({
        email: adminEmail,
        password: adminPassword,
        email_confirm: true,
        app_metadata: { role: "admin" },
      })
    : await supabase.auth.admin.inviteUserByEmail(adminEmail, {
        redirectTo: "http://localhost:3000/auth/callback",
        data: { invited_for: "nyakaju_admin" },
      });
  if (error) throw error;
  adminUser = data.user;
  console.log(adminPassword ? `Created ${adminEmail} with password login.` : `Invited ${adminEmail}.`);
}

const { error: roleError } = await supabase.auth.admin.updateUserById(adminUser.id, {
  ...(adminPassword ? { password: adminPassword } : {}),
  app_metadata: {
    ...(adminUser.app_metadata ?? {}),
    role: "admin",
  },
});

if (roleError) throw roleError;
console.log(`Administrator role configured for ${adminEmail}.`);
if (!adminPassword) {
  console.log("Set NYAKAJU_ADMIN_PASSWORD and run this command again to configure password login.");
}
