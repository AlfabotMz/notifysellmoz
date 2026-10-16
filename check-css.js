async function checkCss() {
  const html = await fetch("http://localhost:3000/auth/login").then(r => r.text());
  const cssMatch = html.match(/\/([a-zA-Z0-9_\-\.\/]+globals[a-zA-Z0-9_\-\.]*\.css)/);
  if (!cssMatch) {
    console.log("No globals.css link found in HTML!");
    return;
  }
  const cssUrl = "http://localhost:3000/" + cssMatch[1];
  console.log("Fetching CSS:", cssUrl);
  const css = await fetch(cssUrl).then(r => r.text());
  console.log("CSS Length:", css.length);
  console.log("Has bg-slate-900:", css.includes("bg-slate-900"));
  console.log("Has rounded-lg:", css.includes("rounded-lg"));
  console.log("First 300 chars of CSS:\n", css.substring(0, 300));
}

checkCss();
