function normalizeText(value = "") {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value = "") {
  return normalizeText(value)
    .toLowerCase()
    .split(/[^a-zA-Z0-9+#._-]+/)
    .filter(Boolean);
}

function retrieveRelevantContext(documents = [], query = "", limit = 5) {
  const queryTokens = tokenize(query);
  const queryTokenWeights = queryTokens.reduce((weights, token) => {
    if (token === "frontend") weights[token] = 5;
    else if (token === "engineer" || token === "developer") weights[token] = 2;
    else weights[token] = 2;
    return weights;
  }, {});
  const queryPhrase = normalizeText(query).toLowerCase();

  if (!Array.isArray(documents) || !documents.length) {
    return [];
  }

  return documents
    .map((doc, index) => {
      const title = normalizeText(doc.title || "Document");
      const content = normalizeText(doc.content || doc.text || doc.summary || "");
      const titleTokens = tokenize(title);
      const tokens = tokenize(content);
      const overlapScore = tokens.reduce((sum, token) => sum + (queryTokenWeights[token] || 0), 0);
      const titleOverlapScore = titleTokens.reduce((sum, token) => sum + (queryTokenWeights[token] || 0), 0);
      const phraseBonus = content.toLowerCase().includes(queryPhrase) ? 5 : 0;
      const titleBonus = title.toLowerCase().includes(queryPhrase) ? 8 : 0;
      const score = overlapScore + titleOverlapScore * 2 + phraseBonus + titleBonus + (content.length > 0 ? 1 : 0);

      return {
        id: doc.id || doc.documentId || `doc-${index}`,
        type: doc.type || doc.documentType || "document",
        title: title || "Document",
        content,
        score,
      };
    })
    .filter((doc) => doc.content)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

module.exports = {
  retrieveRelevantContext,
  tokenize,
};
