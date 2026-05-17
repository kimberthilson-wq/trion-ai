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

function extractArticleData(payload) {
  if (!payload || typeof payload !== "object") {
    return {};
  }

  const nested =
    payload.article ||
    payload.data ||
    payload.post ||
    payload.entry ||
    payload.item ||
    null;

  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    return {
      ...nested,
      _event: payload.event || payload.action || payload.type,
    };
  }

  return payload;
}

function normalizeArticle(raw) {
  const title =
    raw.title ||
    raw.headline ||
    raw.name ||
    raw.subject ||
    "Untitled Article";

  const slug = slugify(raw.slug || raw.url_slug || raw.permalink || "");
  const id = slug || slugify(title) || `article-${Date.now()}`;

  const content =
    raw.content ||
    raw.body ||
    raw.html ||
    raw.bodyHtml ||
    raw.body_html ||
    raw.full_content ||
    raw.fullContent ||
    raw.articleBody ||
    raw.article_body ||
    raw.article_html ||
    raw.articleHtml ||
    raw.markdown ||
    raw.text ||
    "";

  const excerpt =
    raw.excerpt ||
    raw.summary ||
    raw.description ||
    raw.subtitle ||
    raw.meta_description ||
    raw.metaDescription ||
    raw.short_description ||
    raw.shortDescription ||
    "";

  const featuredImage =
    raw.featuredImage ||
    raw.featured_image ||
    raw.image ||
    raw.imageUrl ||
    raw.image_url ||
    raw.coverImage ||
    raw.cover_image ||
    raw.thumbnail ||
    raw.thumbnail_url ||
    raw.thumbnailUrl ||
    raw.banner ||
    raw.hero_image ||
    raw.heroImage ||
    raw.og_image ||
    raw.ogImage ||
    "";

  const publishDate =
    raw.publishDate ||
    raw.publish_date ||
    raw.published_at ||
    raw.publishedAt ||
    raw.date ||
    raw.created_at ||
    raw.createdAt ||
    new Date().toISOString().slice(0, 10);

  const normalizedDate =
    typeof publishDate === "string" && publishDate.length > 10
      ? publishDate.slice(0, 10)
      : publishDate;

  return {
    id,
    title,
    excerpt,
    featuredImage,
    publishDate: normalizedDate,
    content: content || "<p>No content provided.</p>",
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
    throw new Error(
      `GitHub API error: ${response.status} ${response.statusText} — ${JSON.stringify(data)}`
    );
  }

  return data;
}

exports.handler = async (event) => {
  console.log("[webhook] Received request:", event.httpMethod);

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
      console.log("[webhook] Authorization failed");
      return {
        statusCode: 401,
        body: JSON.stringify({ error: "Unauthorized" }),
      };
    }

    const rawBody = event.body || "{}";
    const payload = JSON.parse(rawBody);

    console.log("[webhook] Incoming payload keys:", Object.keys(payload));
    console.log("[webhook] === FULL INCOMING PAYLOAD START ===");
    console.log(JSON.stringify(payload, null, 2));
    console.log("[webhook] === FULL INCOMING PAYLOAD END ===");

    const articleData = extractArticleData(payload);

    console.log("[webhook] Extracted article data keys:", Object.keys(articleData));
    console.log("[webhook] === EXTRACTED ARTICLE DATA START ===");
    console.log(JSON.stringify(articleData, null, 2));
    console.log("[webhook] === EXTRACTED ARTICLE DATA END ===");

    const newArticle = normalizeArticle(articleData);
    console.log("[webhook] === MAPPED VALUES START ===");
    console.log("[webhook] MAPPED title:", newArticle.title);
    console.log("[webhook] MAPPED excerpt:", newArticle.excerpt);
    console.log("[webhook] MAPPED featuredImage:", newArticle.featuredImage);
    console.log("[webhook] MAPPED content:", newArticle.content);
    console.log("[webhook] === MAPPED VALUES END ===");

    const fileUrl =
      `https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE_PATH}?ref=${BRANCH}`;

    console.log("[webhook] Fetching current articles from GitHub...");
    const currentFile = await githubRequest(fileUrl);
    console.log("[webhook] GitHub fetch status: OK, sha:", currentFile.sha);

    const decodedContent = Buffer.from(currentFile.content, "base64").toString("utf8");
    const blogData = JSON.parse(decodedContent);

    if (!Array.isArray(blogData.articles)) {
      blogData.articles = [];
    }

    console.log("[webhook] Existing article count:", blogData.articles.length);

    const existingIndex = blogData.articles.findIndex(
      (article) => article.id === newArticle.id
    );

    if (existingIndex >= 0) {
      console.log("[webhook] Updating existing article at index:", existingIndex);
      blogData.articles[existingIndex] = newArticle;
    } else {
      console.log("[webhook] Appending new article at front of list");
      blogData.articles.unshift(newArticle);
    }

    const updatedContent = JSON.stringify(blogData, null, 2);

    console.log("[webhook] Committing updated articles.json to GitHub...");
    const commitResult = await githubRequest(
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

    console.log(
      "[webhook] GitHub commit status: OK, new sha:",
      commitResult.content?.sha
    );
    console.log("[webhook] Final saved article count:", blogData.articles.length);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: "Article saved to blog/articles.json",
        article: {
          id: newArticle.id,
          title: newArticle.title,
          publishDate: newArticle.publishDate,
        },
        totalArticles: blogData.articles.length,
      }),
    };
  } catch (error) {
    console.error("[webhook] Error:", error.message);
    console.error("[webhook] Stack:", error.stack);

    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message,
      }),
    };
  }
};
