const express = require("express");
const app = express();
const { MongoClient } = require("mongodb"); // Import MongoDB client
const aiplatform = require("@google-cloud/aiplatform");
const { PredictionServiceClient } = aiplatform.v1;
const { helpers } = aiplatform;
const config = require("./config.json");

// MongoDB connection string - adjust the URI as needed
const mongoUri = config.mongoDB.mongoUri;
const client = new MongoClient(mongoUri);
const dbName = config.mongoDB.dbName;
const collectionName = config.mongoDB.collectionName;

const clientOptions = {
  apiEndpoint: googleCloud.apiEndpoint,
};

const project = googleCloud.project;
const location = googleCloud.location;
const publisher = googleCloud.publisher;
const model = googleCloud.model;

const predictionServiceClient = new PredictionServiceClient(clientOptions);

let history = [];
let lastRag = false;

function extractFloatsFromJson(jsonData) {
  // Initialize an empty array to hold the floats
  let floats = [];

  // Iterate through the jsonData array
  jsonData.forEach((item) => {
    // Navigate through the nested properties to reach the `values` array
    const values =
      item.structValue.fields.embeddings.structValue.fields.values.listValue
        .values;

    // Extract the numberValue from each item in the `values` array and push it to the floats array
    values.forEach((valueItem) => {
      if (valueItem.kind === "numberValue") {
        floats.push(valueItem.numberValue);
      }
    });
  });

  // Return the array of floats
  return floats;
}

async function getEmbeddings(text) {
  const embeddingModel = googleCloud.embeddingModel;
  // Configure the parent resource
  const endpoint = `projects/${project}/locations/${location}/publishers/${publisher}/models/${embeddingModel}`;

  const instance = {
    content: text,
  };
  const instanceValue = helpers.toValue(instance);
  const instances = [instanceValue];

  const parameter = {
    temperature: 0,
    maxOutputTokens: 256,
    topP: 0,
    topK: 1,
  };
  const parameters = helpers.toValue(parameter);

  const request = {
    endpoint,
    instances,
    parameters,
  };

  // Predict request
  const [response] = await predictionServiceClient.predict(request);
  const predictions = response.predictions;

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

app.post("/chat", async (req, res) => {
  const userMessage = req.body.message;
  const rag = req.body.rag;
  console.log(rag);
  let prompt;

  if (lastRag !== rag) {
    history = [];
    lastRag = rag;
  }

  history.push({
    author: "user",
    content: userMessage,
  });

  try {
    if (rag) {
      const embeddings = await getEmbeddings(userMessage);

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

      if (aggregationResponse.length > 0) {
        const { pdfFileName, sentence, pageNumber } = aggregationResponse[0];
        mongoContext = `Answer the user based on the Relevant context, always tell the user the pdf file and the page number as par of your answer: "${sentence}" from ${pdfFileName}, page ${pageNumber}.`;

        prompt = {
          context: mongoContext,
          examples: [
            // Add any examples if needed
          ],
          messages: history,
        };
      } else {
        console.error("Error processing chat message:", error);
        res.status(500).json({ message: "Error processing your message" });
      }
    } else {
      prompt = {
        context: `You are a helpful chatbot, you are not allowed to lie or make stuff up. RAG is off. 
        If you can't find the information the user is looking for say "I don't know" `,
        examples: [
          // Add any examples if needed
        ],
        messages: history,
      };
    }
    console.log(prompt);
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

    // Extracting just the text response from the AI model
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
