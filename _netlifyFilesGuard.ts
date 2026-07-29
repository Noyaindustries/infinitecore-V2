/**
 * Les handlers fichiers Netlify ne doivent pas exposer upload/download/delete :
 * l’API Express (auth + ownership registry) est la seule surface autorisée.
 */
export function netlifyFilesDisabledResponse(method: string) {
  return {
    statusCode: 403,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "null",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": `${method}, OPTIONS`,
    },
    body: JSON.stringify({
      success: false,
      error:
        "Endpoints fichiers Netlify désactivés. Utilisez l’API Infinite Core authentifiée (/api/files/*).",
    }),
  };
}

export function netlifyFilesOptionsResponse(method: string) {
  return {
    statusCode: 204,
    headers: {
      "Access-Control-Allow-Origin": "null",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": `${method}, OPTIONS`,
      "Cache-Control": "no-store",
    },
    body: "",
  };
}
