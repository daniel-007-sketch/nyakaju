import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;
if (!url || !publishableKey || !secretKey) {
  throw new Error("Supabase environment variables are required.");
}

const admin = createClient(url, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const anonymous = createClient(url, publishableKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
let testUserId;
let testClient;
const testEmail = `nyakaju-security-${Date.now()}@example.org`;
const testPassword = `Nyakaju-${crypto.randomUUID()}-Aa1!`;
const testObject = `security-test/${crypto.randomUUID()}.txt`;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

try {
  const publicRooms = await anonymous
    .from("room_types")
    .select("id, slug")
    .eq("is_active", true);
  assert(!publicRooms.error && publicRooms.data.length >= 3, "Anonymous room reads should succeed.");

  const publicImages = await anonymous
    .from("room_images")
    .select("id, storage_path");
  assert(!publicImages.error && publicImages.data.length >= 9, "Anonymous active-room image reads should succeed.");

  const privateBookings = await anonymous
    .from("bookings")
    .select("id");
  assert(
    Boolean(privateBookings.error) || privateBookings.data.length === 0,
    "Anonymous booking reads must reveal no rows.",
  );

  const anonymousRpc = await anonymous.rpc("create_booking_request", {
    p_room_type_id: publicRooms.data[0].id,
    p_guest_first_name: "Anonymous",
    p_guest_last_name: "Denied",
    p_guest_email: "anonymous-denied@example.org",
    p_guest_phone: "+10000000000",
    p_arrival_date: "2030-01-01",
    p_departure_date: "2030-01-02",
    p_room_count: 1,
  });
  assert(Boolean(anonymousRpc.error), "Anonymous callers must not execute the booking function directly.");

  const createdUser = await admin.auth.admin.createUser({
    email: testEmail,
    password: testPassword,
    email_confirm: true,
  });
  if (createdUser.error) throw createdUser.error;
  testUserId = createdUser.data.user.id;

  testClient = createClient(url, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const signedIn = await testClient.auth.signInWithPassword({
    email: testEmail,
    password: testPassword,
  });
  if (signedIn.error) throw signedIn.error;

  const nonAdminBookings = await testClient.from("bookings").select("id");
  assert(
    Boolean(nonAdminBookings.error) || nonAdminBookings.data.length === 0,
    "Non-admin users must not read bookings.",
  );

  const nonAdminRoomWrite = await testClient.from("room_types").insert({
    slug: `denied-${Date.now()}`,
    name: "Denied",
    nightly_rate: 1,
    total_units: 1,
  });
  assert(Boolean(nonAdminRoomWrite.error), "Non-admin users must not create rooms.");

  const nonAdminStorage = await testClient.storage
    .from("room-images")
    .upload(testObject, new TextEncoder().encode("denied"), {
      contentType: "text/plain",
    });
  assert(Boolean(nonAdminStorage.error), "Non-admin users must not mutate room image Storage.");

  await admin.auth.admin.updateUserById(testUserId, {
    app_metadata: { role: "admin" },
  });
  await testClient.auth.signOut();
  const adminSignIn = await testClient.auth.signInWithPassword({
    email: testEmail,
    password: testPassword,
  });
  if (adminSignIn.error) throw adminSignIn.error;

  const adminBookings = await testClient.from("bookings").select("id");
  assert(!adminBookings.error, "An app_metadata admin should pass booking RLS.");

  const adminStorage = await testClient.storage
    .from("room-images")
    .upload(testObject.replace(".txt", ".webp"), new Uint8Array([82, 73, 70, 70]), {
      contentType: "image/webp",
    });
  assert(!adminStorage.error, "An app_metadata admin should pass Storage mutation RLS.");
  await testClient.storage.from("room-images").remove([testObject.replace(".txt", ".webp")]);

  console.log("Anonymous, non-admin, administrator, booking, and Storage RLS tests passed.");
} finally {
  if (testClient) await testClient.auth.signOut();
  if (testUserId) await admin.auth.admin.deleteUser(testUserId);
}
