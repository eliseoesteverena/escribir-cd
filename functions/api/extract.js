export async function onRequestPost(context) {
  const GEMINI_API_KEY = context.env.GEMINI_API_KEY;
  
  if (!GEMINI_API_KEY) {
    return new Response("API key no configurada", { status: 500 });
  }
  
  const endpoint = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent";
  
  // Leer el body que te manda el frontend
  const inputContent = await context.request.json();
  
  // Aquí pegas tu prompt y la lógica de `parts` que ya tienes...
  const promptText = `Actúa como un sistema de transcripción...`; // tu prompt completo
  
  let parts = [];
  if (inputContent.inlineData) {
    parts.push({ inlineData: inputContent.inlineData });
    parts.push({ text: promptText });
  } else {
    parts.push({ text: `\( {promptText}\n\n[CONTENIDO DEL DOCUMENTO WORD]:\n \){inputContent.text}` });
  }
  
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": GEMINI_API_KEY,
    },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        responseMimeType: "application/json"
      }
    })
  });
  
  if (!response.ok) {
    return new Response(`Gemini API error: ${response.statusText}`, { status: response.status });
  }
  
  const data = await response.json();
  const jsonString = data.candidates[0].content.parts[0].text;
  const structuredData = JSON.parse(jsonString);
  
  return new Response(JSON.stringify(structuredData), {
    headers: { "Content-Type": "application/json" }
  });
}