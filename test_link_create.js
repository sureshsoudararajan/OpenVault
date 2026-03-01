import fetch from 'node-fetch';

async function test() {
  const loginRes = await fetch("http://localhost:4000/api/auth/login", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({email: "suresh@example.com", password: "password"})
  });
  const loginData = await loginRes.json();
  const token = loginData?.data?.accessToken;
  if (!token) {
      console.error("Login failed:", loginData);
      return;
  }
  
  // Create link
  // Get a file
  const filesRes = await fetch("http://localhost:4000/api/files?page=1", {
    headers: {"Authorization": "Bearer " + token}
  });
  const filesData = await filesRes.json();
  const fileId = filesData.data.data[0]?.id;
  
  const tomorrow = new Date(Date.now() + 86400000).toISOString();
  console.log("Creating link with opensAt:", tomorrow);
  
  const createRes = await fetch("http://localhost:4000/api/sharing/link", {
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
  console.log("Create response:", createData);
  
  const shareToken = createData.data.token;
  
  // Now try to fetch it
  const linkRes = await fetch("http://localhost:4000/api/sharing/link/" + shareToken);
  const linkData = await linkRes.json();
  console.log("Link fetch response:", linkData);
}
test();
