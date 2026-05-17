exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        body: JSON.stringify({ error: "Method not allowed" }),
      };
    }

    const data = JSON.parse(event.body);

    console.log("Incoming article:", data);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: "Webhook received successfully",
        article: {
          title: data.title,
          slug: data.slug,
        },
      }),
    };
  } catch (error) {
    console.error(error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message,
      }),
    };
  }
};
