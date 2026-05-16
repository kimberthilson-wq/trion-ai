exports.handler = async (event) => {
  try {
    // Only allow POST
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        body: JSON.stringify({
          error: "Method not allowed",
        }),
      };
    }

    // Validate bearer token
    const authHeader = event.headers.authorization || "";
    const expectedToken = process.env.BABYLOVEGROWTH_WEBHOOK_TOKEN;

    if (
      expectedToken &&
      authHeader !== `Bearer ${expectedToken}`
    ) {
      return {
        statusCode: 401,
        body: JSON.stringify({
          error: "Unauthorized",
        }),
      };
    }

    // Parse incoming data
    const payload = JSON.parse(event.body || "{}");

    console.log("Incoming BabyLoveGrowth payload:", payload);

    // Normalize article
    const article = {
      title:
        payload.title ||
        payload.headline ||
        "Untitled Article",

      content:
        payload.content ||
        payload.body ||
        "",

      createdAt: new Date().toISOString(),
    };

    console.log("Processed article:", article);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        article,
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
