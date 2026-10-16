async function checkChunk() {
  const html = await fetch("http://localhost:3000/auth/login").then(r => r.text());
  const match = html.match(/src="([^"]+auth_login_page[^"]+)"/);
  if (!match) {
    console.log("No login page chunk match!");
    return;
  }
  const chunkUrl = "http://localhost:3000" + match[1];
  console.log("Chunk URL:", chunkUrl);
  const code = await fetch(chunkUrl).then(r => r.text());
  console.log("Chunk code sample:\n", code.substring(0, 500));
}

checkChunk();
