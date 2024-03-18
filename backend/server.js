const express = require("express");
const app = express();
const { MongoClient } = require("mongodb"); // Import MongoDB client
const aiplatform = require("@google-cloud/aiplatform");
const { PredictionServiceClient } = aiplatform.v1;
const { helpers } = aiplatform;
const config = require("./config.json");

// MongoDB connection string - adjust in the config.json file
const mongoUri = config.mongoDB.mongoUri;
const client = new MongoClient(mongoUri);
const dbName = config.mongoDB.dbName;
const collectionName = config.mongoDB.collectionName;

const clientOptions = {
  apiEndpoint: config.googleCloud.apiEndpoint,
};

const project = config.googleCloud.project;
const location = config.googleCloud.location;
const publisher = config.googleCloud.publisher;
const model = config.googleCloud.model;

const predictionServiceClient = new PredictionServiceClient(clientOptions);

let history = [];
let lastRag = false;

// Extracts floating point numbers from a nested JSON structure.
function extractFloatsFromJson(jsonData) {
  let floats = []; // Store extracted floats.

  // Loop through jsonData to reach deeply nested `values`.
  jsonData.forEach((item) => {
    const values =
      item.structValue.fields.embeddings.structValue.fields.values.listValue
        .values;

    // Extract and add `numberValue` to floats if present.
    values.forEach((valueItem) => {
      if (valueItem.kind === "numberValue") {
        floats.push(valueItem.numberValue);
      }
    });
  });

  return floats; // Return collected floats.
}

// Asynchronously fetches embeddings for given text using a Google Cloud model.
async function getEmbeddings(text) {
  const embeddingModel = config.googleCloud.embeddingModel; // Model identifier.
  // Construct the API endpoint with project and location details.
  const endpoint = `projects/${project}/locations/${location}/publishers/${publisher}/models/${embeddingModel}`;

  // Prepare the input instance with the text content.
  const instance = { content: text };
  const instanceValue = helpers.toValue(instance); // Convert to expected format.
  const instances = [instanceValue]; // Wrap in an array for the API request.

  // Set prediction parameters.
  const parameter = {
    temperature: 0, // Controls randomness.
    maxOutputTokens: 256, // Maximum length of the generated text.
    topP: 0, // Nucleus sampling: selects the smallest set of tokens cumulatively.
    topK: 1, // Top-k sampling: selects the top k probabilities.
  };
  const parameters = helpers.toValue(parameter); // Convert to expected format.

  // Construct the request object.
  const request = {
    endpoint,
    instances,
    parameters,
  };

  // Perform the predict request to the API.
  const [response] = await predictionServiceClient.predict(request);
  const predictions = response.predictions; // Extract predictions.

  // Extract and return floats from the predictions JSON.
  return extractFloatsFromJson(predictions);
}

app.use(express.json());
const cors = require("cors");
app.use(cors());

app.get("/", (req, res) => {
  res.send("RAG Chatbot Backend is running!");
});

app.post("/embedding", async (req, res) => {
  const text = req.body.text;

  try {
    // Attempt to get embeddings for the provided text
    const embeddings = await getEmbeddings(text);

    res.json({ embeddings: embeddings }); // Return embeddings
  } catch (error) {
    console.error("Error getting embeddings:", error);

    // Respond with a 500 Internal Server Error status code and error message
    res.status(500).json({ message: "Error processing your request" });
  }
});

// Endpoint for handling chat messages, dynamically responding based on RAG status.
app.post("/chat", async (req, res) => {
  const userMessage = req.body.message; // Extract user message from request body.
  const rag = req.body.rag; // Extract RAG status.
  let prompt; // Initialize prompt variable for later use.

  // Reset history if RAG status has changed since last message.
  if (lastRag !== rag) {
    history = [];
    lastRag = rag;
  }

  // Add user's message to history.
  history.push({
    author: "user",
    content: userMessage,
  });

  try {
    if (rag) {
      // RAG enabled: Use embeddings to find relevant responses.
      const embeddings = await getEmbeddings(userMessage);

      // Define MongoDB db and collection and set up aggregation pipeline for vector search.
      const db = client.db(dbName);
      const collection = db.collection(collectionName);

      const pipeline = [
        {
          $vectorSearch: {
            index: "vector_index",
            path: "embedding",
            queryVector: embeddings,
            numCandidates: 200,
            limit: 1,
          },
        },
      ];
      const aggregationResponse = await collection
        .aggregate(pipeline)
        .toArray();
      console.log(aggregationResponse);

      // Check if aggregation returned results and prepare prompt accordingly.
      if (aggregationResponse.length > 0) {
        const { pdfFileName, sentence, pageNumber } = aggregationResponse[0];
        mongoContext = `Answer the user based on the Relevant context, always tell the user the name of the pdf file and the page number as part of your answer: "${sentence}" from ${pdfFileName}, page ${pageNumber}.`;

        prompt = {
          context: mongoContext,
          examples: [
            // Add any examples if needed
          ],
          messages: history,
        };
      } else {
        // Handle case where no aggregation results are found.
        console.error("Error processing chat message:", error);
        res.status(500).json({ message: "Error processing your message" });
      }
    } else {
      // RAG disabled: Prepare a general-purpose prompt.
      prompt = {
        context: `You are a helpful chatbot, you are not allowed to lie or make stuff up. RAG is off. 
        If you can't find the information the user is looking for say "I don't know" `,
        examples: [
          // Add any examples if needed
        ],
        messages: history,
      };
    }

    // Set up and make prediction request.
    const instanceValue = helpers.toValue(prompt);
    const instances = [instanceValue];

    const parameters = helpers.toValue({
      temperature: 0.2,
      maxOutputTokens: 300,
      topP: 0.95,
      topK: 40,
    });

    const endpoint = `projects/${project}/locations/${location}/publishers/${publisher}/models/${model}`;
    const request = {
      endpoint,
      instances,
      parameters,
    };

    const [response] = await predictionServiceClient.predict(request);
    const predictions = response.predictions;

    // Extract and send bot's text response.
    const botResponseObj = predictions[0];
    const botTextResponse =
      botResponseObj.structValue.fields.candidates.listValue.values[0]
        .structValue.fields.content.stringValue;

    history.push({
      author: "system",
      content: botTextResponse,
    });

    res.json({ message: botTextResponse });
  } catch (error) {
    console.error("Error processing chat message:", error);
    res.status(500).json({ message: "Error processing your message" });
  }
});

// Connect to MongoDB when the server starts
async function connectToMongoDB() {
  dbClient = new MongoClient(mongoUri);
  try {
    await dbClient.connect();
    console.log("Connected successfully to MongoDB");
  } catch (error) {
    console.error("Could not connect to MongoDB:", error);
    process.exit(1); // Exit if the database connection cannot be established
  }
}

// Start server and connect to MongoDB
connectToMongoDB().then(() => {
  app.listen(config.port, () => {
    console.log(`Server is running on port ${config.port}`);
  });
});

// Gracefully handle shutdown and close MongoDB connection
process.on("SIGINT", async () => {
  await dbClient.close();
  console.log("MongoDB connection closed");
  process.exit(0);
});
