async function testScripts() {
  const html = await fetch("http://localhost:3000/auth/login").then(r => r.text());
  const scripts = [...html.matchAll(/src="([^"]+)"/g)].map(m => m[1]);
  console.log("Found scripts:", scripts);
  for (const s of scripts) {
    const url = "http://localhost:3000" + s;
    const res = await fetch(url);
    console.log(s, "->", res.status, res.headers.get("content-type"), "Length:", (await res.text()).length);
  }
}

testScripts();
