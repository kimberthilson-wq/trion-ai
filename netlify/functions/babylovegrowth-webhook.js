const OWNER = "kimberthilson-wq";
const REPO = "trion-ai";
const BRANCH = "main";
const FILE_PATH = "blog/articles.json";

function slugify(text = "") {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeArticle(payload) {
  const title =
    payload.title ||
    payload.headline ||
    payload.name ||
    "Untitled Article";

  const id =
    slugify(payload.slug) ||
    slugify(title) ||
    `article-${Date.now()}`;

  return {
    id,
    title,
    excerpt:
      payload.excerpt ||
      payload.summary ||
      payload.description ||
      "",
    featuredImage:
      payload.featuredImage ||
      payload.image ||
      payload.imageUrl ||
      payload.coverImage ||
      "",
    publishDate:
      payload.publishDate ||
      payload.date ||
      new Date().toISOString().slice(0, 10),
    content:
      payload.content ||
      payload.body ||
      payload.html ||
      "<p>No content provided.</p>",
  };
}

async function githubRequest(url, options = {}) {
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    throw new Error("Missing GITHUB_TOKEN environment variable");
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options.headers || {}),
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data;
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        body: JSON.stringify({ error: "Method not allowed" }),
      };
    }

    const expectedToken = process.env.BABYLOVEGROWTH_WEBHOOK_TOKEN;
    const authHeader = event.headers.authorization || "";

    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: "Unauthorized" }),
      };
    }

    const payload = JSON.parse(event.body || "{}");
    const newArticle = normalizeArticle(payload);

    const fileUrl =
      `https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE_PATH}?ref=${BRANCH}`;

    const currentFile = await githubRequest(fileUrl);

    const decodedContent = Buffer.from(
      currentFile.content,
      "base64"
    ).toString("utf8");

    const blogData = JSON.parse(decodedContent);

    if (!Array.isArray(blogData.articles)) {
      blogData.articles = [];
    }

    const existingIndex = blogData.articles.findIndex(
      (article) => article.id === newArticle.id
    );

    if (existingIndex >= 0) {
      blogData.articles[existingIndex] = newArticle;
    } else {
      blogData.articles.unshift(newArticle);
    }

    const updatedContent = JSON.stringify(blogData, null, 2);

    await githubRequest(
      `https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE_PATH}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: `Add blog article: ${newArticle.title}`,
          content: Buffer.from(updatedContent).toString("base64"),
          sha: currentFile.sha,
          branch: BRANCH,
        }),
      }
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: "Article added to blog/articles.json",
        article: newArticle,
      }),
    };
  } catch (error) {
    console.error("Webhook error:", error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message,
      }),
    };
  }
};
