async function test() {
  const res = await fetch("http://localhost:3000/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Artur Macamo",
      email: "artur@teste.com",
      password: "password123",
    }),
  });

  const data = await res.json();
  console.log("Status:", res.status);
  console.log("Response:", data);
}

test();
