import fetch from 'node-fetch';

async function test() {
  console.log("Logging in...");
  const loginRes = await fetch("http://127.0.0.1:4000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "suresh@example.com", password: "password" })
  });
  const loginData = await loginRes.json();
  const token = loginData?.data?.accessToken;

  if (!token) return console.log("Login failed");

  console.log("Fetching files...");
  const filesRes = await fetch("http://127.0.0.1:4000/api/files?page=1", {
    headers: { "Authorization": "Bearer " + token }
  });
  const filesData = await filesRes.json();
  const fileId = filesData.data?.data?.[0]?.id;
  if (!fileId) return console.log("No file found to share");

  const tomorrow = new Date(Date.now() + 86400000).toISOString();
  console.log("Creating link with opensAt:", tomorrow);

  const createRes = await fetch("http://127.0.0.1:4000/api/sharing/link", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + token,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      fileId: fileId,
      opensAt: tomorrow
    })
  });

  const createData = await createRes.json();
  const shareToken = createData.data?.token;
  console.log("Create response:", createData);

  if (!shareToken) return console.log("Failed to create link");

  console.log("\nFetching the created link (expecting 403)...");
  const linkRes = await fetch("http://127.0.0.1:4000/api/sharing/link/" + shareToken);
  console.log("Status:", linkRes.status);
  const linkData = await linkRes.json();
  console.log("Response JSON:", linkData);
}
test();
